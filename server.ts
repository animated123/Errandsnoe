import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { firebaseService } from './services/firebaseService';
import { ErrandStatus } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer() {
  const app = express();
  
  // Google Cloud Run injects PORT. Defaulting to 3000 for AI Studio preview.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Dual Verification Storage
  interface VerificationPackage {
    phoneCode: string;
    phoneVerified: boolean;
    emailCode: string;
    emailVerified: boolean;
    expiresAt: number;
    lastSentAt: number;
  }
  const verificationStore = new Map<string, VerificationPackage>();

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/errands/calculate-distance', async (req, res) => {
    const { pickup, dropoff } = req.body;
    if (!pickup || !dropoff) return res.status(400).json({ error: 'Pickup and dropoff coordinates are required' });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Google Maps API key not configured' });

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.lat},${pickup.lng}&destination=${dropoff.lat},${dropoff.lng}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ error: `Maps API error: ${data.status}` });
      }

      const route = data.routes[0];
      const leg = route.legs[0];
      const distanceKm = leg.distance.value / 1000;
      const polyline = route.overview_polyline.points;

      res.json({
        distanceKm,
        polyline,
        pickup: leg.start_location,
        dropoff: leg.end_location
      });
    } catch (error) {
      console.error('Distance calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate distance' });
    }
  });

  app.get('/api/admin/export-env', (req, res) => {
    const envContent = [
      `VITE_FIREBASE_API_KEY=${process.env.VITE_FIREBASE_API_KEY || ''}`,
      `VITE_FIREBASE_AUTH_DOMAIN=${process.env.VITE_FIREBASE_AUTH_DOMAIN || ''}`,
      `VITE_FIREBASE_PROJECT_ID=${process.env.VITE_FIREBASE_PROJECT_ID || ''}`,
      `VITE_FIREBASE_STORAGE_BUCKET=${process.env.VITE_FIREBASE_STORAGE_BUCKET || ''}`,
      `VITE_FIREBASE_MESSAGING_SENDER_ID=${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}`,
      `VITE_FIREBASE_APP_ID=${process.env.VITE_FIREBASE_APP_ID || ''}`,
      `VITE_GOOGLE_MAPS_API_KEY=${process.env.VITE_GOOGLE_MAPS_API_KEY || ''}`,
      `VITE_CLOUDINARY_CLOUD_NAME=${process.env.VITE_CLOUDINARY_CLOUD_NAME || ''}`,
      `VITE_CLOUDINARY_UPLOAD_PRESET=${process.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''}`,
      `TALKSASA_TOKEN=${process.env.TALKSASA_TOKEN || ''}`,
      `TALKSASA_SENDER_ID=${process.env.TALKSASA_SENDER_ID || ''}`,
      `RESEND_API_KEY=${process.env.RESEND_API_KEY || ''}`,
      `RESEND_FROM=${process.env.RESEND_FROM || ''}`,
      `GOOGLE_MAPS_API_KEY=${process.env.GOOGLE_MAPS_API_KEY || ''}`,
      `GEMINI_API_KEY=${process.env.GEMINI_API_KEY || process.env.API_KEY || ''}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=.env');
    res.send(envContent);
  });

  app.post('/api/auth/verify/send-package', async (req, res) => {
    const { phone, email, type } = req.body; // type: 'phone' | 'email' | 'both'
    if (type === 'phone' && !phone) return res.status(400).json({ error: 'Phone is required' });
    if (type === 'email' && !email) return res.status(400).json({ error: 'Email is required' });
    if (type === 'both' && (!phone || !email)) return res.status(400).json({ error: 'Phone and email are required' });

    // Normalize phone number if provided
    let normalizedPhone = '';
    if (phone) {
      normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);
      else if (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1')) normalizedPhone = '254' + normalizedPhone;
    }

    const key = type === 'phone' ? normalizedPhone : email;
    const existing = verificationStore.get(key);

    // Spam Check: 60 seconds
    if (existing && Date.now() - existing.lastSentAt < 60000) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code' });
    }

    const smsCode = Math.floor(100000 + Math.random() * 900000).toString();
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    verificationStore.set(key, {
      phoneCode: smsCode,
      phoneVerified: (type === 'email') ? true : (existing?.phoneVerified || false),
      emailCode: emailCode,
      emailVerified: (type === 'phone') ? true : (existing?.emailVerified || false),
      expiresAt,
      lastSentAt: Date.now()
    });

    try {
      const promises = [];

      // Send SMS via TalkSasa
      if (type === 'phone' || type === 'both') {
        promises.push(fetch('https://bulksms.talksasa.com/api/v3/sms/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.TALKSASA_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            recipient: normalizedPhone,
            sender_id: process.env.TALKSASA_SENDER_ID || 'TALK-SASA',
            type: 'plain',
            message: `Your verification code is ${smsCode}. Valid for 5 mins.`
          })
        }));
      }

      // Send Email via Resend
      if (type === 'email' || type === 'both') {
        promises.push(fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'onboarding@resend.dev',
            to: email,
            subject: 'Verify your account',
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #000;">Verification Code</h2>
                <p>Your verification code is:</p>
                <div style="background: #f4f4f4; padding: 20px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 10px;">
                  ${emailCode}
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 20px;">This code expires in 5 minutes.</p>
              </div>
            `
          })
        }));
      }

      await Promise.all(promises);
      res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
      console.error('Verification Send Error:', error);
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  app.post('/api/auth/verify/step', (req, res) => {
    const { phone, email, smsCode, emailCode, type } = req.body;
    
    let normalizedPhone = '';
    if (phone) {
      normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);
      else if (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1')) normalizedPhone = '254' + normalizedPhone;
    }

    const key = type === 'phone' ? normalizedPhone : email;
    const stored = verificationStore.get(key);

    if (!stored) return res.status(400).json({ error: 'No verification session found' });
    if (Date.now() > stored.expiresAt) return res.status(400).json({ error: 'Verification code has expired' });

    let updated = { ...stored };
    let match = false;

    if (type === 'phone' && smsCode === stored.phoneCode) {
      updated.phoneVerified = true;
      match = true;
    }

    if (type === 'email' && emailCode === stored.emailCode) {
      updated.emailVerified = true;
      match = true;
    }

    if (type === 'both') {
      if (smsCode && smsCode === stored.phoneCode) updated.phoneVerified = true;
      if (emailCode && emailCode === stored.emailCode) updated.emailVerified = true;
      if ((smsCode && smsCode === stored.phoneCode) || (emailCode && emailCode === stored.emailCode)) match = true;
    }

    verificationStore.set(key, updated);

    const isFullyVerified = updated.phoneVerified && updated.emailVerified;

    if (isFullyVerified) {
      verificationStore.delete(key);
      return res.json({ 
        success: true, 
        fullyVerified: true, 
        message: 'Identity fully verified' 
      });
    }

    res.json({ 
      success: true, 
      fullyVerified: false, 
      phoneVerified: updated.phoneVerified,
      emailVerified: updated.emailVerified,
      message: match ? 'Code verified' : 'Invalid code'
    });
  });

  // Detect production mode based on NODE_ENV or existence of dist folder
  const isProduction = process.env.NODE_ENV === 'production' || 
                      (typeof process.env.NODE_ENV === 'undefined' && 
                       fs.existsSync(path.join(__dirname, 'dist')));

  let viteMounted = false;
  // Vite middleware for development
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      viteMounted = true;
    } catch (e) {
      console.warn("Vite not found, falling back to static serving if dist exists");
    }
  } 
  
  if (isProduction || !viteMounted) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // FIX: Express 5 requires a named parameter for wildcards
    // Using /:path* to capture all routes for SPA navigation
    app.get('/:path*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Function to cancel stale errands
  const cancelStaleErrands = async () => {
    console.log('Checking for stale errands...');
    try {
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

      const staleErrands = await firebaseService.fetchStaleErrands(twentyFourHoursAgo);

      for (const errand of staleErrands) {
        if (errand.status === ErrandStatus.PENDING) {
            await firebaseService.cancelErrand(errand.id);
            console.log(`Cancelled errand ${errand.id}`);
        }
      }
    } catch (error) {
      // Don't let a firebase error crash the whole server startup
      console.error('Firebase sync error:', error.message);
    }
  };

  // Run the check every hour
  setInterval(cancelStaleErrands, 60 * 60 * 1000);
  
  // We wrap this to ensure the server starts listening even if Firebase check fails
  cancelStaleErrands().catch(err => console.error("Initial stale check failed", err));

  return { app, PORT };
}

// Only start the server if NOT running on Vercel (which uses the exported createServer)
if (!process.env.VERCEL) {
  createServer().then(({ app, PORT }) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
    });
  }).catch(err => {
    console.error("Critical Server Failure:", err);
    process.exit(1);
  });
}
