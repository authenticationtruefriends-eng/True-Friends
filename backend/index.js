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
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { google } from "googleapis";


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
let userStore = new Map();
const groupStore = new Map();
const chatsStore = new Map();
const onlineUsers = new Map(); // uid -> socketId
let verificationStore = new Map(); // Changed to let for re-assignment during load

// Password Reset & Rate Limiting Stores
const passwordResetStore = new Map(); // email -> { otpHash, expiresAt, attempts, resetToken, resetTokenExpiry }
const otpRequestLimitStore = new Map(); // email -> { count, lastRequestTime, lockedUntil }
const otpVerifyLimitStore = new Map(); // email -> { attempts, lockedUntil }
const loginAttemptStore = new Map(); // username/email -> { failedAttempts, lockedUntil, timeoutLevel }

// --- Persistence ---
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const VERIFICATIONS_FILE = path.join(DATA_DIR, 'verifications.json');

// Load Data
try {
  if (fs.existsSync(USERS_FILE)) {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    userStore = new Map(Object.entries(data)); // Load as Map
    console.log(`✅ Loaded ${userStore.size} users`);
  }
  if (fs.existsSync(GROUPS_FILE)) {
    const data = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
    Object.values(data).forEach(g => groupStore.set(g.id, g));
    console.log(`✅ Loaded ${groupStore.size} groups`);
  }
  if (fs.existsSync(CHATS_FILE)) {
    const data = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
    Object.entries(data).forEach(([k, v]) => chatsStore.set(k, v));
    console.log(`✅ Loaded ${chatsStore.size} chats`);
  }
} catch (e) {
  console.error("❌ Error loading data:", e);
}

// Save Functions
function saveUsers() {
  try {
    const obj = Object.fromEntries(userStore);
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("❌ Error saving users:", err);
  }
}

function saveVerifications() {
  try {
    const obj = Object.fromEntries(verificationStore);
    fs.writeFileSync(VERIFICATIONS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("❌ Error saving verifications:", err);
  }
}
const saveGroups = () => fs.writeFileSync(GROUPS_FILE, JSON.stringify(Object.fromEntries(groupStore), null, 2));
const saveChats = () => fs.writeFileSync(CHATS_FILE, JSON.stringify(Object.fromEntries(chatsStore), null, 2));

app.get('/test-upload', (req, res) => {
  const files = fs.readdirSync(uploadDir);
  res.json({ uploadDir, files, testUrl: files.length > 0 ? `/uploads/${files[0]}` : 'No files yet' });
});

app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
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
    const filename = uniqueSuffix + '.enc';
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
  const finalFilename = `${Date.now()}-${fileName}.enc`;
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
app.get("/api/user/profile/:userId", (req, res) => {
  const { userId } = req.params;
  const user = userStore.get(userId) || userStore.get(userId.toLowerCase());

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
app.get("/api/check-username", (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ available: false });

  const uid = username.replace(/\s+/g, '_').toLowerCase();
  const isTaken = userStore.has(uid);

  // Also check if they are in "verificationStore" (OTP sent but not verified)
  // We should probably consider that "taken" too to prevent duplicate signups?
  // Actually, if it's unverified, maybe we allow re-signup? 
  // But for UI feedback, let's say "Taken" if active user exists.

  res.json({ available: !isTaken });
});

// API: Signup (Step 1 - Send OTP)
app.post("/api/signup", async (req, res) => {
  console.log("👉 /api/signup hit!");
  // console.log("Body:", req.body); // SECURITY: Don't log passwords!
  let { username, password, email } = req.body; // Use let
  if (!username || !password || !email) {
    console.log("❌ Missing fields");
    return res.status(400).json({ success: false, error: "All fields are required" });
  }

  // Sanitize
  username = username.trim();
  email = email.trim();

  const normalizedEmail = email.toLowerCase();
  const emailDomain = normalizedEmail.split('@')[1];

  // WHITELIST APPROACH - Only allow trusted email providers
  const ALLOWED_DOMAINS = [
    // Google
    "gmail.com",
    // Microsoft/Outlook
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    // Yahoo
    "yahoo.com", "ymail.com", "rocketmail.com", "yahoo.co.in", "yahoo.co.uk",
    // Zoho
    "zoho.com", "zohomail.com", "zoho.eu",
    // ProtonMail
    "proton.me", "protonmail.com", "pm.me",
    // Apple
    "icloud.com", "me.com", "mac.com",
    // AOL
    "aol.com",
    // GMX
    "gmx.com", "gmx.net", "gmx.de",
    // Mail.com
    "mail.com",
    // Other legitimate providers
    "fastmail.com", "tutanota.com", "mailfence.com"
  ];

  if (!ALLOWED_DOMAINS.includes(emailDomain)) {
    console.log(`🚫 Blocked non-whitelisted email domain: ${emailDomain}`);
    return res.status(400).json({
      success: false,
      error: "Please use a trusted email provider (Gmail, Yahoo, Outlook, Zoho, ProtonMail, iCloud, etc.)"
    });
  }

  // Check if user already exists
  const uid = username.replace(/\s+/g, '_').toLowerCase();

  // Check if UID taken
  if (userStore.has(uid)) {
    return res.status(400).json({ success: false, error: "Username already taken" });
  }

  // Check if Email taken
  for (const u of userStore.values()) {
    if (u.email === normalizedEmail) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store temporarily
  verificationStore.set(normalizedEmail, {
    otp,
    expiresAt,
    userData: { username, password, email: normalizedEmail, uid }
  });
  saveVerifications(); // Persistence Fix

  // Send Email in background - Respond immediately
  sendVerificationEmail(normalizedEmail, otp);

  res.json({ success: true, message: "Verification code sent to email", step: "verify" });
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
  saveVerifications(); // Persistence Fix

  const emailSent = await sendVerificationEmail(normalizedEmail, otp);
  if (emailSent) {
    res.json({ success: true, message: "Code resent" });
  } else {
    res.status(500).json({ success: false, error: "Failed to send email. Please try again in a moment." });
  }
});

// API: Verify OTP (Step 2 - Create Account)
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email is required" });
  const normalizedEmail = String(email).trim().toLowerCase();
  const record = verificationStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ success: false, error: "Invalid or expired verification session" });
  }

  if (Date.now() > record.expiresAt) {
    verificationStore.delete(normalizedEmail);
    saveVerifications(); // Persistence Fix
    return res.status(400).json({ success: false, error: "Verification code expired" });
  }

  // Verify OTP Code
  if (String(record.otp).trim() !== String(otp).trim()) {
    return res.status(400).json({ success: false, error: "Incorrect verification code" });
  }

  // Success! Create the user now.
  const { userData } = record;
  const { uid, username, password } = userData;
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  if (userStore.has(uid)) {
    // IDEMPOTENCY CHECK
    const existing = userStore.get(uid);

    console.log(`💥 RACE CONDITION DEBUG:`);
    console.log(`   -> Target UID: ${uid}`);
    console.log(`   -> Existing Email: '${existing.email}'`);
    console.log(`   -> New Verif Email: '${userData.email}'`);

    // Allow if email matches OR if the existing record is corrupted (undefined email)
    if (!existing.email || existing.email === userData.email) {
      console.log(`⚠️ Race condition/Overwrite handled: User ${uid} verified.`);

      // If corrupted (no email), we should probably UPDATE the user record with the new full data
      if (!existing.email) {
        console.log(`   -> Repairing corrupted user record...`);
        // Fall through to normal creation logic to OVERWRITE the bad record
      } else {
        // Normal idempotent success
        verificationStore.delete(normalizedEmail);
        saveVerifications();
        return res.json({ success: true, user: existing });
      }
    } else {
      return res.status(400).json({ success: false, error: "Username taken by another email" });
    }
  }

  const newUser = {
    uid: uid,
    displayName: username,
    email: userData.email,
    passwordHash: passwordHash, // Store hash
    photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    friendCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    bio: "Hi there! I am using True Friends.",
    phone: "",
    birthday: "",
    location: "",
    joinedAt: Date.now(),
    isVerified: true, // Email Verified!
    isOnboarded: false,
    createdAt: new Date().toISOString(),
  };

  userStore.set(uid, newUser);
  saveUsers();
  verificationStore.delete(normalizedEmail); // Cleanup
  saveVerifications(); // Persistence Fix

  console.log(`👤 New User Signed Up (Verified): ${username} (${uid})`);

  // Login immediately
  const token = jwt.sign({ uid, name: username }, SECRET_KEY, { expiresIn: "7d" });
  res.json({ success: true, token, user: newUser });
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
    saveVerifications();
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

  // Check if user exists
  const user = Array.from(userStore.values()).find(u => u.email?.toLowerCase() === normalizedEmail);
  if (!user) {
    console.log(`❌ Forgot Password: User not found for email '${normalizedEmail}'`);
    // TEMPORARY DEBUG: Reveal failure
    return res.status(404).json({ success: false, error: "DEBUG MODE: User not found in database. Did the server restart?" });
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
app.post("/api/reset-password", (req, res) => {
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

  // Find user and update password
  const user = Array.from(userStore.values()).find(u => u.email?.toLowerCase() === targetEmail);
  if (!user) {
    return res.status(400).json({ success: false, error: "User not found" });
  }

  // Update password
  const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  user.passwordHash = newPasswordHash;
  userStore.set(user.uid, user);
  saveUsers();

  // Cleanup
  passwordResetStore.delete(targetEmail);
  otpRequestLimitStore.delete(targetEmail);
  otpVerifyLimitStore.delete(targetEmail);

  console.log(`🔐 Password reset successful for ${targetEmail}`);
  res.json({ success: true, message: "Password reset successful" });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password required" });
  }

  const identifier = username.trim().toLowerCase(); // Normalize

  // 1. CHECK LOCKOUT
  const record = loginAttemptsStore.get(identifier) || { attempts: 0, lockoutLevel: 0, lastLockoutDuration: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    const remainingMs = record.lockedUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    const remainingHours = Math.ceil(remainingMinutes / 60);

    let timeText = `${remainingMinutes} minutes`;
    if (remainingMinutes > 90) timeText = `${remainingHours} hours`;

    return res.status(429).json({
      success: false,
      error: `Too many attempts. Try again in ${timeText}.`,
      lockedUntil: record.lockedUntil
    });
  }

  // 2. CHECK CREDENTIALS
  const user = Array.from(userStore.values()).find(u =>
    u.uid === identifier.replace(/\s+/g, '_') || u.email === identifier
  );

  let isAuthenticated = false;
  if (user) {
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash === inputHash) {
      isAuthenticated = true;
    }
  }

  // 3. HANDLE FAILURE
  if (!isAuthenticated) {
    record.attempts += 1;
    const maxAttempts = 5;
    const remaining = maxAttempts - record.attempts;

    if (record.attempts >= maxAttempts) {
      // TRIGGER LOCKOUT
      record.lockoutLevel += 1;
      const durationHours = getLockoutDuration(record.lockoutLevel, record.lastLockoutDuration);
      record.lastLockoutDuration = durationHours;
      record.lockedUntil = Date.now() + (durationHours * 60 * 60 * 1000);
      record.attempts = 0; // Reset attempts for next cycle

      loginAttemptsStore.set(identifier, record);

      console.log(`🔒 User ${identifier} locked out for ${durationHours} hours (Level ${record.lockoutLevel})`);
      return res.status(429).json({
        success: false,
        error: `Account locked for ${durationHours} hour(s) due to multiple failed attempts.`,
        lockedUntil: record.lockedUntil
      });
    }

    loginAttemptsStore.set(identifier, record);
    return res.status(401).json({
      success: false,
      error: `Invalid password. ${remaining} attempt(s) remaining`
    });
  }

  // 4. HANDLE SUCCESS
  loginAttemptsStore.delete(identifier);

  const token = jwt.sign({ uid: user.uid, name: user.displayName }, SECRET_KEY, { expiresIn: "7d" });
  res.json({ success: true, token, user });
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
app.post("/api/user/update-friend-id", (req, res) => {
  const { userId, newId } = req.body;
  if (!userId || !newId) return res.status(400).json({ success: false });

  const normalizedUid = String(userId).toLowerCase();
  let cleanId = newId.trim();
  if (!cleanId.startsWith("@")) cleanId = "@" + cleanId;

  const alreadyTaken = Array.from(userStore.values()).some(u =>
    u.friendCode?.toLowerCase() === cleanId.toLowerCase() && u.uid !== normalizedUid
  );

  if (alreadyTaken) return res.status(400).json({ success: false, error: "ID taken" });

  const record = userStore.get(normalizedUid);
  if (!record) return res.status(404).json({ success: false });

  record.friendCode = cleanId;
  userStore.set(normalizedUid, record);
  saveUsers();
  res.json({ success: true, newId: cleanId });
});

app.get("/api/user/profile/:userId", (req, res) => {
  const { userId } = req.params;
  const user = userStore.get(userId) || userStore.get(userId.toLowerCase());

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

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
});

app.post("/api/user/search", (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false });
  const term = query.toLowerCase();
  const results = [];
  for (const user of userStore.values()) {
    if (!user || !user.uid) continue;
    if (user.uid.toLowerCase().includes(term) || user.friendCode?.toLowerCase().includes(term)) {
      results.push(user);
      if (results.length >= 10) break;
    }
  }
  res.json({ success: true, results });
});

app.post("/api/user/update-profile", (req, res) => {
  const { userId, profile } = req.body;
  console.log(`📝 Update Profile Request for: ${userId}`, profile);

  if (!userId || !profile) return res.status(400).json({ success: false });
  const normalizedUid = String(userId).toLowerCase();

  // Debug log
  console.log(`   -> Normalized UID: ${normalizedUid}`);
  console.log(`   -> Current Store has it? ${userStore.has(normalizedUid)}`);

  const record = userStore.get(normalizedUid) || { uid: normalizedUid };

  ['displayName', 'bio', 'phone', 'dob', 'photoURL'].forEach(field => {
    if (profile[field] !== undefined) {
      console.log(`   -> Updating ${field}: ${record[field]} -> ${profile[field]}`);
      record[field] = profile[field];
    }
  });

  userStore.set(normalizedUid, record);
  saveUsers();
  res.json({ success: true, user: record });
});

app.post("/api/user/complete-onboarding", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false });

  const normalizedUid = String(userId).toLowerCase();
  const record = userStore.get(normalizedUid);

  if (!record) return res.status(404).json({ success: false, error: "User not found" });

  record.isOnboarded = true;
  userStore.set(normalizedUid, record);
  saveUsers();

  console.log(`✅ Onboarding completed for: ${normalizedUid}`);
  res.json({ success: true });
});


// --- SOCKET IO ---
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Legacy & New Connection Handler
  const handleUserOnline = (userId, profileData = {}) => {
    if (!userId) return;
    const normalized = userId.replace(/\s+/g, '_').toLowerCase();

    // Join rooms for this UID to support multi-tab/device sync
    socket.join(normalized);
    if (userId !== normalized) socket.join(userId);

    onlineUsers.set(normalized, socket.id);
    onlineUsers.set(userId, socket.id); // Store original too

    // Auto-create or Update user record
    let user = userStore.get(normalized);
    if (!user) {
      // Generate default friendCode if new
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      user = {
        uid: normalized,
        displayName: profileData.displayName || userId,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        friendCode: `@${normalized}${randomSuffix}`
      };
      userStore.set(normalized, user);
      saveUsers();
    }

    // Join room for Friend Code as well
    if (user.friendCode) {
      const fcRoom = user.friendCode.toLowerCase();
      socket.join(fcRoom);
      onlineUsers.set(fcRoom, socket.id);
    }

    // Send back profile
    socket.emit("my-profile", user);

    // Send user's groups
    const myGroups = Array.from(groupStore.values()).filter(g =>
      g.members.includes(normalized) || g.members.includes(userId)
    );
    socket.emit("my-groups", myGroups);

    // DEDUPLICATED ONLINE USERS: Only emit unique normalized UIDs
    const allOnlineKeys = Array.from(onlineUsers.keys());
    const uniqueOnlineUids = Array.from(new Set(
      allOnlineKeys
        .filter(k => userStore.has(k.toLowerCase()) && !k.startsWith("@"))
        .map(k => k.toLowerCase())
    ));
    io.emit("online-users", uniqueOnlineUids);
  };

  socket.on("user-online", (userId) => handleUserOnline(userId));

  socket.on("join", (data) => {
    // Data = { userId, displayName }
    if (data && data.userId) handleUserOnline(data.userId, data);
  });

  socket.on("get-my-profile", ({ userId }) => {
    if (!userId) return;
    const normalized = userId.replace(/\s+/g, '_').toLowerCase();
    const user = userStore.get(normalized);
    if (user) socket.emit("my-profile", user);
  });

  // Call Signaling
  socket.on("ring-user", ({ to, from, type, peerId }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("incoming-p2p-call", { from, type, peerId });
  });

  // NEW: Ring Received Acknowledgment (High-Fidelity)
  socket.on("ring-received", ({ to }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("ring-received");
  });

  // Generic Signaling Relay for Random PeerIDs (Offer, Answer, Candidates if needed manual, or just ID exchange)
  socket.on("signal-peer-id", ({ to, type, payload }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("signal-peer-id", { from: socket.id, type, payload });
  });

  socket.on("end-call", ({ to }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    io.to(targetRoom).to(to).emit("call-ended");
  });

  socket.on("ring-group", ({ groupId, from }) => {
    const group = groupStore.get(groupId) || groupStore.get(groupId.toLowerCase());
    if (group) {
      group.members.forEach(memberId => {
        if (memberId !== from) {
          const targetRoom = memberId.replace(/\s+/g, '_').toLowerCase();
          io.to(targetRoom).to(memberId).emit("incoming-group-call", { from, groupId, groupName: group.name });
        }
      });
    }
  });

  // Chat Messaging
  socket.on("send-message", async ({ to, message, from }) => {
    const targetRoom = to.replace(/\s+/g, '_').toLowerCase();
    const senderRoom = from.replace(/\s+/g, '_').toLowerCase();

    console.log(`📩 Message to room ${targetRoom} (from ${from}):`, { id: message.msgId || message.id });

    // 🤖 AI BOT DETECTION - Handle messages to AI Friend
    if (to === "ai_friend") {
      console.log(`🤖 AI Friend message detected from ${from}`);

      // 1. Decrypt incoming message
      let userText = message.text;
      try {
        if (message.encrypted) {
          // Attempt to decrypt if encrypted flag is set (requires key sharing implementation or symmetric key)
          // For now, assuming internal AI logic uses decrypted text passed from frontend in a specific way OR 
          // we use the raw text if it's already decrypted by client before sending (which is not standard E2E but simplifying for AI)
          // Actually, our previous implementation decrypted on client. 
          // BUT, to process on backend, we need to decrypt it here provided we have the key or it was sent basically.
          // Wait - in Step 8286 we implemented backend decryption! 
          userText = decryptMessage(message.text);
        }
      } catch (err) {
        console.error("Decryption failed for AI:", err.message);
        userText = message.text; // Fallback
      }

      console.log(`🤖 AI User Input: ${userText}`);

      // --- NEW: TASK REMINDER SYSTEM ---
      // Detect intent: "I need to...", "I want to...", "I will..."
      const taskRegex = /\b(i need to|i have to|i want to|i'm going to|im going to|i will|gonna)\b\s+(.+)/i;
      const match = userText.match(taskRegex);

      if (match && match[2] && !userText.toLowerCase().includes("remind")) {
        const task = match[2];
        console.log(`⏰ Task detected: ${task}`);

        // Schedule reminder for 1 hour (for demo purpose, maybe shorter? User said "like houre")
        // Using 1 hour = 3600000 ms. 
        // For testing/demo, let's also log it clearly.
        const delay = 60 * 60 * 1000; // 1 hour

        setTimeout(() => {
          console.log(`⏰ Sending reminder for task: ${task}`);
          const reminderMsg = {
            id: Date.now().toString(),
            text: encryptMessage(`Hey! 👋 Just checking in - did you finish "${task}" yet?`),
            sender: "ai_friend",
            timestamp: new Date().toISOString(),
            reactions: {},
            replyTo: null,
            encrypted: true
          };
          io.to(senderRoom).emit("receive-message", reminderMsg);
        }, delay);
      }
      // ---------------------------------

      try {
        // Send user's message back to them first (so it appears in chat)
        const userMsg = {
          id: (message.msgId || message.id || Date.now()).toString(),
          msgId: (message.msgId || message.id || Date.now()).toString(),
          text: message.text,
          from: from,
          type: message.type || 'text',
          fromMe: true,
          time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: message.timestamp || Date.now(),
          replyTo: message.replyTo || null
        };
        socket.to(senderRoom).emit("receive-message", userMsg);

        // Decrypt user's message before sending to AI
        const decryptedUserMessage = decryptMessage(message.text);
        console.log(`🔓 Decrypted message: "${decryptedUserMessage}"`);

        // Generate AI response
        const attachmentUrl = message.fileUrl || message.imageUrl || message.file;
        const aiResponseText = await generateAIResponse(from, decryptedUserMessage, attachmentUrl);

        // Encrypt AI response before sending back
        const encryptedAIResponse = encryptMessage(aiResponseText);
        console.log(`🔒 Encrypted AI response`);

        // Create AI response message
        const aiMsg = {
          id: `ai_${Date.now()}`,
          msgId: `ai_${Date.now()}`,
          text: encryptedAIResponse,
          from: "ai_friend",
          type: 'text',
          fromMe: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          replyTo: null
        };

        // Send AI response to user (all their tabs)
        io.to(senderRoom).to(from).emit("receive-message", aiMsg);

        // Save both messages to chat history
        const chatKey = [from.toLowerCase(), "ai_friend"].sort().join('_');
        if (!chatsStore.has(chatKey)) chatsStore.set(chatKey, []);
        const history = chatsStore.get(chatKey);
        history.push(userMsg);
        history.push(aiMsg);

        console.log(`✅ AI response sent to ${from}`);
        return; // Don't continue with normal message flow
      } catch (error) {
        console.error(`❌ AI Bot Error:`, error);
        // Send error message to user
        const errorMsg = {
          id: `ai_error_${Date.now()}`,
          msgId: `ai_error_${Date.now()}`,
          text: "Sorry, I'm having trouble thinking right now! 🤔 Please try again in a moment.",
          from: "ai_friend",
          type: 'text',
          fromMe: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        };
        io.to(senderRoom).to(from).emit("receive-message", errorMsg);
        return;
      }
    }

    // Check if recipient is online (to set delivered status)
    const isOnline = onlineUsers.has(targetRoom) || onlineUsers.has(to);
    console.log(`🔍 Checking Online Status for ${to} (Room: ${targetRoom}):`, {
      isOnline,
      onlineKeys: Array.from(onlineUsers.keys()), // CAUTION: might be large
      hasTargetRoom: onlineUsers.has(targetRoom),
      hasTo: onlineUsers.has(to)
    });

    // Normal message handling (for non-AI messages)
    const fullMsg = {
      id: (message.msgId || message.id || Date.now()).toString(),
      msgId: (message.msgId || message.id || Date.now()).toString(),
      text: message.text,
      from: from,
      type: message.type,
      fileUrl: message.fileUrl || message.file,
      imageUrl: message.imageUrl || message.fileUrl || message.file,
      fileName: message.fileName,
      mimeType: message.mimeType,
      fromMe: false, // For other users
      delivered: isOnline,
      time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: message.timestamp || Date.now(),
      replyTo: message.replyTo || null
    };

    // Broadcast to recipient(s) - all their tabs
    io.to(targetRoom).to(to).emit("receive-message", fullMsg);

    // Also broadcast to other tabs of the sender
    socket.to(senderRoom).emit("receive-message", { ...fullMsg, fromMe: true });

    // Notify SENDER about delivery if online
    if (isOnline) {
      io.to(senderRoom).emit("message-delivered", {
        messageId: fullMsg.msgId,
        chatId: to // The chatId for the sender is the recipient
      });
    }

    // Save to store
    const chatKey = [from.toLowerCase(), to.toLowerCase()].sort().join('_');
    if (!chatsStore.has(chatKey)) chatsStore.set(chatKey, []);
    const history = chatsStore.get(chatKey);
    history.push(fullMsg);
    if (history.length > 100) history.shift();
    chatsStore.set(chatKey, history);
    saveChats();
  });


  socket.on("group-message", ({ groupId, from, message }) => {
    console.log(`👥 Group Message in ${groupId} from ${from}:`, { id: message.msgId || message.id });
    const group = groupStore.get(groupId) || groupStore.get(groupId.toLowerCase());
    if (group) {
      const fullMsg = {
        id: message.msgId || message.id || Date.now(),
        msgId: message.msgId || message.id,
        text: message.text,
        from: from,
        type: message.type,
        fileUrl: message.fileUrl || message.file,
        imageUrl: message.imageUrl || message.fileUrl || message.file,
        fileName: message.fileName,
        mimeType: message.mimeType,
        fromMe: false,
        time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: message.timestamp || Date.now(),
        replyTo: message.replyTo || null
      };

      // Broadcast to all members (all their tabs)
      group.members.forEach(memberId => {
        const room = memberId.replace(/\s+/g, '_').toLowerCase();
        io.to(room).to(memberId).emit("receive-group-message", { groupId, message: fullMsg });
      });

      // Also broadcast to other tabs of the sender (as fromMe: true)
      const senderRoom = from.replace(/\s+/g, '_').toLowerCase();
      socket.to(senderRoom).emit("receive-group-message", { groupId, message: { ...fullMsg, fromMe: true } });

      // Persistent Storage
      if (typeof group.messages === 'undefined') group.messages = [];
      group.messages.push(fullMsg);
      if (group.messages.length > 200) group.messages.shift();
      groupStore.set(groupId, group);
      saveGroups();
    }
  });

  socket.on("create-group", ({ name, members, createdBy }, callback) => {
    try {
      const groupId = ("group_" + Date.now()).toLowerCase();
      const normalizedMembers = Array.from(new Set([...members, createdBy])).map(id => id.toLowerCase());

      console.log(`📡 create-group request:`, { name, members, createdBy });

      const newGroup = {
        id: groupId,
        name,
        members: normalizedMembers,
        createdBy: createdBy.toLowerCase(),
        messages: [],
        createdAt: new Date().toISOString()
      };

      groupStore.set(groupId, newGroup);
      saveGroups();

      console.log(`✅ Group Created: ${name} (${groupId})`);

      // Broadcast to all members (all their tabs)
      normalizedMembers.forEach(memberId => {
        const room = memberId.replace(/\s+/g, '_').toLowerCase();
        console.log(`   -> Broadcasting to: ${memberId} in room: ${room}`);
        io.to(room).to(memberId).emit("group-created", newGroup);
      });

      if (callback) callback({ success: true, group: newGroup });
    } catch (err) {
      console.error("❌ Error creating group:", err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on("leave-group", ({ groupId, userId }) => {
    const group = groupStore.get(groupId) || groupStore.get(groupId.toLowerCase());
    if (group) {
      const normalizedUser = userId.toLowerCase();
      group.members = group.members.filter(m => m !== normalizedUser);

      if (group.members.length === 0) {
        groupStore.delete(groupId);
      } else {
        groupStore.set(groupId, group);
      }
      saveGroups();

      // Broadcast update to remaining members
      group.members.forEach(memberId => {
        const room = memberId.replace(/\s+/g, '_').toLowerCase();
        io.to(room).to(memberId).emit("my-groups", Array.from(groupStore.values()).filter(g => g.members.includes(memberId)));
      });

      // Tell the user who left to remove it
      const userRoom = userId.replace(/\s+/g, '_').toLowerCase();
      io.to(userRoom).to(userId).emit("my-groups", Array.from(groupStore.values()).filter(g => g.members.includes(normalizedUser)));

      console.log(`🚪 User ${userId} left group ${groupId}`);
    }
  });

  socket.on("delete-group", ({ groupId, userId }) => {
    const group = groupStore.get(groupId) || groupStore.get(groupId.toLowerCase());
    if (group && group.createdBy === userId.toLowerCase()) {
      const members = group.members;
      groupStore.delete(groupId);
      saveGroups();

      // Notify all members
      members.forEach(memberId => {
        const room = memberId.replace(/\s+/g, '_').toLowerCase();
        io.to(room).to(memberId).emit("my-groups", Array.from(groupStore.values()).filter(g => g.members.includes(memberId)));
      });

      console.log(`🗑️ Group ${groupId} deleted by ${userId}`);
    }
  });

  socket.on("add-group-member", ({ groupId, memberId, by }) => {
    const group = groupStore.get(groupId) || groupStore.get(groupId.toLowerCase());
    if (group) {
      const normalizedMember = memberId.toLowerCase();
      if (!group.members.includes(normalizedMember)) {
        group.members.push(normalizedMember);
        groupStore.set(groupId, group);
        saveGroups();

        // Broadcast to all members
        group.members.forEach(mid => {
          const room = mid.replace(/\s+/g, '_').toLowerCase();
          io.to(room).to(mid).emit("my-groups", Array.from(groupStore.values()).filter(g => g.members.includes(mid)));
          io.to(room).to(mid).emit("group-created", group); // Ensure new member gets the group info
        });

        console.log(`➕ User ${memberId} added to group ${groupId} by ${by}`);
      }
    }
  });


  socket.on("get-chat-history", ({ userId }, callback) => {
    if (!userId) return callback?.({ success: false });
    const normalized = userId.toLowerCase();

    // Construct a per-user history map
    const userHistory = {};
    for (const [key, messages] of chatsStore.entries()) {
      if (key.includes(normalized)) {
        const friendId = key.split('_').find(id => id !== normalized);
        if (friendId) {
          userHistory[friendId] = { messages, unread: 0 };
        }
      }
    }

    callback?.({ success: true, history: userHistory });
  });

  // Delete Message Handler
  socket.on("delete-message", ({ chatId, messageId, from }) => {
    const targetRoom = chatId.toLowerCase();
    const normalizedFrom = from.toLowerCase();
    const targetIdStr = messageId?.toString();

    console.log(`🗑️ Delete Request from ${from} for chat room ${targetRoom}, msgId: ${messageId}`);

    // 1. Group Deletion
    if (chatId.startsWith("group_")) {
      const group = groupStore.get(chatId) || groupStore.get(chatId.toLowerCase());
      if (group) {
        // Broadcast to all members
        group.members.forEach(memberId => {
          const room = memberId.replace(/\s+/g, '_').toLowerCase();
          io.to(room).to(memberId).emit("message-deleted", {
            chatId: chatId, // Recipient sees this coming from the group
            messageId: targetIdStr
          });
        });

        // Update stored messages in group
        if (group.messages) {
          let found = false;
          group.messages = group.messages.map(msg => {
            const msgIds = [msg.id?.toString(), msg.timestamp?.toString(), msg.msgId?.toString()].filter(Boolean);
            if (msgIds.includes(targetIdStr)) {
              found = true;
              return { ...msg, text: "🚫 This message was deleted", isDeleted: true, reactions: {} };
            }
            return msg;
          });
          if (found) {
            groupStore.set(chatId, group);
            saveGroups();
            console.log(`  -> Group DB: Marked as deleted`);
          }
        }
      }
      return;
    }

    // 2. P2P Deletion
    // Broadcast to recipient room (all their tabs)
    io.to(targetRoom).to(chatId).emit("message-deleted", {
      chatId: normalizedFrom,
      messageId: targetIdStr
    });

    // Also broadcast to other tabs of the sender
    socket.to(normalizedFrom).to(from).emit("message-deleted", {
      chatId: targetRoom,
      messageId: targetIdStr
    });

    // Update stored messages in P2P chat
    const chatKey = [normalizedFrom, targetRoom].sort().join('_');
    if (chatsStore.has(chatKey)) {
      let history = chatsStore.get(chatKey);
      let found = false;

      history = history.map(msg => {
        const msgIds = [msg.id?.toString(), msg.timestamp?.toString(), msg.msgId?.toString()].filter(Boolean);
        if (msgIds.includes(targetIdStr)) {
          found = true;
          return { ...msg, text: "🚫 This message was deleted", isDeleted: true, reactions: {} };
        }
        return msg;
      });

      if (found) {
        console.log(`  -> P2P DB: Message matched and updated in history`);
        chatsStore.set(chatKey, history);
        saveChats();
      } else {
        console.log(`  -> P2P DB: Message ID ${targetIdStr} NOT found in history for key ${chatKey}`);
      }
    }
  });

  // Message Seen/Read Receipt Handler
  socket.on("message-seen", ({ groupId, from }) => {
    // 'groupId' is the ID of the chat being read (could be a user ID for P2P)
    // 'from' is the ID of the user WRITING the seen status (the reader)
    const readerId = from.toLowerCase();
    const targetRoom = groupId.toLowerCase(); // The chat ID
    const isGroup = groupId.startsWith("group_");

    console.log(`👀 Seen Event: User ${readerId} saw chat ${targetRoom}`);

    if (isGroup) {
      const group = groupStore.get(groupId) || groupStore.get(groupId.toLowerCase());
      if (group && group.messages) {
        let updated = false;
        group.messages.forEach(msg => {
          // If message is NOT from the reader, and reader hasn't seen it yet
          if (msg.from !== readerId) {
            if (!msg.seenBy) msg.seenBy = [];
            if (!msg.seenBy.includes(readerId)) {
              msg.seenBy.push(readerId);
              updated = true;
            }
          }
        });
        if (updated) {
          groupStore.set(groupId, group);
          saveGroups();
          // Broadcast to all members that this user saw the group
          group.members.forEach(memberId => {
            const room = memberId.replace(/\s+/g, '_').toLowerCase();
            io.to(room).emit("message-seen", { groupId, from: readerId });
          });
        }
      }
    } else {
      // P2P: Mark messages from the OTHER person as seen by ME
      // Logic: I am 'readerId'. I am reading chat with 'targetRoom'.
      // So messages in this chat where msg.from === targetRoom should be marked seen.

      const otherUserId = targetRoom;
      const chatKey = [readerId, otherUserId].sort().join('_');
      if (chatsStore.has(chatKey)) {
        let history = chatsStore.get(chatKey);
        let updated = false;

        history = history.map(msg => {
          // If message is from the OTHER person (not me) and not seen yet
          if (msg.from.toLowerCase() === otherUserId && !msg.seen) {
            updated = true;
            return { ...msg, seen: true };
          }
          return msg;
        });

        if (updated) {
          chatsStore.set(chatKey, history);
          saveChats();
          console.log(`  -> Marked P2P messages as seen in ${chatKey}`);

          // Notify the Sender (the other user) that I saw their messages
          const senderRoom = otherUserId.replace(/\s+/g, '_').toLowerCase();
          io.to(senderRoom).emit("message-seen", { from: readerId, groupId: readerId });
          // groupId sent as readerId because on the sender's side, the chat ID is the reader's ID
        }
      }
    }
  });

  // Edit Message Handler
  socket.on("edit-message", ({ chatId, messageId, newText, from }) => {
    const targetRoom = chatId.replace(/\s+/g, '_').toLowerCase();
    const normalizedFrom = from.toLowerCase();
    const targetIdStr = messageId?.toString();
    const isGroup = chatId.startsWith("group_");

    console.log(`✏️ Edit Request: From=${from}, Chat=${chatId}, Room=${targetRoom}, ID=${targetIdStr}`);

    let updatedMsg = null;

    if (isGroup) {
      const group = groupStore.get(chatId) || groupStore.get(chatId.toLowerCase());
      if (group && group.messages) {
        const msgIndex = group.messages.findIndex(m => [m.id?.toString(), m.timestamp?.toString(), m.msgId?.toString()].filter(Boolean).includes(targetIdStr));
        if (msgIndex !== -1) {
          group.messages[msgIndex].text = newText;
          group.messages[msgIndex].isEdited = true;
          updatedMsg = group.messages[msgIndex];
          groupStore.set(chatId, group);
          saveGroups();

          console.log(`  -> Group DB Updated. Broadcasting to members.`);
          // Broadcast to all members
          group.members.forEach(memberId => {
            const room = memberId.replace(/\s+/g, '_').toLowerCase();
            io.to(room).emit("message-edited", {
              chatId: chatId,
              messageId: targetIdStr,
              newText,
              updatedMsg
            });
          });
        } else {
          console.log(`  -> Group DB: Message ID ${targetIdStr} NOT found.`);
        }
      }
    } else {
      // P2P Edit
      const chatKey = [normalizedFrom, targetRoom].sort().join('_');
      if (chatsStore.has(chatKey)) {
        const history = chatsStore.get(chatKey);
        const msgIndex = history.findIndex(m => [m.id?.toString(), m.timestamp?.toString(), m.msgId?.toString()].filter(Boolean).includes(targetIdStr));
        if (msgIndex !== -1) {
          history[msgIndex].text = newText;
          history[msgIndex].isEdited = true;
          updatedMsg = history[msgIndex];
          chatsStore.set(chatKey, history);
          saveChats();

          console.log(`  -> P2P DB Updated. Broadcasting to ${targetRoom} and ${normalizedFrom}`);
          // Broadcast to recipient
          io.to(targetRoom).emit("message-edited", {
            chatId: normalizedFrom,
            messageId: targetIdStr,
            newText,
            updatedMsg
          });

          // Broadcast to other tabs of the sender
          socket.to(normalizedFrom).emit("message-edited", {
            chatId: targetRoom,
            messageId: targetIdStr,
            newText,
            updatedMsg
          });
        } else {
          console.log(`  -> P2P DB: Message ID ${targetIdStr} NOT found in ${chatKey}`);
        }
      } else {
        console.log(`  -> P2P DB: Chat key ${chatKey} NOT found.`);
      }
    }
  });

  // Global Clear Chat Handler
  socket.on("clear-chat", ({ chatId, from }) => {
    console.log(`🧹 Clear Chat Request from ${from} for chat: ${chatId}`);
    const normalizedFrom = from.toLowerCase();
    const targetId = chatId.toLowerCase();

    // 1. Group Clear
    if (chatId.startsWith("group_")) {
      const group = groupStore.get(chatId) || groupStore.get(chatId.toLowerCase());
      if (group) {
        group.messages = [];
        groupStore.set(chatId, group);
        saveGroups();

        // Broadcast to all members (all their tabs)
        group.members.forEach(memberId => {
          const room = memberId.replace(/\s+/g, '_').toLowerCase();
          io.to(room).to(memberId).emit("chat-cleared", { chatId: chatId });
        });
        console.log(`  -> Group DB: History cleared for ${chatId}`);
      }
      return;
    }

    // 2. P2P Clear
    const chatKey = [normalizedFrom, targetId].sort().join('_');
    if (chatsStore.has(chatKey)) {
      chatsStore.set(chatKey, []);
      saveChats();
      console.log(`  -> P2P DB: History cleared for key ${chatKey}`);
    }

    // Broadcast to recipient (all their tabs)
    const recipientRoom = targetId.replace(/\s+/g, '_').toLowerCase();
    console.log(`  -> Broadcasting clear-chat to recipient rooms: ${recipientRoom}, ${targetId}`);
    io.to(recipientRoom).to(targetId).emit("chat-cleared", { chatId: normalizedFrom });

    // Broadcast to sender (all their tabs)
    const senderRoom = normalizedFrom.replace(/\s+/g, '_').toLowerCase();
    console.log(`  -> Broadcasting clear-chat to sender rooms: ${senderRoom}, ${normalizedFrom}`);
    io.to(senderRoom).to(normalizedFrom).emit("chat-cleared", { chatId: targetId });
  });




  socket.on("diagnostic-ping", (cb) => {
    console.log("🏓 Diagnostic Ping from:", socket.id);
    if (cb) cb("pong");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) onlineUsers.delete(uid);
    }

    const uniqueOnlineUids = Array.from(new Set(
      Array.from(onlineUsers.keys())
        .filter(k => userStore.has(k.toLowerCase()) && !k.startsWith("@"))
        .map(k => k.toLowerCase())
    ));
    io.emit("online-users", uniqueOnlineUids);
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
