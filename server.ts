import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Cloudinary Configuration
  const rawCloudinaryUrl = process.env.CLOUDINARY_URL;
  if (rawCloudinaryUrl) {
    // Trim and remove any accidental quotes
    let trimmedUrl = rawCloudinaryUrl.trim().replace(/^['"]|['"]$/g, '');
    
    // If user accidentally included the variable name in the value
    if (trimmedUrl.startsWith('CLOUDINARY_URL=')) {
      trimmedUrl = trimmedUrl.replace('CLOUDINARY_URL=', '').trim();
    }
    
    // Remove angle brackets if user literally pasted them from the documentation
    trimmedUrl = trimmedUrl.replace(/[<>]/g, '');
    
    if (trimmedUrl.startsWith('cloudinary://')) {
      try {
        cloudinary.config({
          cloudinary_url: trimmedUrl
        });
      } catch (error) {
        console.error("Cloudinary configuration error:", error);
      }
    } else {
      console.warn("CLOUDINARY_URL does not start with 'cloudinary://'. Skipping configuration.");
    }
  }

  const upload = multer({ storage: multer.memoryStorage() });

  // Cloudinary Upload Route
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!process.env.CLOUDINARY_URL) {
      console.warn("CLOUDINARY_URL is not configured, using mock for development.");
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
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // In-memory OTP storage (for production, use Redis or Firestore)
  const otpStore = new Map<string, { otp: string, expiresAt: number }>();

  // SMS Proxy Route for Textsasa
  app.post("/api/sms/send", async (req, res) => {
    const { recipient, message, phone } = req.body;
    const targetPhone = phone || recipient;
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
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });

    // Normalize phone number (Kenya specific for Talksasa)
    phone = phone.replace(/\s+/g, '').replace('+', '');
    if (phone.startsWith('0')) {
      phone = '254' + phone.substring(1);
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
      phone = '254' + phone;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(phone, { otp, expiresAt });
    console.log(`[OTP] Stored code for ${phone}: ${otp}`);

    const token = process.env.TEXTSASA_API_TOKEN || process.env.TALKSASA_API_TOKEN;
    const endpoint = process.env.TEXTSASA_API_ENDPOINT || process.env.TALKSASA_API_ENDPOINT || "https://api.textsasa.com/api/v1/";
    const senderId = process.env.TEXTSASA_SENDER_ID || process.env.TALKSASA_SENDER_ID || "ErrandRun";

    if (!token) {
      console.log(`[DEV] SMS API token not found. OTP for ${phone}: ${otp}`);
      return res.json({ success: true, message: "OTP sent (dev mode)" });
    }

    try {
      const fullUrl = endpoint.endsWith("/") ? `${endpoint}sms/send` : `${endpoint}/sms/send`;
      const message = `Your ErrandRunner verification code is: ${otp}. Valid for 10 minutes.`;

      console.log(`[OTP] Sending SMS to ${phone} via ${fullUrl}`);
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          recipient: phone, // For Talksasa
          phone: phone,     // For Textsasa
          message,
          sender_id: senderId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("SMS API error:", data);
        return res.status(response.status).json(data);
      }

      console.log(`[OTP] SMS sent successfully to ${phone}`);
      res.json({ success: true });
    } catch (error) {
      console.error("OTP Send error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  // OTP Verification
  app.post("/api/sms/verify/confirm", async (req, res) => {
    let { phone } = req.body;
    const { code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "Phone and code are required" });

    // Normalize phone number for lookup
    phone = phone.replace(/\s+/g, '').replace('+', '');
    if (phone.startsWith('0')) {
      phone = '254' + phone.substring(1);
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
      phone = '254' + phone;
    }

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

  // SMTP Email Route
  app.post("/api/email/send", async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "To, subject, and message are required" });
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      console.log(`[DEV] SMTP not configured. Email to ${to}: ${subject}`);
      return res.json({ success: true, message: "Email sent (dev mode)" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      console.log(`[Email] Sent to ${to}: ${subject}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Email Send error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Admin Download Env Route
  app.get("/api/admin/download-env", (req, res) => {
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
          "VITE_GOOGLE_MAPS_API_KEY", "CLOUDINARY_URL", 
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
