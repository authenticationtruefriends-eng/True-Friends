import 'dotenv/config'; // Load env vars before anything else
import express from "express";
import http from "http";
import https from "https";
import cors from "cors";
import { Server } from "socket.io";
import { ExpressPeerServer } from 'peer';
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
// import dotenv from "dotenv"; // Removed as we preload now
import { handleGiphyRequest } from './gif-handler.js';
import { generateAIResponse } from './ai-bot.js';
import { decryptMessage, encryptMessage } from './encryption.js';
import { ensureAIImagesDir } from './ai-image-proxy.js';
import crypto from "crypto";
import multer from "multer";
import jwt from "jsonwebtoken"; // Fix ReferenceError
import { v2 as cloudinary } from 'cloudinary';
import pkg from 'multer-storage-cloudinary';
const { CloudinaryStorage } = pkg;

import { google } from "googleapis";
import mongoose from 'mongoose';
import User from './models/User.js';
import Message from './models/Message.js';
import Group from './models/Group.js';

// --- MONGO DB CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/true-friends';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB isolated database'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));
// ----------------------------


// dotenv.config(); // Loaded at start
const app = express();

process.on('uncaughtException', (err) => {
  console.error('💥 CRITICAL ERROR (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 CRITICAL ERROR (Unhandled Rejection):', reason);
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins for now to ensure connectivity, but with specific reflection to support credentials
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
// Increase limits to support large file uploads (10GB)
app.use(express.json({ limit: "10gb" }));
app.use(express.urlencoded({ extended: true, limit: "10gb" }));

const SECRET_KEY = process.env.SECRET_KEY || "true_friends_secret_key_2024";

// --- Gmail API (OAuth2) Config ---
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID?.trim();
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET?.trim();
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN?.trim();
const GMAIL_USER = process.env.GMAIL_USER?.trim() || process.env.EMAIL_USER?.trim();

let transporter;

try {
  if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
    console.log("📧 Configuring Gmail API (OAuth2)...");
    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: GMAIL_REFRESH_TOKEN
    });

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: GMAIL_USER,
        clientId: GMAIL_CLIENT_ID,
        clientSecret: GMAIL_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN
      }
    });
  } else {
    // Fallback to legacy SMTP (Works locally, but not on Railway)
    console.warn("⚠️ GMAIL API credentials missing. Falling back to SMTP (Local Mode)...");
    const SMTP_PORT = process.env.SMTP_PORT || 587;
    const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // Set to true for 465

    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_PASS?.trim().replace(/\s/g, "")
      },
      tls: {
        rejectUnauthorized: false
      },
      family: 4,
      pool: true
    });
  }

  // Test Connection
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ EMAIL SERVICE BOOT ERROR:", error.message);
    } else {
      console.log("✅ Email service is READY (via " + (GMAIL_CLIENT_ID ? "Gmail API" : "SMTP") + ")");
    }
  });
} catch (err) {
  console.error("❌ FATAL ERROR setting up email transporter:", err.message);
}

const otpStore = new Map();

// --- Multer Config ---
const uploadDir = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Initialize AI images directory
ensureAIImagesDir();

// --- Cloudinary Config ---
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim();
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim();

let upload;

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  console.log("☁️ Configuring Cloudinary Storage...");
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });

  const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'true-friends',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'enc'],
      resource_type: 'auto'
    }
  });
  upload = multer({
    storage: cloudinaryStorage,
    limits: { fileSize: Infinity }
  });
} else {
  console.warn("⚠️ Cloudinary credentials missing. Using local storage Fallback...");
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  upload = multer({
    storage: storage,
    limits: { fileSize: Infinity }
  });
}

app.use('/uploads', (req, res, next) => {
  console.log(`📁 Static file request: ${req.url}`);
  next();
}, express.static(uploadDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    // Explicitly set content type for common extensions if not correctly guessed
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// --- Data Stores ---
const onlineUsers = new Map(); // uid -> socketId
let verificationStore = new Map();

// Password Reset & Rate Limiting Stores
const passwordResetStore = new Map(); // email -> { otpHash, expiresAt, attempts, resetToken, resetTokenExpiry }
const otpRequestLimitStore = new Map(); // email -> { count, lastRequestTime, lockedUntil }
const otpVerifyLimitStore = new Map(); // email -> { attempts, lockedUntil }
const loginAttemptStore = new Map(); // username/email -> { failedAttempts, lockedUntil, timeoutLevel }

app.get('/test-upload', (req, res) => {
  const files = fs.readdirSync(uploadDir);
  res.json({ uploadDir, files, testUrl: files.length > 0 ? `/uploads/${files[0]}` : 'No files yet' });
});

app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Sanitize filename for the URL even if disk storage has a unique one
  const safeFilename = encodeURIComponent(req.file.filename);

  res.json({
    success: true,
    url: `/uploads/${safeFilename}`,
    fileName: req.file.originalname
  });
});

const chunkDir = path.join(process.cwd(), 'temp_chunks');
if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });

app.post("/api/upload-encrypted", async (req, res) => {
  try {
    const fileData = req.body;
    if (!fileData || (!fileData.content && !fileData.encryptedData)) {
      return res.status(400).json({ error: "Invalid payload: Missing encryptedData" });
    }

    const rawData = fileData.encryptedData || fileData.content;
    const originalName = fileData.originalName || "encrypted_file";
    const iv = fileData.iv;
    const version = fileData.version || 'v1';

    if (CLOUDINARY_CLOUD_NAME) {
      const base64Content = Buffer.from(rawData).toString('base64');
      const uploadResponse = await cloudinary.uploader.upload(`data:application/octet-stream;base64,${base64Content}`, {
        resource_type: 'raw',
        folder: 'true-friends/encrypted',
        public_id: `${Date.now()}-${originalName.replace(/\./g, '_')}`
      });

      return res.json({
        success: true,
        url: uploadResponse.secure_url,
        fileName: originalName,
        encrypted: true,
        iv,
        version
      });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize extension and base filename
    const safeExt = path.extname(originalName).replace(/[^a-z0-9.]/gi, '').toLowerCase() || '.enc';
    const filename = uniqueSuffix + safeExt;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, rawData, 'utf8');
    res.json({
      success: true,
      url: `/uploads/${filename}`,
      fileName: originalName,
      encrypted: true,
      iv,
      version
    });
  } catch (error) {
    console.error("Encrypted upload failed:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// --- Chunked Upload API ---

app.post("/api/upload-chunk", (req, res) => {
  try {
    const { fileId, chunkIndex, totalChunks, data } = req.body;

    if (!fileId || chunkIndex === undefined || !data) {
      console.error(`❌ Upload Chunk Error: Missing data`, { fileId, chunkIndex });
      return res.status(400).json({ error: "Missing chunk data" });
    }

    const fileChunkDir = path.join(chunkDir, fileId);
    if (!fs.existsSync(fileChunkDir)) fs.mkdirSync(fileChunkDir, { recursive: true });

    const chunkPath = path.join(fileChunkDir, `chunk_${chunkIndex}`);
    // Write synchronous to ensure order/lock (could be async but risk race conditions if not handled)
    fs.writeFileSync(chunkPath, Buffer.from(data, 'base64'));

    console.log(`✅ Chunk ${chunkIndex}/${totalChunks} saved for ${fileId}`);
    res.json({ success: true, message: `Chunk ${chunkIndex} saved` });
  } catch (error) {
    console.error("❌ Upload Chunk Fatal Error:", error);
    res.status(500).json({ error: "Chunk upload failed: " + error.message });
  }
});

app.post("/api/upload-finalize", async (req, res) => {
  const { fileId, totalChunks, fileName, iv, version } = req.body;

  if (!fileId || !totalChunks || !fileName) {
    return res.status(400).json({ error: "Missing finalization data" });
  }

  const fileChunkDir = path.join(chunkDir, fileId);
  // SANITIZE FILENAME: Remove spaces, special chars, keep only alphanumeric, dots, dashes
  const sanitizedName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const finalFilename = `${Date.now()}-${sanitizedName}.enc`;
  const finalPath = path.join(uploadDir, finalFilename);

  const writeStream = fs.createWriteStream(finalPath);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(fileChunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) throw new Error(`Missing chunk ${i}`);

      const chunkData = fs.readFileSync(chunkPath);

      // Handle backpressure
      if (!writeStream.write(chunkData)) {
        await new Promise(resolve => writeStream.once('drain', resolve));
      }

      fs.unlinkSync(chunkPath); // Clean up chunk
    }
    writeStream.end();

    // Wait for stream to finish writing
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Clean up directory
    fs.rmdirSync(fileChunkDir);

    res.json({
      success: true,
      url: `/uploads/${finalFilename}`,
      fileName,
      encrypted: true,
      iv,
      version: version || 'v2'
    });

  } catch (error) {
    console.error("Finalization failed:", error);
    res.status(500).json({ error: "Finalization failed: " + error.message });
  }
});

// Duplicate endpoint removed as it's merged into the one above

// Get user profile by ID
app.get("/api/user/profile/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ uid: userId.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return user profile data
    res.json({
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      friendCode: user.friendCode,
      bio: user.bio,
      phone: user.phone,
      birthday: user.birthday,
      location: user.location,
      joinedAt: user.joinedAt
    });
  } catch (error) {
    console.error("❌ Profile Fetch Error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// --- Proxy: Giphy API (Fixes CORS/Network Block issues) ---
app.get("/api/proxy-image", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();

  // Security: Only allow Giphy URLs
  try {
    const targetObj = new URL(url);
    if (!targetObj.hostname.includes("giphy.com")) {
      return res.status(403).send("Forbidden proxy target");
    }

    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
      rejectUnauthorized: false // Bypass SSL errors for restricted networks
    };

    https.get(url, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }).on('error', (e) => {
      console.error("Proxy Image Error:", e.message);
      res.status(502).end();
    });
  } catch (e) {
    res.status(400).end();
  }
});

// 🚀 UNIVERSAL GIF ENDPOINT - Works on ANY Network (WiFi, Hotspot, Corporate, etc.)
app.get("/api/giphy", handleGiphyRequest);

// --- Auth Endpoints ---

// Helper: Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Verification Store: { email -> { otp, expiresAt, userData } }
// Moved to top for persistence


// Helper: Send Email



// Helper: Generic Send Email
const sendEmail = async (to, subject, text, html) => {
  try {
    const mailOptions = {
      from: `"True Friends" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error("❌ Send Email Error:", error);
    return false;
  }
};

// Helper: Send Verification Email
const sendVerificationEmail = async (email, otp) => {
  console.log(`📧 Preparing to send OTP ${otp} to ${email}`);

  const subject = "Your Verification Code - True Friends";
  const textContent = `Welcome to True Friends! Your verification code is: ${otp}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #6c5ce7;">True Friends Verification</h2>
      <p>You are just one step away from joining.</p>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
    </div>
  `;



  // 2. Fallback to Nodemailer (Localhost/Gmail)
  try {
    const mailOptions = {
      from: `"True Friends" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Gmail/SMTP Email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ NODEMAILER FATAL ERROR:");
    console.error("   Command:", error.command);
    console.error("   Response:", error.response);
    console.error("   ResponseCode:", error.responseCode);
    console.error("   Code:", error.code);
    console.error("   Stack:", error.stack);
    return false;
  }
};



// API: Check Username Availability
app.get("/api/check-username", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ available: false });
  const uid = String(username).replace(/\s+/g, '_').toLowerCase();

  try {
    const existingUser = await User.findOne({ uid });
    // A username is ONLY "taken" if a VERIFIED user owns it or if it exists in DB (we assume DB users are verified or in transition)
    res.json({ available: !existingUser });
  } catch (error) {
    res.json({ available: false });
  }
});

// API: Signup (Step 1 - Send OTP)
app.post("/api/signup", async (req, res) => {
  let { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ success: false, error: "All fields are required" });
  }

  username = username.trim();
  email = email.trim();
  const normalizedEmail = email.toLowerCase();
  const uid = username.replace(/\s+/g, '_').toLowerCase();

  try {
    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ $or: [{ uid }, { email: normalizedEmail }] });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Username or Email already registered" });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Store temporarily in memory (transient)
    verificationStore.set(normalizedEmail, {
      otp,
      expiresAt,
      userData: { username, password, email: normalizedEmail, uid }
    });

    sendVerificationEmail(normalizedEmail, otp);
    res.json({ success: true, message: "Verification code sent to email", step: "verify" });

  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// API: Resend OTP
app.post("/api/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email required" });

  const normalizedEmail = email.toLowerCase();
  const record = verificationStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ success: false, error: "No pending verification found. Please signup again." });
  }

  const otp = generateOTP();
  record.otp = otp;
  record.expiresAt = Date.now() + 10 * 60 * 1000;
  verificationStore.set(normalizedEmail, record);

  const emailSent = await sendVerificationEmail(normalizedEmail, otp);
  if (emailSent) {
    res.json({ success: true, message: "Code resent" });
  } else {
    res.status(500).json({ success: false, error: "Failed to send email. Please try again in a moment." });
  }
});

// API: Verify OTP (Step 2 - Create Account)
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email is required" });
  const normalizedEmail = String(email).trim().toLowerCase();
  const record = verificationStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ success: false, error: "Invalid or expired verification session" });
  }

  if (Date.now() > record.expiresAt) {
    verificationStore.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: "Verification code expired" });
  }

  if (String(record.otp).trim() !== String(otp).trim()) {
    return res.status(400).json({ success: false, error: "Incorrect verification code" });
  }

  try {
    // Success! Create the user in MongoDB
    const { userData } = record;
    const { uid, username, password } = userData;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = new User({
      uid: uid,
      displayName: username,
      email: userData.email,
      passwordHash: passwordHash,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      friendCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      bio: "Hi there! I am using True Friends.",
      joinedAt: Date.now(),
      isOnboarded: false
    });

    await newUser.save();
    verificationStore.delete(normalizedEmail);

    console.log(`👤 New User Signed Up (Verified): ${username} (${uid})`);

    const token = jwt.sign({ uid, name: username }, SECRET_KEY, { expiresIn: "7d" });
    res.json({ success: true, token, user: newUser });

  } catch (error) {
    console.error("❌ Verify OTP Error:", error);
    res.status(500).json({ success: false, error: "Error creating user" });
  }
});

// Rate Limiting Store (Moved to Global Scope)
const loginAttemptsStore = new Map(); // Username/Email -> { attempts, lockoutLevel, lastLockoutDuration, lockedUntil }

// Helper: Calculate Lockout Duration (Squared Growth)
const getLockoutDuration = (level, lastDuration) => {
  if (level === 1) return 1; // 1st lockout: 1 hour
  if (level === 2) return 2; // 2nd lockout: 2 hours
  return lastDuration * lastDuration;
};

// API: Cancel Signup Verification (Invalidate OTP)
app.post("/api/cancel-signup", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email required" });

  const normalizedEmail = String(email).trim().toLowerCase();

  if (verificationStore.has(normalizedEmail)) {
    verificationStore.delete(normalizedEmail); // Delete OTP
    console.log(`🚫 Signup cancelled for ${normalizedEmail}. OTP invalidated.`);
  }

  res.json({ success: true, message: "Verification cancelled" });
});

// API: Cancel Password Reset (Invalidate OTP)
app.post("/api/cancel-reset", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email required" });

  const normalizedEmail = String(email).trim().toLowerCase();

  if (passwordResetStore.has(normalizedEmail)) {
    passwordResetStore.delete(normalizedEmail); // Delete OTP
    console.log(`🚫 Password reset cancelled for ${normalizedEmail}. OTP invalidated.`);
  }

  res.json({ success: true, message: "Reset cancelled" });
});

// ===== PASSWORD RESET ENDPOINTS =====

// API: Forgot Password (Step 1 - Request OTP)
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ success: false, error: "Valid email is required" });
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user exists in MongoDB
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    console.log(`❌ Forgot Password: User not found for email '${normalizedEmail}'`);
    return res.status(404).json({ success: false, error: "User not found" });
  }

  // Rate Limiting: Check if locked out
  const limitRecord = otpRequestLimitStore.get(normalizedEmail);
  if (limitRecord?.lockedUntil && Date.now() < limitRecord.lockedUntil) {
    return res.status(429).json({
      success: false,
      error: "Maximum OTP requests reached",
      lockedUntil: limitRecord.lockedUntil
    });
  }

  // Rate Limiting: Check 30-second cooldown
  if (limitRecord?.lastRequestTime) {
    const timeSinceLastRequest = Date.now() - limitRecord.lastRequestTime;
    if (timeSinceLastRequest < 30000) { // 30 seconds
      return res.status(429).json({
        success: false,
        error: "Please wait before requesting another OTP",
        retryAfter: Math.ceil((30000 - timeSinceLastRequest) / 1000)
      });
    }
  }

  // Rate Limiting: Track request count
  const currentCount = (limitRecord?.count || 0) + 1;
  if (currentCount > 3) {
    // Lock for 24 hours
    const lockedUntil = Date.now() + (24 * 60 * 60 * 1000);
    otpRequestLimitStore.set(normalizedEmail, {
      count: currentCount,
      lastRequestTime: Date.now(),
      lockedUntil
    });
    return res.status(429).json({
      success: false,
      error: "Maximum OTP requests reached. Try again in 24 hours",
      lockedUntil
    });
  }

  // Update rate limit record
  otpRequestLimitStore.set(normalizedEmail, {
    count: currentCount,
    lastRequestTime: Date.now(),
    lockedUntil: limitRecord?.lockedUntil
  });

  // Generate 6-digit OTP
  const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(resetOtp).digest('hex');

  // Store OTP (expires in 10 minutes)
  passwordResetStore.set(normalizedEmail, {
    otpHash,
    expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
    attempts: 0,
    createdAt: Date.now()
  });

  // Send OTP email
  const emailSent = await sendEmail(
    normalizedEmail,
    "Password Reset OTP - True Friends",
    `Your password reset OTP is: ${resetOtp}\n\nThis code expires in 10 minutes.`,
    `<h2>Password Reset OTP</h2><p>Your OTP is: <strong>${resetOtp}</strong></p><p>This code expires in 10 minutes.</p>`
  );

  if (!emailSent) {
    return res.status(500).json({ success: false, error: "Failed to send OTP email" });
  }

  console.log(`📧 Password reset OTP sent to ${normalizedEmail}`);
  res.json({ success: true, message: "OTP sent to email" });
});

// API: Verify Reset OTP (Step 2 - Verify OTP)
app.post("/api/verify-reset-otp", (req, res) => {
  const { email, otp: resetOtpInput } = req.body;
  if (!email || typeof email !== 'string' || !resetOtpInput) {
    return res.status(400).json({ success: false, error: "Email and OTP are required" });
  }

  const normalizedResetEmail = email.trim().toLowerCase();

  // Check if locked out
  const verifyLimit = otpVerifyLimitStore.get(normalizedResetEmail);
  if (verifyLimit?.lockedUntil && Date.now() < verifyLimit.lockedUntil) {
    return res.status(429).json({
      success: false,
      error: "Too many failed attempts",
      lockedUntil: verifyLimit.lockedUntil
    });
  }

  // Get reset record
  const resetRecord = passwordResetStore.get(normalizedResetEmail);
  if (!resetRecord) {
    return res.status(400).json({ success: false, error: "No password reset request found" });
  }

  // Check expiration
  if (Date.now() > resetRecord.expiresAt) {
    passwordResetStore.delete(normalizedResetEmail);
    return res.status(400).json({ success: false, error: "OTP expired. Please request a new one" });
  }

  // Verify OTP
  const otpHash = crypto.createHash('sha256').update(resetOtpInput.trim()).digest('hex');
  if (otpHash !== resetRecord.otpHash) {
    // Increment attempts
    resetRecord.attempts += 1;
    passwordResetStore.set(normalizedResetEmail, resetRecord);

    // Check if max attempts reached
    if (resetRecord.attempts >= 5) {
      // Lock for 24 hours
      const lockedUntil = Date.now() + (24 * 60 * 60 * 1000);
      otpVerifyLimitStore.set(normalizedResetEmail, { attempts: 5, lockedUntil });
      passwordResetStore.delete(normalizedResetEmail);

      return res.status(429).json({
        success: false,
        error: "Too many failed attempts. Account locked for 24 hours",
        lockedUntil
      });
    }

    return res.status(400).json({
      success: false,
      error: "Invalid OTP",
      attemptsRemaining: 5 - resetRecord.attempts
    });
  }

  // OTP verified! Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Update record with reset token (expires in 5 minutes)
  resetRecord.resetToken = resetTokenHash;
  resetRecord.resetTokenExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
  passwordResetStore.set(normalizedResetEmail, resetRecord);

  // Clear rate limits on successful verification
  otpVerifyLimitStore.delete(normalizedResetEmail);

  console.log(`✅ Password reset OTP verified for ${normalizedResetEmail}`);
  res.json({
    success: true,
    resetToken, // Send unhashed token to frontend
    expiresIn: 300 // 5 minutes in seconds
  });
});

// API: Reset Password (Step 3 - Set New Password)
app.post("/api/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ success: false, error: "Reset token and new password are required" });
  }

  // Hash the token to find the record
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Find the reset record by token
  let targetEmail = null;
  for (const [email, record] of passwordResetStore.entries()) {
    if (record.resetToken === resetTokenHash) {
      targetEmail = email;
      break;
    }
  }
  const resetRecord = passwordResetStore.get(targetEmail);



  // Check token expiration
  if (Date.now() > resetRecord.resetTokenExpiry) {
    passwordResetStore.delete(targetEmail);
    return res.status(400).json({ success: false, error: "Reset token expired" });
  }

  // Find user and update password in MongoDB
  const user = await User.findOne({ email: targetEmail.toLowerCase() });
  if (!user) {
    return res.status(400).json({ success: false, error: "User not found" });
  }

  // Update password
  const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  user.passwordHash = newPasswordHash;
  await user.save();

  // Cleanup
  passwordResetStore.delete(targetEmail);
  otpRequestLimitStore.delete(targetEmail);
  otpVerifyLimitStore.delete(targetEmail);

  console.log(`🔐 Password reset successful in DB for ${targetEmail}`);
  res.json({ success: true, message: "Password reset successful" });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password required" });
  }

  const identifier = username.trim().toLowerCase();
  const normalizedUid = identifier.replace(/\s+/g, '_');

  // 1. CHECK LOCKOUT (In-memory is fine for rate-limiting, but DB is better for production)
  const record = loginAttemptsStore.get(identifier) || { attempts: 0, lockoutLevel: 0, lastLockoutDuration: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    return res.status(429).json({
      success: false,
      error: `Too many attempts. Account locked.`,
      lockedUntil: record.lockedUntil
    });
  }

  // 2. CHECK CREDENTIALS in MongoDB
  try {
    const user = await User.findOne({
      $or: [{ uid: normalizedUid }, { email: identifier }]
    });

    let isAuthenticated = false;
    if (user && user.passwordHash) {
      const inputHash = crypto.createHash('sha256').update(password).digest('hex');
      if (user.passwordHash === inputHash) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      record.attempts += 1;
      const maxAttempts = 5;
      if (record.attempts >= maxAttempts) {
        record.lockoutLevel += 1;
        const durationHours = getLockoutDuration(record.lockoutLevel, record.lastLockoutDuration);
        record.lockedUntil = Date.now() + (durationHours * 60 * 60 * 1000);
        record.attempts = 0;
        loginAttemptsStore.set(identifier, record);
        return res.status(429).json({ success: false, error: "Account locked.", lockedUntil: record.lockedUntil });
      }
      loginAttemptsStore.set(identifier, record);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // 4. HANDLE SUCCESS
    loginAttemptsStore.delete(identifier);
    const token = jwt.sign({ uid: user.uid, name: user.displayName }, SECRET_KEY, { expiresIn: "7d" });
    res.json({ success: true, token, user });

  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});



// Redundant routes removed in favor of consolidated /api/signup and /api/verify-otp

// Redundant verification route removed

// --- Server Setup ---
const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
  allow_discovery: true,
  corsOptions: { origin: '*', methods: 'GET,POST,PUT,DELETE,OPTIONS' }
});

app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`📶 Peer Connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`🔌 Peer Disconnected: ${client.getId()}`);
});

const io = new Server(server, {
  maxHttpBufferSize: 5e7,
  cors: { origin: "*", methods: ["GET", "POST"] }
});


// Duplicate data store initialization removed



// --- API: User Search & Update ---
app.post("/api/user/update-friend-id", async (req, res) => {
  const { userId, newId } = req.body;
  if (!userId || !newId) return res.status(400).json({ success: false });

  const normalizedUid = String(userId).toLowerCase();
  let cleanId = newId.trim();
  if (!cleanId.startsWith("@")) cleanId = "@" + cleanId;

  try {
    const alreadyTaken = await User.findOne({
      friendCode: { $regex: new RegExp(`^${cleanId}$`, "i") },
      uid: { $ne: normalizedUid }
    });

    if (alreadyTaken) return res.status(400).json({ success: false, error: "ID taken" });

    const user = await User.findOneAndUpdate(
      { uid: normalizedUid },
      { friendCode: cleanId },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false });

    res.json({ success: true, newId: cleanId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/user/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const normalized = userId.toLowerCase();

  try {
    const user = await User.findOne({ uid: normalized });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      success: true,
      user: {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        friendCode: user.friendCode,
        bio: user.bio,
        phone: user.phone,
        birthday: user.birthday,
        location: user.location,
        joinedAt: user.joinedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/user/search", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false });
  const term = query.toLowerCase();

  try {
    const results = await User.find({
      $or: [
        { uid: { $regex: term, $options: 'i' } },
        { friendCode: { $regex: term, $options: 'i' } },
        { displayName: { $regex: term, $options: 'i' } }
      ]
    }).limit(10);

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: "Search failed" });
  }
});

app.post("/api/user/update-profile", async (req, res) => {
  const { userId, profile } = req.body;
  if (!userId || !profile) return res.status(400).json({ success: false });
  const normalizedUid = String(userId).toLowerCase();

  try {
    const updateData = {};
    ['displayName', 'bio', 'phone', 'dob', 'photoURL', 'birthday', 'location'].forEach(field => {
      if (profile[field] !== undefined) updateData[field] = profile[field];
    });

    const user = await User.findOneAndUpdate(
      { uid: normalizedUid },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

app.post("/api/user/complete-onboarding", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false });

  const normalizedUid = String(userId).toLowerCase();

  try {
    const user = await User.findOneAndUpdate(
      { uid: normalizedUid },
      { isOnboarded: true },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// --- SOCKET IO ---
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  const handleUserOnline = async (userId, profileData = {}) => {
    if (!userId || userId === "undefined" || userId === "null") return;
    const normalized = String(userId).replace(/\s+/g, '_').toLowerCase();

    socket.join(normalized);
    onlineUsers.set(normalized, socket.id);

    try {
      let user = await User.findOne({ uid: normalized });

      if (!user) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        user = new User({
          uid: normalized,
          displayName: profileData.displayName || userId,
          photoURL: profileData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          friendCode: `@${normalized}${randomSuffix}`
        });
        await user.save();
        console.log(`🆕 Created new MongoDB user: ${normalized}`);
      }

      if (user.friendCode) {
        socket.join(user.friendCode.toLowerCase());
      }

      socket.emit("my-profile", user);

      // Fetch user's groups from MongoDB
      const myGroups = await Group.find({ members: normalized });
      socket.emit("my-groups", myGroups);

      // Broadcast online status
      const uniqueOnlineUids = Array.from(onlineUsers.keys())
        .filter(k => !k.startsWith("@"))
        .map(k => k.toLowerCase());

      const finalOnlineList = Array.from(new Set([...uniqueOnlineUids, "ai_friend"]));
      io.emit("online-users", finalOnlineList);

    } catch (error) {
      console.error("❌ MongoDB User Handle Error:", error);
    }
  };

  socket.on("user-online", (userId) => handleUserOnline(userId));

  socket.on("join", (data) => {
    if (data && data.userId) handleUserOnline(data.userId, data);
  });

  socket.on("get-my-profile", async ({ userId }) => {
    if (!userId) return;
    const normalized = userId.replace(/\s+/g, '_').toLowerCase();
    try {
      const user = await User.findOne({ uid: normalized });
      if (user) {
        socket.emit("my-profile", user);
      }
    } catch (err) {
      console.error("❌ Get Profile Error:", err);
    }
  });

  // Call Signaling
  socket.on("ring-user", ({ to, from, type, peerId }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("incoming-p2p-call", { from, type, peerId });
  });

  socket.on("ring-received", ({ to }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("ring-received");
  });

  socket.on("signal-peer-id", ({ to, type, payload }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("signal-peer-id", { from: socket.id, type, payload });
  });

  socket.on("end-call", ({ to }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("call-ended");
  });

  socket.on("ring-group", async ({ groupId, from }) => {
    try {
      const group = await Group.findOne({ groupId });
      if (group) {
        group.members.forEach(memberId => {
          if (memberId !== from.toLowerCase()) {
            const targetRoom = memberId.replace(/\s+/g, '_').toLowerCase();
            io.to(targetRoom).to(memberId).emit("incoming-group-call", { from, groupId, groupName: group.name });
          }
        });
      }
    } catch (err) {
      console.error("❌ Ring Group Error:", err);
    }
  });

  // Chat Messaging
  socket.on("send-message", async ({ to, message, from }) => {
    if (!from || from === "undefined" || from === "null") return;
    if (!to || to === "undefined" || to === "null") return;

    const normalizedFrom = String(from).toLowerCase();
    const normalizedTo = String(to).toLowerCase();
    const senderRoom = normalizedFrom.replace(/\s+/g, '_');

    // 🤖 AI BOT DETECTION
    if (normalizedTo === "ai_friend") {
      try {
        const userMsg = new Message({
          msgId: (message.msgId || message.id || `msg_${Date.now()}`).toString(),
          text: message.text,
          from: normalizedFrom,
          to: "ai_friend",
          type: message.type || 'text',
          time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: message.timestamp || Date.now(),
          replyTo: message.replyTo || null,
          fileUrl: message.fileUrl || message.imageUrl || message.file
        });
        await userMsg.save();

        const decryptedUserMessage = decryptMessage(message.text);
        const attachmentUrl = message.fileUrl || message.imageUrl || message.file;
        const aiResponseText = await generateAIResponse(normalizedFrom, decryptedUserMessage, attachmentUrl);

        const encryptedAIResponse = encryptMessage(aiResponseText);
        const aiMsg = new Message({
          msgId: `ai_${Date.now()}`,
          text: encryptedAIResponse,
          from: "ai_friend",
          to: normalizedFrom,
          type: 'text',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        });
        await aiMsg.save();

        io.to(senderRoom).emit("receive-message", {
          ...aiMsg.toObject(),
          id: aiMsg.msgId,
          fromMe: false
        });
        return;
      } catch (error) {
        console.error(`❌ AI Bot Handle Error:`, error);
        return;
      }
    }

    const targetRoom = normalizedTo.replace(/\s+/g, '_');

    try {
      const newMsg = new Message({
        msgId: (message.msgId || message.id || `msg_${Date.now()}`).toString(),
        text: message.text,
        from: normalizedFrom,
        to: normalizedTo,
        type: message.type || 'text',
        time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: message.timestamp || Date.now(),
        replyTo: message.replyTo || null,
        fileUrl: message.fileUrl || message.imageUrl || message.file
      });
      await newMsg.save();

      io.to(targetRoom).emit("receive-message", {
        ...newMsg.toObject(),
        id: newMsg.msgId,
        fromMe: false
      });

      socket.to(senderRoom).emit("receive-message", {
        ...newMsg.toObject(),
        id: newMsg.msgId,
        fromMe: true
      });
    } catch (error) {
      console.error("❌ Message Save Error:", error);
    }
  });

  // --- Group Events ---
  socket.on("create-group", async ({ name, members, createdBy }, callback) => {
    const groupId = `group_${Date.now()}`;
    const normalizedMembers = Array.from(new Set([...members, createdBy])).map(m => m.toLowerCase());

    try {
      const newGroup = new Group({
        groupId,
        name,
        members: normalizedMembers,
        createdBy: createdBy.toLowerCase()
      });
      await newGroup.save();

      normalizedMembers.forEach(memberId => {
        const room = memberId.replace(/\s+/g, '_').toLowerCase();
        io.to(room).to(memberId).emit("group-created", {
          ...newGroup.toObject(),
          id: newGroup.groupId
        });
      });

      if (callback) callback({ success: true, group: newGroup });
    } catch (err) {
      console.error("❌ Error creating group:", err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on("group-message", async ({ groupId, from, message }) => {
    try {
      const group = await Group.findOne({ groupId });
      if (!group) return;

      const newMsg = new Message({
        msgId: (message.msgId || message.id || `msg_${Date.now()}`).toString(),
        text: message.text,
        from: String(from).toLowerCase(),
        to: groupId,
        type: message.type || 'text',
        time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: message.timestamp || Date.now(),
        fileUrl: message.fileUrl || message.imageUrl || message.file
      });
      await newMsg.save();

      group.members.forEach(memberId => {
        const room = memberId.replace(/\s+/g, '_').toLowerCase();
        io.to(room).to(memberId).emit("receive-group-message", {
          groupId,
          message: { ...newMsg.toObject(), id: newMsg.msgId, fromMe: memberId.toLowerCase() === String(from).toLowerCase() }
        });
      });
    } catch (error) {
      console.error("❌ Group Message Error:", error);
    }
  });

  socket.on("leave-group", async ({ groupId, userId }) => {
    try {
      const normalizedUser = userId.toLowerCase();
      const group = await Group.findOneAndUpdate(
        { groupId },
        { $pull: { members: normalizedUser } },
        { new: true }
      );

      if (group) {
        if (group.members.length === 0) {
          await Group.deleteOne({ groupId });
        }

        // Notify all members of the update
        const formerMembers = [...group.members, normalizedUser];
        for (const memberId of formerMembers) {
          const memberGroups = await Group.find({ members: memberId });
          const room = memberId.replace(/\s+/g, '_').toLowerCase();
          io.to(room).emit("my-groups", memberGroups);
        }
      }
    } catch (error) {
      console.error("❌ Leave Group Error:", error);
    }
  });

  socket.on("delete-group", async ({ groupId, userId }) => {
    try {
      const group = await Group.findOne({ groupId });
      if (group && group.createdBy === userId.toLowerCase()) {
        const members = group.members;
        await Group.deleteOne({ groupId });

        for (const memberId of members) {
          const memberGroups = await Group.find({ members: memberId });
          const room = memberId.replace(/\s+/g, '_').toLowerCase();
          io.to(room).emit("my-groups", memberGroups);
        }
      }
    } catch (error) {
      console.error("❌ Delete Group Error:", error);
    }
  });

  socket.on("add-group-member", async ({ groupId, memberId, by }) => {
    try {
      const normalizedMember = memberId.toLowerCase();
      const group = await Group.findOneAndUpdate(
        { groupId },
        { $addToSet: { members: normalizedMember } },
        { new: true }
      );

      if (group) {
        for (const mid of group.members) {
          const memberGroups = await Group.find({ members: mid });
          const room = mid.replace(/\s+/g, '_').toLowerCase();
          io.to(room).emit("my-groups", memberGroups);
        }
      }
    } catch (error) {
      console.error("❌ Add Group Member Error:", error);
    }
  });

  socket.on("get-chat-history", async ({ userId }, callback) => {
    if (!userId) return callback?.({ success: false });
    const normalized = String(userId).toLowerCase();

    try {
      const messages = await Message.find({
        $or: [{ from: normalized }, { to: normalized }]
      }).sort({ timestamp: 1 });

      const userHistory = {};
      messages.forEach(msg => {
        const friendId = msg.from === normalized ? msg.to : msg.from;
        if (!userHistory[friendId]) {
          userHistory[friendId] = { messages: [], unread: 0 };
        }
        userHistory[friendId].messages.push({
          ...msg.toObject(),
          id: msg.msgId,
          fromMe: msg.from === normalized
        });
      });

      callback?.({ success: true, history: userHistory });
    } catch (error) {
      console.error("❌ History Retrieval Error:", error);
      callback?.({ success: false, error: "Database error" });
    }
  });

  socket.on("delete-message", async ({ chatId, messageId, from }) => {
    const targetRoom = String(chatId).toLowerCase();
    const normalizedFrom = String(from).toLowerCase();
    const targetIdStr = messageId?.toString();

    try {
      const result = await Message.findOneAndUpdate(
        { msgId: targetIdStr },
        { text: encryptMessage("🚫 This message was deleted"), isDeleted: true },
        { new: true }
      );

      if (result) {
        io.to(targetRoom).to(chatId).emit("message-deleted", { chatId: normalizedFrom, messageId: targetIdStr });
        socket.to(normalizedFrom).emit("message-deleted", { chatId: targetRoom, messageId: targetIdStr });
      }
    } catch (error) {
      console.error("❌ Message Delete Error:", error);
    }
  });

  socket.on("message-seen", async ({ groupId, from }) => {
    const readerId = String(from).toLowerCase();
    const targetRoom = String(groupId).toLowerCase();

    try {
      await Message.updateMany(
        { from: targetRoom, to: readerId, seen: { $ne: true } },
        { $set: { seen: true } }
      );
      io.to(targetRoom).emit("message-seen", { from: readerId, groupId: readerId });
    } catch (error) {
      console.error("❌ Message Seen Error:", error);
    }
  });

  socket.on("edit-message", async ({ chatId, messageId, newText, from }) => {
    const targetRoom = String(chatId).toLowerCase();
    const normalizedFrom = String(from).toLowerCase();
    const targetIdStr = messageId?.toString();

    try {
      const updatedMsg = await Message.findOneAndUpdate(
        { msgId: targetIdStr },
        { text: newText, isEdited: true },
        { new: true }
      );

      if (updatedMsg) {
        io.to(targetRoom).emit("message-edited", {
          chatId: normalizedFrom,
          messageId: targetIdStr,
          newText,
          updatedMsg: { ...updatedMsg.toObject(), id: updatedMsg.msgId }
        });
        socket.to(normalizedFrom).emit("message-edited", {
          chatId: targetRoom,
          messageId: targetIdStr,
          newText,
          updatedMsg: { ...updatedMsg.toObject(), id: updatedMsg.msgId }
        });
      }
    } catch (error) {
      console.error("❌ Message Edit Error:", error);
    }
  });

  socket.on("clear-chat", async ({ chatId, from }) => {
    const normalizedFrom = String(from).toLowerCase();
    const targetId = String(chatId).toLowerCase();

    try {
      await Message.deleteMany({
        $or: [
          { from: normalizedFrom, to: targetId },
          { from: targetId, to: normalizedFrom }
        ]
      });

      const recipientRoom = targetId.replace(/\s+/g, '_');
      io.to(recipientRoom).to(targetId).emit("chat-cleared", { chatId: normalizedFrom });
      const senderRoom = normalizedFrom.replace(/\s+/g, '_');
      io.to(senderRoom).to(normalizedFrom).emit("chat-cleared", { chatId: targetId });
    } catch (error) {
      console.error("❌ Message Clear Error:", error);
    }
  });

  socket.on("diagnostic-ping", (cb) => {
    if (cb) cb("pong");
  });

  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) onlineUsers.delete(uid);
    }
    const uniqueOnlineUids = Array.from(onlineUsers.keys())
      .filter(k => !k.startsWith("@"))
      .map(k => k.toLowerCase());
    io.emit("online-users", uniqueOnlineUids);
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
