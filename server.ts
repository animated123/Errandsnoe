import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
// import { firebaseService } from './services/firebaseService'; // Removed to prevent client SDK initialization in Node
import { ErrandStatus } from './types';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const adminAuth = admin.auth();
const adminDb = admin.firestore();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions for server-side Firestore operations
const fetchStaleErrands = async (beforeTimestamp: number) => {
  const snapshot = await adminDb.collection('errands')
    .where('status', '==', ErrandStatus.PENDING)
    .where('createdAt', '<', beforeTimestamp)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
};

const cancelErrand = async (id: string) => {
  await adminDb.collection('errands').doc(id).update({ status: ErrandStatus.CANCELLED });
};

// Helper for fetch with timeout
const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const normalizePhone = (phone: string) => {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('254')) {
    normalized = normalized.substring(3);
  }
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  return '254' + normalized;
};

const sendSMS = async (recipient: string, message: string) => {
  if (!process.env.TALKSASA_TOKEN) {
    console.warn('TALKSASA_TOKEN not configured, skipping SMS');
    return;
  }

  const normalizedPhone = normalizePhone(recipient);

  try {
    await fetchWithTimeout('https://bulksms.talksasa.com/api/v3/sms/send', {
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
        message: message
      })
    });
    console.log(`SMS sent to ${normalizedPhone}`);
  } catch (error: any) {
    console.error('SMS Send Error:', error.message);
    throw error;
  }
};

export async function createServer() {
  const app = express();
  
  // Google Cloud Run injects PORT. Defaulting to 3000 for AI Studio preview.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // SMS Notification Endpoint
  app.post('/api/notifications/sms', async (req, res) => {
    const { recipient, message } = req.body;
    if (!recipient || !message) {
      return res.status(400).json({ error: 'Recipient and message are required' });
    }

    try {
      await sendSMS(recipient, message);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

  // Check for fetch availability
  if (!global.fetch) {
    console.warn("WARNING: Global fetch is not available. External API calls may fail.");
  }

  app.post('/api/auth/verify/send-package', async (req, res) => {
    console.log('Received verification request:', req.body);
    const { phone, email, type } = req.body; // type: 'phone' | 'email' | 'both'
    if (type === 'phone' && !phone) return res.status(400).json({ error: 'Phone is required' });
    if (type === 'email' && !email) return res.status(400).json({ error: 'Email is required' });
    if (type === 'both' && (!phone || !email)) return res.status(400).json({ error: 'Phone and email are required' });

    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const key = type === 'phone' ? normalizedPhone : email;
    const existing = verificationStore.get(key);

    // Spam Check: 60 seconds
    if (existing && Date.now() - existing.lastSentAt < 60000) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code' });
    }

    const smsCode = Math.floor(100000 + Math.random() * 900000).toString();
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    console.log(`Generated codes for ${key}: SMS=${smsCode}, Email=${emailCode}`);

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
        if (process.env.TALKSASA_TOKEN) {
          promises.push(fetchWithTimeout('https://bulksms.talksasa.com/api/v3/sms/send', {
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
          }).catch(e => console.error('SMS Send Error:', e.message)));
        } else {
          console.warn('TALKSASA_TOKEN not configured, skipping SMS');
        }
      }

      // Send Email via Resend
      if (type === 'email' || type === 'both') {
        if (process.env.RESEND_API_KEY) {
          promises.push(fetchWithTimeout('https://api.resend.com/emails', {
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
          }).catch(e => console.error('Email Send Error:', e.message)));
        } else {
          console.warn('RESEND_API_KEY not configured, skipping Email');
        }
      }

      await Promise.all(promises);
      res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
      console.error('Verification Send Error:', error);
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  app.post('/api/auth/verify/step', async (req, res) => {
    try {
      const { phone, email, smsCode, emailCode, type, userId } = req.body;
      
      const normalizedPhone = phone ? normalizePhone(phone) : '';
      const key = type === 'phone' ? normalizedPhone : email;
      const stored = verificationStore.get(key);

      const cleanSmsCode = smsCode ? String(smsCode).trim() : undefined;
      const cleanEmailCode = emailCode ? String(emailCode).trim() : undefined;

      console.log(`Verify step for ${key}: received SMS=${cleanSmsCode}, stored SMS=${stored?.phoneCode}, userId=${userId}`);

      if (!stored) return res.status(400).json({ error: 'No verification session found' });
      if (Date.now() > stored.expiresAt) return res.status(400).json({ error: 'Verification code has expired' });

      let updated = { ...stored };
      let match = false;

      if (type === 'phone' && cleanSmsCode === stored.phoneCode) {
        updated.phoneVerified = true;
        match = true;
      }

      if (type === 'email' && cleanEmailCode === stored.emailCode) {
        updated.emailVerified = true;
        match = true;
      }

      if (type === 'both') {
        if (cleanSmsCode && cleanSmsCode === stored.phoneCode) updated.phoneVerified = true;
        if (cleanEmailCode && cleanEmailCode === stored.emailCode) updated.emailVerified = true;
        if ((cleanSmsCode && cleanSmsCode === stored.phoneCode) || (cleanEmailCode && cleanEmailCode === stored.emailCode)) match = true;
      }

      verificationStore.set(key, updated);

      const isFullyVerified = updated.phoneVerified && updated.emailVerified;
      const isCurrentTypeVerified = type === 'phone' ? updated.phoneVerified : (type === 'email' ? updated.emailVerified : isFullyVerified);

      if (isCurrentTypeVerified) {
        // If we are fully verified, or if we only requested one type and it's verified, we can proceed
        if (isFullyVerified) {
          verificationStore.delete(key);
        }
        
        // If userId is provided (authenticated user verifying phone)
        if (userId && type === 'phone') {
          // Check if phone is already used by ANOTHER user
          if (normalizedPhone) {
            const existingUsers = await adminDb.collection('users')
              .where('phone', '==', normalizedPhone)
              .get();
            
            const otherUser = existingUsers.docs.find(d => d.id !== userId);
            if (otherUser) {
              return res.status(400).json({ error: 'Phone number already linked to another account' });
            }
          }

          // Update the user
          await adminDb.collection('users').doc(userId).update({ 
            phoneVerified: true,
            phone: normalizedPhone // Ensure phone is synced
          });
          
          return res.json({ 
            success: true, 
            fullyVerified: isFullyVerified, 
            phoneVerified: true,
            message: 'Phone verified successfully' 
          });
        }

        // Existing logic for login/registration flow (no userId provided)
        if (isFullyVerified) {
          let uid: string | null = null;
          
          // Try finding by phone
          if (normalizedPhone) {
            try {
              const userRecord = await adminAuth.getUserByPhoneNumber('+' + normalizedPhone);
              uid = userRecord.uid;
            } catch (e) {}
          }
          
          // Try finding by email if phone failed
          if (!uid && email) {
            try {
              const userRecord = await adminAuth.getUserByEmail(email);
              uid = userRecord.uid;
            } catch (e) {}
          }

          // If user exists, create custom token
          if (uid) {
            await adminDb.collection('users').doc(uid).update({ phoneVerified: true });
            const customToken = await adminAuth.createCustomToken(uid);
            return res.json({ 
              success: true, 
              fullyVerified: true, 
              phoneVerified: true,
              customToken,
              message: 'Identity fully verified' 
            });
          } else {
            // User doesn't exist, they need to register
            return res.json({ 
              success: true, 
              fullyVerified: true, 
              needsRegistration: true,
              message: 'Identity verified, please complete registration' 
            });
          }
        }
      }

      res.json({ 
        success: true, 
        fullyVerified: false, 
        phoneVerified: updated.phoneVerified,
        emailVerified: updated.emailVerified,
        message: match ? 'Code verified' : 'Invalid code'
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      return res.status(500).json({ error: error.message || 'Failed to complete verification' });
    }
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

      const staleErrands = await fetchStaleErrands(twentyFourHoursAgo);

      for (const errand of staleErrands) {
        if (errand.status === ErrandStatus.PENDING) {
          await cancelErrand(errand.id);
          console.log(`Cancelled errand ${errand.id}`);
        }
      }
    } catch (error: any) {
      console.error('Firebase sync error:', error.message);
    }
  };

  const checkOverdueVerifications = async () => {
    console.log('Checking for overdue verifications...');
    try {
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      const snapshot = await adminDb.collection('errands')
        .where('status', '==', ErrandStatus.VERIFYING)
        .where('submittedForReviewAt', '<', twelveHoursAgo)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.penaltyNotificationSent) continue;

        const requesterDoc = await adminDb.collection('users').doc(data.requesterId).get();
        const requester = requesterDoc.data();

        if (requester && requester.phone) {
          const message = `ErrandsApp Alert: It has been over 12 hours since your runner completed "${data.title}". Please verify immediately to avoid accrued penalties.`;
          await sendSMS(requester.phone, message);
          await doc.ref.update({ penaltyNotificationSent: true });
        }
      }
    } catch (error: any) {
      console.error('Error checking overdue verifications:', error.message);
    }
  };

  // Run checks every hour
  setInterval(() => {
    cancelStaleErrands();
    checkOverdueVerifications();
  }, 60 * 60 * 1000);
  
  // Initial checks
  cancelStaleErrands().catch(err => console.error("Initial stale check failed", err));
  checkOverdueVerifications().catch(err => console.error("Initial verification check failed", err));

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: err.message || 'A server error occurred' });
  });

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
