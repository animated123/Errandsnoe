import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import multer from "multer";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import cors from "cors";

async function getCloudinary() {
  const rawUrl = process.env.CLOUDINARY_URL;
  if (!rawUrl || rawUrl.trim() === "" || rawUrl.trim() === "CLOUDINARY_URL=") {
    return null;
  }

  let trimmedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, '').replace(/[<>]/g, '');
  if (trimmedUrl.startsWith('CLOUDINARY_URL=')) {
    trimmedUrl = trimmedUrl.replace('CLOUDINARY_URL=', '').trim();
  }

  if (!trimmedUrl.startsWith('cloudinary://')) {
    console.warn("Invalid CLOUDINARY_URL protocol. Skipping Cloudinary initialization.");
    // Temporarily delete it so the library doesn't crash on import
    const original = process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_URL;
    try {
      // This might still be needed if other parts of the app import it, 
      // but dynamic import is safer.
      return null;
    } finally {
      process.env.CLOUDINARY_URL = original;
    }
  }

  try {
    // Set the cleaned URL so the library finds it
    const original = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = trimmedUrl;
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloudinary_url: trimmedUrl
    });
    return cloudinary;
  } catch (error) {
    console.error("Failed to load Cloudinary:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Debug middleware for API routes
  app.use("/api", (req, res, next) => {
    console.log(`[API Debug] ${req.method} ${req.url}`);
    next();
  });

  const upload = multer({ storage: multer.memoryStorage() });

  // Cloudinary Upload Route
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const cloudinary = await getCloudinary();

    if (!cloudinary) {
      console.warn("Cloudinary is not configured or invalid, using mock for development.");
      // In development, we can return a mock URL if not configured
      return res.json({ url: "https://picsum.photos/seed/" + Math.random() + "/800/600" });
    }

    try {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const response = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
        folder: req.body.folder || "errand-runner"
      });
      res.json({ url: response.secure_url });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({ error: "Upload failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // In-memory OTP storage (for production, use Redis or Firestore)
  const otpStore = new Map<string, { otp: string, expiresAt: number }>();

  // Helper to normalize phone numbers for Kenya (Talksasa/Textsasa)
  const normalizePhone = (phone: string) => {
    if (!phone) return phone;
    let normalized = phone.replace(/\s+/g, '').replace('+', '');
    if (normalized.startsWith('0')) {
      normalized = '254' + normalized.substring(1);
    } else if (normalized.startsWith('7') || normalized.startsWith('1')) {
      normalized = '254' + normalized;
    }
    return normalized;
  };

  // SMS Proxy Route for Textsasa
  app.post("/api/sms/send", async (req, res) => {
    const { recipient, message, phone } = req.body;
    const targetPhone = normalizePhone(phone || recipient);
    const token = process.env.TEXTSASA_API_TOKEN || process.env.TALKSASA_API_TOKEN;
    const endpoint = process.env.TEXTSASA_API_ENDPOINT || process.env.TALKSASA_API_ENDPOINT || "https://api.textsasa.com/api/v1/";
    const senderId = process.env.TEXTSASA_SENDER_ID || process.env.TALKSASA_SENDER_ID || "ErrandRun";

    if (!token) {
      return res.status(500).json({ error: "SMS API token is not configured" });
    }

    if (!targetPhone || !message) {
      return res.status(400).json({ error: "Recipient and message are required" });
    }

    try {
      const fullUrl = endpoint.endsWith("/") ? `${endpoint}sms/send` : `${endpoint}/sms/send`;
      
      console.log(`[SMS] Sending to ${targetPhone} via ${fullUrl}`);
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          recipient: targetPhone, // For Talksasa
          phone: targetPhone,     // For Textsasa
          message,
          sender_id: senderId
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("SMS API error:", data);
        return res.status(response.status).json(data);
      }

      console.log(`[SMS] Success:`, data);
      res.json(data);
    } catch (error) {
      console.error("SMS Proxy error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // OTP Generation and Sending
  app.post("/api/sms/verify/send", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });

    // Normalize phone number (Kenya specific for Talksasa)
    const targetPhone = normalizePhone(phone);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(targetPhone, { otp, expiresAt });
    console.log(`[OTP] Stored code for ${targetPhone}: ${otp}`);

    const token = process.env.TEXTSASA_API_TOKEN || process.env.TALKSASA_API_TOKEN;
    const endpoint = process.env.TEXTSASA_API_ENDPOINT || process.env.TALKSASA_API_ENDPOINT || "https://api.textsasa.com/api/v1/";
    const senderId = process.env.TEXTSASA_SENDER_ID || process.env.TALKSASA_SENDER_ID || "ErrandRun";

    if (!token) {
      console.log(`[DEV] SMS API token not found. OTP for ${targetPhone}: ${otp}`);
      return res.json({ success: true, message: "OTP sent (dev mode)" });
    }

    try {
      const fullUrl = endpoint.endsWith("/") ? `${endpoint}sms/send` : `${endpoint}/sms/send`;
      const message = `Your ErrandRunner verification code is: ${otp}. Valid for 10 minutes.`;

      console.log(`[OTP] Sending SMS to ${targetPhone} via ${fullUrl}`);
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          recipient: targetPhone, // For Talksasa
          phone: targetPhone,     // For Textsasa
          message,
          sender_id: senderId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("SMS API error:", data);
        return res.status(response.status).json(data);
      }

      console.log(`[OTP] SMS sent successfully to ${targetPhone}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("OTP Send error:", error);
      res.status(500).json({ error: "Failed to send verification code", details: error.message });
    }
  });

  // OTP Verification
  app.post("/api/sms/verify/confirm", async (req, res) => {
    let { phone } = req.body;
    const { code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "Phone and code are required" });

    // Normalize phone number for lookup
    phone = normalizePhone(phone);

    console.log(`[OTP] Verifying code for ${phone}: ${code}`);
    const stored = otpStore.get(phone);
    if (!stored) {
      console.log(`[OTP] No code found for ${phone}`);
      return res.status(400).json({ error: "No verification code found for this number" });
    }

    if (Date.now() > stored.expiresAt) {
      console.log(`[OTP] Code expired for ${phone}`);
      otpStore.delete(phone);
      return res.status(400).json({ error: "Verification code has expired" });
    }

    if (stored.otp !== code) {
      console.log(`[OTP] Invalid code for ${phone}. Expected ${stored.otp}, got ${code}`);
      return res.status(400).json({ error: "Invalid verification code" });
    }

    console.log(`[OTP] Verification successful for ${phone}`);
    otpStore.delete(phone);
    res.json({ success: true });
  });

  // --- Email Service Singleton ---
  let smtpTransporter: nodemailer.Transporter | null = null;
  let resendClient: Resend | null = null;

  const getResendClient = () => {
    if (resendClient) return resendClient;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    resendClient = new Resend(apiKey);
    return resendClient;
  };

  const getSmtpTransporter = () => {
    if (smtpTransporter) return smtpTransporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    if (!host || !user || !pass) {
      return null;
    }

    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      requireTLS: port === 587
    });

    return smtpTransporter;
  };

  // Verify Email Service on startup
  const verifyEmailService = async () => {
    const resend = getResendClient();
    if (resend) {
      console.log(`[Email] Resend API configured and ready.`);
      return;
    }

    const transporter = getSmtpTransporter();
    if (transporter) {
      try {
        await transporter.verify();
        console.log(`[Email] SMTP Connection Verified: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
      } catch (error) {
        console.error(`[Email] SMTP Verification Failed:`, error);
      }
    } else {
      console.log(`[Email] Email service not configured. Running in MOCK/DEV mode.`);
    }
  };
  verifyEmailService();

  // Email Route
  app.post("/api/email/send", async (req, res) => {
    try {
      console.log(`[Email] Received request to /api/email/send`);
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "To, subject, and message are required" });
    }

    const resend = getResendClient();
    const transporter = getSmtpTransporter();
    
    // Resend is very strict about the 'from' address.
    // If you haven't verified a domain, you MUST use 'onboarding@resend.dev'.
    // We prioritize SMTP_FROM if it looks like a custom domain email.
    let from = process.env.SMTP_FROM || "onboarding@resend.dev";
    
    // If SMTP_FROM is not set, but SMTP_USER is, we check if SMTP_USER is a public email (gmail, etc)
    // Resend won't allow sending from public domains without verification.
    if (!process.env.SMTP_FROM && process.env.SMTP_USER) {
      const publicDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];
      const isPublic = publicDomains.some(domain => process.env.SMTP_USER?.toLowerCase().endsWith(domain));
      if (isPublic) {
        from = "onboarding@resend.dev";
      } else {
        from = process.env.SMTP_USER;
      }
    }

    // Final safety check for Resend
    if (resend && (!from || !from.includes("@") || from.includes("example.com"))) {
      from = "onboarding@resend.dev";
    }

    // Try Resend first
    if (resend) {
      try {
        console.log(`[Email] Attempting to send to ${to} via Resend (from: ${from})...`);
        const { data, error } = await resend.emails.send({
          from: from,
          to: to,
          subject: subject,
          text: text || "",
          html: html || "",
        });

        if (error) {
          console.error("[Email] Resend API Error:", JSON.stringify(error, null, 2));
          // If it's a validation error, it's almost certainly the 'from' address
          if (error.name === 'validation_error') {
            throw new Error(`Resend Validation Error: The 'from' address (${from}) or 'to' address (${to}) is invalid. If you haven't verified a domain in Resend, you MUST use 'onboarding@resend.dev' as the sender.`);
          }
          throw error;
        }

        console.log(`[Email] Sent successfully via Resend to ${to}. Id: ${data?.id}`);
        return res.json({ 
          success: true, 
          messageId: data?.id,
          details: `Sent via Resend API`
        });
      } catch (error: any) {
        console.error("[Email] Resend error:", error);
        // Fallback to SMTP if configured, otherwise error
        if (!transporter) {
          return res.status(500).json({ error: "Resend failed and no SMTP fallback", details: error.message });
        }
      }
    }

    // Fallback to SMTP
    if (transporter) {
      try {
        console.log(`[Email] Attempting to send to ${to} via SMTP...`);
        const info = await transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });

        console.log(`[Email] Sent successfully via SMTP to ${to}. MessageId: ${info.messageId}`);
        return res.json({ 
          success: true, 
          messageId: info.messageId,
          details: `Sent via ${process.env.SMTP_HOST}`
        });
      } catch (error: any) {
        console.error("[Email] SMTP error:", error);
        return res.status(500).json({ 
          error: "Failed to send email via SMTP", 
          details: error.message
        });
      }
    }

    // Mock mode
    console.log(`[DEV] No email service configured. Email to ${to}: ${subject}`);
    return res.json({ 
      success: true, 
      message: "Email sent (MOCK/DEV MODE - No email service configured)",
      isMock: true 
    });

  } catch (error: any) {
    console.error(`[Email] Route error:`, error);
    res.status(500).json({ error: "Email route error", details: error.message });
  }
});

  // Admin Test Email Route
  app.post("/api/admin/test-email", async (req, res) => {
    try {
      const { to } = req.body;
      if (!to) return res.status(400).json({ error: "Recipient email is required" });

      const resend = getResendClient();
      const transporter = getSmtpTransporter();
      
      if (!resend && !transporter) {
        return res.status(400).json({ error: "Email service is not configured. Check your .env variables (RESEND_API_KEY or SMTP_*)." });
      }

      let from = process.env.SMTP_FROM || "onboarding@resend.dev";
      if (!process.env.SMTP_FROM && process.env.SMTP_USER) {
        const publicDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];
        const isPublic = publicDomains.some(domain => process.env.SMTP_USER?.toLowerCase().endsWith(domain));
        from = isPublic ? "onboarding@resend.dev" : process.env.SMTP_USER;
      }
      
      if (resend && (!from || !from.includes("@"))) {
        from = "onboarding@resend.dev";
      }

      const subject = "Errand Runner App - Email Test";
      const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Email Configuration Test</h2>
            <p>This is a test email to verify your email configuration for the <strong>Errand Runner App</strong>.</p>
            <p style="background: #f9fafb; padding: 15px; border-radius: 8px; font-size: 14px;">
              If you are reading this, your email settings are <strong>working correctly!</strong>
            </p>
            <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
              Sent via: ${resend ? 'Resend API' : 'SMTP'} at ${new Date().toLocaleString()}
            </p>
          </div>
        `;

      if (resend) {
        try {
          console.log(`[Admin] Sending test email via Resend (from: ${from}, to: ${to})`);
          const { data, error } = await resend.emails.send({
            from,
            to,
            subject,
            html
          });
          if (error) {
            console.error("[Admin] Resend API Error:", JSON.stringify(error, null, 2));
            if (error.name === 'validation_error') {
              throw new Error(`Resend Validation Error: The 'from' address (${from}) is likely not verified. If you are on the free tier, you MUST use 'onboarding@resend.dev'.`);
            }
            throw error;
          }
          return res.json({ success: true, message: "Test email sent successfully via Resend API", details: data?.id });
        } catch (err: any) {
          console.error("[Admin] Resend test failed:", err);
          return res.status(500).json({ 
            error: "Resend API Error", 
            details: err.message || "Unknown error",
            hint: "Check if your 'from' address is verified in Resend. Free accounts MUST use 'onboarding@resend.dev'. Also ensure the recipient email is valid.",
            raw: err
          });
        }
      }

      if (transporter) {
        await transporter.sendMail({
          from,
          to,
          subject,
          html
        });
        return res.json({ success: true, message: "Test email sent successfully via SMTP" });
      }

      res.status(400).json({ error: "No email service available" });
    } catch (error: any) {
      console.error("[Admin] Test email failed:", error);
      res.status(500).json({ error: "Failed to send test email", details: error.message });
    }
  });

  // Admin Download Env Route
  app.get(["/api/admin/download-env", "/api/admin/export-env"], (req, res) => {
    const envPath = path.join(process.cwd(), ".env");
    
    if (fs.existsSync(envPath)) {
      res.download(envPath, ".env");
    } else {
      // If .env doesn't exist on disk, generate it from process.env based on .env.example
      const examplePath = path.join(process.cwd(), ".env.example");
      let envContent = "";
      
      if (fs.existsSync(examplePath)) {
        const exampleContent = fs.readFileSync(examplePath, "utf-8");
        const lines = exampleContent.split("\n");
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const [key] = trimmed.split("=");
            if (key && process.env[key]) {
              envContent += `${key}=${process.env[key]}\n`;
            } else {
              envContent += line + "\n";
            }
          } else {
            envContent += line + "\n";
          }
        }
      } else {
        // Fallback: just list all common app variables
        const commonKeys = [
          "VITE_GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_PLACES_API_KEY", "VITE_GOOGLE_ROUTES_API_KEY",
          "CLOUDINARY_URL", 
          "TEXTSASA_API_TOKEN", "TEXTSASA_API_ENDPOINT", "TEXTSASA_SENDER_ID",
          "TALKSASA_API_TOKEN", "TALKSASA_API_ENDPOINT", "TALKSASA_SENDER_ID",
          "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"
        ];
        for (const key of commonKeys) {
          if (process.env[key]) {
            envContent += `${key}=${process.env[key]}\n`;
          }
        }
      }
      
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", "attachment; filename=.env");
      res.send(envContent);
    }
  });

  // API 404 Handler - MUST be before Vite middleware
  app.all("/api/*all", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
