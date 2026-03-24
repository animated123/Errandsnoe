import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

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

  // SMS Proxy Route for Talksasa
  app.post("/api/sms/send", async (req, res) => {
    const { recipient, message } = req.body;
    const token = process.env.TALKSASA_API_TOKEN;
    const endpoint = process.env.TALKSASA_API_ENDPOINT || "https://bulksms.talksasa.com/api/v3/";
    const senderId = process.env.TALKSASA_SENDER_ID || "ErrandRun";

    if (!token) {
      return res.status(500).json({ error: "TALKSASA_API_TOKEN is not configured" });
    }

    if (!recipient || !message) {
      return res.status(400).json({ error: "Recipient and message are required" });
    }

    try {
      // Talksasa API usually expects a POST to /sms/send or similar
      // We'll use the endpoint provided and append sms/send if it's just the base
      const fullUrl = endpoint.endsWith("/") ? `${endpoint}sms/send` : `${endpoint}/sms/send`;
      
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          recipient,
          message,
          sender_id: senderId
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Talksasa API error:", data);
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error) {
      console.error("SMS Proxy error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
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
