import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
// import { Resend } from 'resend';
import nodemailer from 'nodemailer';
// import { firebaseService } from './services/firebaseService'; // Removed to prevent client SDK initialization in Node
import { ErrandStatus } from './types';

console.log('--- Server Process Starting ---');

// Helper to read JSON config safely in ESM
const readConfig = () => {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading firebase-applet-config.json:', e);
  }
  return null;
};

const firebaseConfig = readConfig();

// Initialize Email Configuration
const emailFrom = process.env.SMTP_FROM || process.env.RESEND_FROM || 'Errands@codexict.co.ke';

// Initialize SMTP
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const transporter = smtpConfig.host ? nodemailer.createTransport(smtpConfig) : null;

if (transporter) {
  console.log('SMTP initialized successfully with host:', smtpConfig.host);
  console.log('Email From Address:', emailFrom);
} else {
  console.warn('SMTP not configured (SMTP_HOST missing). Email sending will fail.');
}

/**
 * Generic email sender using SMTP
 */
const sendEmail = async ({ to, subject, html }: { to: string, subject: string, html: string }) => {
  if (transporter) {
    console.log(`Attempting to send email to ${to} using SMTP...`);
    try {
      const info = await transporter.sendMail({
        from: emailFrom,
        to,
        subject,
        html,
      });
      console.log('SMTP Email Sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('SMTP Send Error:', error);
      throw error;
    }
  } else {
    console.error('No email provider configured (SMTP_HOST missing).');
    return null;
  }
};

// Initialize Firebase Admin
let adminAuth: admin.auth.Auth | null = null;
let adminDb: admin.firestore.Firestore | null = null;

const initializeFirebaseAdmin = async () => {
  if (admin.apps.length) {
    if (!adminAuth) adminAuth = admin.auth();
    if (!adminDb) adminDb = getFirestore();
    return { adminAuth, adminDb };
  }

  try {
    if (firebaseConfig) {
      const projectId = firebaseConfig.projectId;
      console.log('Initializing Firebase Admin with Project ID:', projectId);
      
      let credential;
      const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      const serviceAccountFilePath = path.join(process.cwd(), 'firebase-service-account.json');
      
      if (serviceAccountVar) {
        try {
          console.log('Attempting to parse service account from environment variable...');
          let cleanedVar = serviceAccountVar.trim();
          
          // Handle cases where the string might be wrapped in quotes or escaped with literal \n
          if (cleanedVar.startsWith('"') && cleanedVar.endsWith('"')) {
            try {
              cleanedVar = JSON.parse(cleanedVar);
            } catch (e) {
              console.warn('Failed to unwrap quoted service account string');
            }
          }

          // If it doesn't start with '{', it might be base64 encoded or have literal escapes
          if (!cleanedVar.startsWith('{')) {
            // Try to handle literal \n or other escapes
            if (cleanedVar.includes('\\')) {
              try {
                // Unescape literal backslashes (e.g. \n -> newline)
                cleanedVar = cleanedVar.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              } catch (e) {}
            }

            // If still not starting with '{', try base64
            if (!cleanedVar.trim().startsWith('{')) {
              try {
                const decoded = Buffer.from(cleanedVar.trim(), 'base64').toString('utf8');
                if (decoded.trim().startsWith('{')) {
                  cleanedVar = decoded.trim();
                }
              } catch (e) {
                // Not base64
              }
            }
          }

          const serviceAccount = JSON.parse(cleanedVar.trim());
          credential = admin.credential.cert(serviceAccount);
          console.log('Firebase Admin initialized with service account from environment variable.');
          
          // Verify project ID matches
          if (serviceAccount.project_id && serviceAccount.project_id !== projectId) {
            console.warn(`Service account project ID (${serviceAccount.project_id}) does not match config project ID (${projectId}). This may cause PERMISSION_DENIED.`);
          }
        } catch (e: any) {
          console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable as JSON:', e.message);
          console.log('Falling back to applicationDefault()...');
          credential = admin.credential.applicationDefault();
        }
      } else if (fs.existsSync(serviceAccountFilePath)) {
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFilePath, 'utf8'));
          credential = admin.credential.cert(serviceAccount);
          console.log('Firebase Admin initialized with service account from local file.');
        } catch (e) {
          console.error('Failed to read firebase-service-account.json:', e);
          credential = admin.credential.applicationDefault();
        }
      } else {
        console.log('No service account environment variable or local file found. Using applicationDefault().');
        credential = admin.credential.applicationDefault();
      }

      admin.initializeApp({
        credential,
        projectId: projectId // Ensure project ID is set explicitly
      });
      
      adminAuth = admin.auth();
      const dbId = firebaseConfig?.firestoreDatabaseId;
      
      try {
        adminDb = dbId 
          ? getFirestore(admin.app(), dbId)
          : getFirestore();
        
        // Test the connection to the database (only if not on Vercel to avoid cold start delays)
        if (!process.env.VERCEL) {
          try {
            await adminDb.collection('health_check').limit(1).get();
            console.log('Firebase Admin Auth and Firestore initialized successfully.');
          } catch (testError: any) {
            if (testError.code === 7 || testError.message.includes('PERMISSION_DENIED')) {
              console.error(`PERMISSION_DENIED when accessing database "${dbId || '(default)'}". Ensure the service account has "Cloud Datastore User" role.`);
              throw testError;
            } else if (testError.code === 5 || testError.message.includes('NOT_FOUND')) {
              console.error(`Database "${dbId || '(default)'}" NOT_FOUND. Check if the database ID is correct and exists in project "${projectId}".`);
              throw testError;
            } else {
              console.warn(`Health check failed for database "${dbId || '(default)'}":`, testError.message);
              // Don't throw for other errors, maybe the collection just doesn't exist
            }
          }
        }
      } catch (dbError: any) {
        console.error(`Failed to initialize Firestore with database ID "${dbId}":`, dbError.message);
        if (dbId && dbId !== '(default)') {
          console.log('Falling back to (default) database...');
          try {
            adminDb = getFirestore();
            if (!process.env.VERCEL) {
              await adminDb.collection('health_check').limit(1).get();
            }
            console.log('Successfully fell back to (default) database.');
          } catch (fallbackError: any) {
            console.error('Fallback to (default) database also failed:', fallbackError.message);
            // If both fail, we might be in trouble, but we'll keep adminDb as (default) and hope for the best
          }
        } else {
          console.error('Firestore initialization failed and no fallback possible.');
        }
      }
    } else {
      console.warn('No firebase-applet-config.json found. Firebase Admin not initialized.');
    }
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
  
  return { adminAuth, adminDb };
};

// Initialize Firebase Admin immediately if NOT on Vercel
if (!process.env.VERCEL) {
  initializeFirebaseAdmin().catch(err => console.error('Initial Firebase Admin setup failed:', err));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions for server-side Firestore operations
const fetchStaleErrands = async (beforeTimestamp: number) => {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection('errands')
    .where('status', '==', ErrandStatus.PENDING)
    .where('createdAt', '<', beforeTimestamp)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
};

const cancelErrand = async (id: string) => {
  if (!adminDb) return;
  await adminDb.collection('errands').doc(id).update({ status: ErrandStatus.CANCELLED });
};

// Helper for fetch with timeout
const fetchWithTimeout = async (url: string, options: any, timeout = 10000) => {
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
  
  // Initialize Firebase Admin for this request/server instance
  await initializeFirebaseAdmin();
  
  // Google Cloud Run injects PORT. Defaulting to 3000 for AI Studio preview.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check for infrastructure
  app.get('/api/ping', (req, res) => {
    res.json({ 
      status: 'pong', 
      timestamp: Date.now(),
      firebaseAdmin: !!admin.apps.length,
      talksasa: !!process.env.TALKSASA_TOKEN
    });
  });

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
      `GOOGLE_MAPS_API_KEY=${process.env.GOOGLE_MAPS_API_KEY || ''}`,
      `RESEND_API_KEY=${process.env.RESEND_API_KEY || ''}`,
      `RESEND_FROM=${process.env.RESEND_FROM || ''}`,
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

  // In-memory storage for sessions (since adminDb might lack permissions)
  const verificationSessions = new Map<string, VerificationPackage>();
  const passwordResets = new Map<string, any>();

  app.post('/api/auth/verify/send-package', async (req, res) => {
    console.log('Received verification request:', JSON.stringify(req.body));
    const { phone, email, type } = req.body;
    console.log('Type:', type, 'Phone:', phone, 'Email:', email);
    if (type === 'phone' && !phone) return res.status(400).json({ error: 'Phone is required' });
    if (type === 'email' && !email) return res.status(400).json({ error: 'Email is required' });
    if (type === 'both' && (!phone || !email)) return res.status(400).json({ error: 'Phone and email are required' });

    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const key = type === 'phone' ? normalizedPhone : email;
    const docId = encodeURIComponent(key);
    
    try {
      const existing = verificationSessions.get(docId);

      // Spam Check: 60 seconds
      if (existing && Date.now() - existing.lastSentAt < 60000) {
        return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code' });
      }

      const smsCode = Math.floor(100000 + Math.random() * 900000).toString();
      const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      console.log(`Generated codes for ${key}: SMS=${smsCode}, Email=${emailCode}`);

      verificationSessions.set(docId, {
        phoneCode: smsCode,
        phoneVerified: (type === 'email') ? true : (existing?.phoneVerified || false),
        emailCode: emailCode,
        emailVerified: (type === 'phone') ? true : (existing?.emailVerified || false),
        expiresAt,
        lastSentAt: Date.now()
      });

      const promises = [];

      // Send Email
      if ((type === 'email' || type === 'both') && email) {
        promises.push(sendEmail({
          to: email,
          subject: 'Verification Code - ErrandsApp',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #4f46e5; margin-bottom: 20px;">Verify your email</h2>
              <p style="font-size: 16px; color: #374151;">Your verification code for ErrandsApp is:</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">${emailCode}</span>
              </div>
              <p style="font-size: 14px; color: #6b7280;">This code will expire in 5 minutes. If you didn't request this, please ignore this email.</p>
              <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">&copy; ${new Date().getFullYear()} ErrandsApp. All rights reserved.</p>
            </div>
          `
        }).catch(e => {
          console.error('Email Send Error Details:', e);
        }));
      }

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
      const docId = encodeURIComponent(key);
      
      const stored = verificationSessions.get(docId);

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

      verificationSessions.set(docId, updated);

      const isFullyVerified = updated.phoneVerified && updated.emailVerified;
      const isCurrentTypeVerified = type === 'phone' ? updated.phoneVerified : (type === 'email' ? updated.emailVerified : isFullyVerified);

      if (isCurrentTypeVerified) {
        // If we are fully verified, or if we only requested one type and it's verified, we can proceed
        if (isFullyVerified) {
          verificationSessions.delete(docId);
        }
        
        // If userId is provided (authenticated user verifying phone or email)
        if (userId && (type === 'phone' || type === 'email')) {
          if (!adminDb) return res.status(500).json({ error: 'Database service unavailable' });
          
          const updateData: any = {};
          
          if (type === 'phone' && normalizedPhone) {
            // Check if phone is already used by ANOTHER user
            const existingUsers = await adminDb.collection('users')
              .where('phone', '==', normalizedPhone)
              .get();
            
            const otherUser = existingUsers.docs.find(d => d.id !== userId);
            if (otherUser) {
              return res.status(400).json({ error: 'Phone number already linked to another account' });
            }
            
            updateData.phoneVerified = true;
            updateData.phone = normalizedPhone;
          }

          if (type === 'email' && email) {
            // Check if email is already used by ANOTHER user
            const existingUsers = await adminDb.collection('users')
              .where('email', '==', email)
              .get();
            
            const otherUser = existingUsers.docs.find(d => d.id !== userId);
            if (otherUser) {
              return res.status(400).json({ error: 'Email address already linked to another account' });
            }
            
            updateData.emailVerified = true;
            updateData.isVerified = true;
            updateData.email = email;
          }

          // Update the user
          await adminDb.collection('users').doc(userId).update(updateData);
          
          return res.json({ 
            success: true, 
            fullyVerified: isFullyVerified, 
            phoneVerified: updated.phoneVerified,
            emailVerified: updated.emailVerified,
            message: `${type === 'phone' ? 'Phone' : 'Email'} verified successfully` 
          });
        }

        // Existing logic for login/registration flow (no userId provided)
        if (isFullyVerified) {
          if (!adminAuth || !adminDb) return res.status(500).json({ error: 'Auth/Database service unavailable' });
          
          let uid: string | null = null;
          
          // 1. Try finding by phone in Firebase Auth
          if (normalizedPhone) {
            try {
              const userRecord = await adminAuth.getUserByPhoneNumber('+' + normalizedPhone);
              uid = userRecord.uid;
              console.log(`Found user by phone in Auth: ${uid}`);
            } catch (e) {}
          }
          
          // 2. Try finding by email in Firebase Auth if phone failed
          if (!uid && email) {
            try {
              const userRecord = await adminAuth.getUserByEmail(email);
              uid = userRecord.uid;
              console.log(`Found user by email in Auth: ${uid}`);
            } catch (e) {}
          }

          // 3. Try finding by phone in Firestore if still not found
          if (!uid && normalizedPhone) {
            try {
              const userDocs = await adminDb.collection('public_users')
                .where('phone', '==', normalizedPhone)
                .limit(1)
                .get();
              if (!userDocs.empty) {
                uid = userDocs.docs[0].id;
                console.log(`Found user by phone in Firestore: ${uid}`);
              }
            } catch (e) {
              console.error('Firestore phone lookup error:', e);
            }
          }

          // 4. Try finding by email in Firestore if still not found
          if (!uid && email) {
            try {
              const userDocs = await adminDb.collection('public_users')
                .where('email', '==', email)
                .limit(1)
                .get();
              if (!userDocs.empty) {
                uid = userDocs.docs[0].id;
                console.log(`Found user by email in Firestore: ${uid}`);
              }
            } catch (e) {
              console.error('Firestore email lookup error:', e);
            }
          }

          // If user exists, create custom token
          if (uid) {
            // Update verification status in Firestore
            try {
              const updateData: any = {};
              if (updated.phoneVerified) updateData.phoneVerified = true;
              if (updated.emailVerified) updateData.isVerified = true; // or emailVerified if you have that field
              await adminDb.collection('users').doc(uid).update(updateData);
            } catch (e) {
              console.warn(`Failed to update user ${uid} verification status:`, e.message);
            }

            const customToken = await adminAuth.createCustomToken(uid);
            return res.json({ 
              success: true, 
              fullyVerified: true, 
              phoneVerified: updated.phoneVerified,
              emailVerified: updated.emailVerified,
              customToken,
              message: 'Identity fully verified' 
            });
          } else {
            // User doesn't exist, they need to register
            console.log(`User not found for ${key}, redirecting to registration`);
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
      
      // Handle specific Firebase errors
      if (error.code === 'auth/internal-error' || (error.message && error.message.includes('identitytoolkit.googleapis.com'))) {
        return res.status(500).json({ 
          error: 'The authentication service is not properly configured. Please contact support.',
          code: 'AUTH_CONFIG_ERROR'
        });
      }

      return res.status(500).json({ error: error.message || 'Failed to complete verification' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      if (!adminAuth || !adminDb) return res.status(500).json({ error: 'Auth/Database service unavailable' });
      
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
      } catch (e: any) {
        // If user not found, we still return success to prevent email enumeration
        if (e.code === 'auth/user-not-found') {
          return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
        }
        throw e;
      }

      // Generate a unique token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      // Store in Firestore
      await adminDb.collection('password_resets').doc(token).set({
        uid: userRecord.uid,
        email: userRecord.email,
        expiresAt,
        used: false
      });

      // Send Email
      if (userRecord.email) {
        const resetUrl = `${process.env.APP_URL || 'https://codexict.co.ke'}/reset-password?token=${token}`;
        await sendEmail({
          to: userRecord.email,
          subject: 'Reset your password - ErrandsApp',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #4f46e5; margin-bottom: 20px;">Reset your password</h2>
              <p style="font-size: 16px; color: #374151;">We received a request to reset your password. Click the button below to proceed:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.</p>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:<br/>${resetUrl}</p>
              <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">&copy; ${new Date().getFullYear()} ErrandsApp. All rights reserved.</p>
            </div>
          `
        }).catch(e => {
          console.error('Reset Email Error Details:', e);
        });
      }

      res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      if (!adminAuth || !adminDb) return res.status(500).json({ error: 'Auth/Database service unavailable' });
      
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const resetDocRef = adminDb.collection('password_resets').doc(token);
      const resetDoc = await resetDocRef.get();

      if (!resetDoc.exists) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
      }

      const resetData = resetDoc.data() as any;

      if (resetData.used) {
        return res.status(400).json({ error: 'This reset link has already been used' });
      }

      if (Date.now() > resetData.expiresAt) {
        return res.status(400).json({ error: 'This reset link has expired' });
      }

      // Update user password
      await adminAuth.updateUser(resetData.uid, {
        password: newPassword
      });

      // Mark token as used (or delete it)
      await resetDocRef.update({ used: true });
      // Alternatively, delete it: await resetDocRef.delete();

      res.json({ success: true, message: 'Password has been reset successfully' });
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.post('/api/errands/complete', async (req, res) => {
    try {
      if (!adminDb) return res.status(500).json({ error: 'Database service unavailable' });
      
      const { errandId, signature, rating } = req.body;
      console.log(`Starting completion for errand: ${errandId}`);
      if (!errandId) return res.status(400).json({ error: 'Errand ID is required' });

      const errandDoc = await adminDb.collection('errands').doc(errandId).get();
      if (!errandDoc.exists) {
        console.error(`Errand not found: ${errandId}`);
        return res.status(404).json({ error: 'Errand not found' });
      }
      
      const errand = errandDoc.data() as any;
      if (!errand.runnerId) {
        console.error(`Errand has no runner: ${errandId}`);
        return res.status(400).json({ error: 'Errand has no runner' });
      }

      const amount = errand.acceptedPrice || errand.budget || 0;
      console.log(`Completing errand ${errandId}, amount: ${amount}, runner: ${errand.runnerId}`);
      console.log('adminDb initialized:', !!adminDb);
      console.log('admin.apps.length:', admin.apps.length);

      // Update errand status
      await adminDb.collection('errands').doc(errandId).update({
        status: ErrandStatus.COMPLETED,
        signature: signature || '',
        completedAt: Date.now(),
        runnerRatingGiven: rating || 5
      });
      console.log(`Errand ${errandId} status updated to COMPLETED`);

      // Update runner balance and notify
      const runnerDoc = await adminDb.collection('users').doc(errand.runnerId).get();
      if (runnerDoc.exists) {
        const runner = runnerDoc.data() as any;
        const newBalance = (runner.walletBalance || 0) + amount;
        const newCompleted = (runner.errandsCompleted || 0) + 1;
        
        console.log(`Updating runner ${errand.runnerId} balance to ${newBalance}`);
        await adminDb.collection('users').doc(errand.runnerId).update({ 
          walletBalance: newBalance,
          errandsCompleted: newCompleted
        });

        if (runner.phone) {
          const message = `Dear ${runner.name}, your review for errand "${errand.title}" has been updated. Ksh ${amount} has been deposited to your errandsapp account. Your current balance is Ksh ${newBalance}.`;
          console.log(`Sending completion SMS to ${runner.phone}`);
          sendSMS(runner.phone, message).catch(e => console.error("SMS failed", e));
        }
      } else {
        console.error(`Runner document not found: ${errand.runnerId}`);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Complete errand error:', error);
      res.status(500).json({ error: error.message || 'Failed to complete errand' });
    }
  });

  // Admin User Management
  app.post('/api/admin/users/:userId/delete', async (req, res) => {
    try {
      if (!adminAuth || !adminDb) return res.status(500).json({ error: 'Admin service unavailable' });
      const { userId } = req.params;
      console.log(`Starting deletion for user: ${userId}`);
      
      // Try to delete from Auth, but don't fail if user not found
      try {
        console.log(`Attempting to delete from Auth: ${userId}`);
        await adminAuth.deleteUser(userId);
        console.log(`Deleted from Auth: ${userId}`);
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          console.error(`Error deleting from Auth: ${error.message}`);
          throw error;
        }
        console.log(`User ${userId} not found in Auth, skipping Auth deletion`);
      }
      
      console.log(`Attempting to delete from Firestore: ${userId}`);
      await adminDb.collection('users').doc(userId).delete();
      await adminDb.collection('public_users').doc(userId).delete();
      console.log(`Deleted from Firestore: ${userId}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/:userId/disable', async (req, res) => {
    try {
      if (!adminAuth) return res.status(500).json({ error: 'Admin service unavailable' });
      const { userId } = req.params;
      const { disabled } = req.body;
      await adminAuth.updateUser(userId, { disabled });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Disable user error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/:userId/password', async (req, res) => {
    try {
      if (!adminAuth) return res.status(500).json({ error: 'Admin service unavailable' });
      const { userId } = req.params;
      const { password } = req.body;
      await adminAuth.updateUser(userId, { password });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(500).json({ error: error.message });
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
    // Using * to capture all routes for SPA navigation
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Function to cancel stale errands
  const cancelStaleErrands = async () => {
    if (!adminDb) return;
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
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        console.error('Firebase sync error: Database or collection not found. This often happens if the database ID is incorrect.');
      } else {
        console.error('Firebase sync error:', error.message);
      }
    }
  };

  const checkOverdueVerifications = async () => {
    if (!adminDb) return;
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
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        console.error('Error checking overdue verifications: Database or collection not found.');
      } else if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
        console.error('Error checking overdue verifications: PERMISSION_DENIED.');
      } else {
        console.error('Error checking overdue verifications:', error);
      }
    }
  };

  // Run background tasks only once per process, and NOT on Vercel
  if (!(global as any).__backgroundTasksStarted && !process.env.VERCEL) {
    (global as any).__backgroundTasksStarted = true;
    
    // Migrate users
    const migrateUsers = async () => {
      if (!adminDb) return;
      console.log('Migrating users to public_users...');
      const users = await adminDb.collection('users').get();
      for (const doc of users.docs) {
        const data = doc.data();
        if (data.email || data.phone) {
          await adminDb.collection('public_users').doc(doc.id).set({
            email: data.email || '',
            phone: data.phone || '',
            name: data.name || 'User',
            role: data.role || 'requester',
            isOnline: data.isOnline || false,
            rating: data.rating || 5,
            loyaltyLevel: data.loyaltyLevel || 'Bronze'
          });
        }
      }
      console.log('Migration complete.');
    };
    migrateUsers().catch(err => {
      if (err.code === 5 || err.message.includes('NOT_FOUND')) {
        console.error("Migration failed: Database or collection not found. Ensure the correct database ID is used.");
      } else if (err.code === 7 || err.message.includes('PERMISSION_DENIED')) {
        console.error('Migration PERMISSION_DENIED: Service account lacks permissions for this database.');
      } else {
        console.error("Migration failed", err);
      }
    });

    // Run checks every hour
    setInterval(() => {
      cancelStaleErrands();
      checkOverdueVerifications();
    }, 60 * 60 * 1000);
    
    // Initial checks
    cancelStaleErrands().catch(err => console.error("Initial stale check failed", err));
    checkOverdueVerifications().catch(err => console.error("Initial verification check failed", err));
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    
    // Check for specific Firebase Admin errors
    if (err.code === 'auth/internal-error' || (err.message && err.message.includes('identitytoolkit.googleapis.com'))) {
      return res.status(500).json({ 
        error: 'Authentication service is currently unavailable. Please ensure Identity Toolkit API is enabled in the Google Cloud Console.',
        code: 'AUTH_SERVICE_DISABLED'
      });
    }

    res.status(500).json({ 
      error: err.message || 'A server error occurred',
      code: err.code || 'SERVER_ERROR'
    });
  });

  return { app, PORT };
}

// Only start the server if NOT running on Vercel (which uses the exported createServer)
if (!process.env.VERCEL) {
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  });

  createServer().then(({ app, PORT }) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
    });
    
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. This might happen during hot-reloads.`);
      } else {
        console.error('Server error:', err);
      }
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}
