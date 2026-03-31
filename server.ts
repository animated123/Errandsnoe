import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import multer from "multer";
import nodemailer from "nodemailer";
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

  // --- SMTP Transporter Singleton ---
  let smtpTransporter: nodemailer.Transporter | null = null;

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

  // Verify SMTP on startup
  const verifySmtp = async () => {
    const transporter = getSmtpTransporter();
    if (transporter) {
      try {
        await transporter.verify();
        console.log(`[Email] SMTP Connection Verified: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
      } catch (error) {
        console.error(`[Email] SMTP Verification Failed:`, error);
      }
    } else {
      console.log(`[Email] SMTP not configured. Running in MOCK/DEV mode.`);
    }
  };
  verifySmtp();

  // SMTP Email Route
  app.post("/api/email/send", async (req, res) => {
    try {
      console.log(`[Email] Received request to /api/email/send`);
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "To, subject, and message are required" });
    }

    const transporter = getSmtpTransporter();
    const user = process.env.SMTP_USER;
    const from = process.env.SMTP_FROM || user;

    if (!transporter) {
      console.log(`[DEV] SMTP not configured. Email to ${to}: ${subject}`);
      return res.json({ 
        success: true, 
        message: "Email sent (MOCK/DEV MODE - SMTP not configured)",
        isMock: true 
      });
    }

    try {
      console.log(`[Email] Attempting to send to ${to} via ${process.env.SMTP_HOST}...`);
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      console.log(`[Email] Sent successfully to ${to}. MessageId: ${info.messageId}`);
      res.json({ 
        success: true, 
        messageId: info.messageId,
        details: `Sent via ${process.env.SMTP_HOST}`
      });
    } catch (error: any) {
      console.error("[Email] Error sending email:", error);
      res.status(500).json({ 
        error: "Failed to send email", 
        details: error.message,
        code: error.code,
        command: error.command
      });
    }
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

      const transporter = getSmtpTransporter();
      if (!transporter) {
        return res.status(400).json({ error: "SMTP is not configured. Check your .env variables." });
      }

      const from = process.env.SMTP_FROM || process.env.SMTP_USER;
      
      await transporter.sendMail({
        from,
        to,
        subject: "Errand Runner App - SMTP Test Email",
        text: "This is a test email to verify your SMTP configuration. If you received this, your email settings are working correctly!",
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">SMTP Configuration Test</h2>
            <p>This is a test email to verify your SMTP configuration for the <strong>Errand Runner App</strong>.</p>
            <p style="background: #f9fafb; padding: 15px; border-radius: 8px; font-size: 14px;">
              If you are reading this, your email settings are <strong>working correctly!</strong>
            </p>
            <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        `
      });

      res.json({ success: true, message: "Test email sent successfully" });
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
