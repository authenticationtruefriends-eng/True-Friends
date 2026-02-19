import CryptoJS from 'crypto-js';

const SECRET_KEY = "TRUE_FRIENDS_SECRET_V1_2026"; // In a real app, this should be an env var or derived per-user
const STORAGE_SECRET_KEY = "TRUE_FRIENDS_STORAGE_V1"; // Separate key for localStorage

// Helper to check if string is encrypted (starts with Salted__)
const isEncrypted = (str) => {
    return typeof str === 'string' && str.startsWith('U2FsdGVkX1');
};

/**
 * Optimized conversion of ArrayBuffer to Base64
 * Handles large buffers without stack overflow and is faster than btoa(String.fromCharCode(...))
 */
export const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export const encryptMessage = (text) => {
    if (!text) return text;
    try {
        return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    } catch (e) {
        console.error("Encryption Error:", e);
        return text;
    }
};

export const decryptMessage = (cipherText) => {
    if (!cipherText) return "";
    if (!isEncrypted(cipherText)) return cipherText; // Backward compatibility

    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || cipherText; // Fallback if decrypt fails (wrong key/corrupt)
    } catch (e) {
        console.error("Decryption Error:", e);
        return cipherText;
    }
};

// For Local Storage (Store entire object encrypted)
export const encryptStorage = (data) => {
    try {
        return CryptoJS.AES.encrypt(JSON.stringify(data), STORAGE_SECRET_KEY).toString();
    } catch (e) {
        console.error("Storage Encryption Error:", e);
        return JSON.stringify(data);
    }
};

export const decryptStorage = (cipherText) => {
    if (!cipherText) return null;
    try {
        // Check if it looks like JSON already (unencrypted legacy)
        if (cipherText.trim().startsWith('{') || cipherText.trim().startsWith('[')) {
            return JSON.parse(cipherText);
        }

        const bytes = CryptoJS.AES.decrypt(cipherText, STORAGE_SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(originalText);
    } catch (e) {
        console.error("Storage Decryption Error:", e);
        return null; // Return null so app can handle empty/fallback
    }
};

export const decryptMessageObject = (msg) => {
    if (!msg) return msg;
    const decrypted = {
        ...msg,
        text: decryptMessage(msg.text)
    };
    if (msg.replyTo && msg.replyTo.text) {
        decrypted.replyTo = {
            ...msg.replyTo,
            text: decryptMessage(msg.replyTo.text)
        };
    }
    return decrypted;
};

// ============================================
// FILE ENCRYPTION (for images, documents, etc.)
// ============================================

// Web Crypto API Helper: Derive a persistent key from the SECRET_KEY string
let cachedCryptoKey = null;
const getCryptoKey = async () => {
    if (cachedCryptoKey) return cachedCryptoKey;

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(SECRET_KEY),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    cachedCryptoKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("TRUE_FRIENDS_SALT_V1"), // Matches backend if shared
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    return cachedCryptoKey;
};

/**
 * Encrypt a single chunk of a file using AES-GCM
 * @param {ArrayBuffer} chunk 
 * @returns {Promise<{encryptedChunk: ArrayBuffer, iv: Uint8Array}>}
 */
export const encryptFileChunk = async (chunk) => {
    try {
        const key = await getCryptoKey();
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            chunk
        );
        return { encryptedChunk: encrypted, iv };
    } catch (error) {
        console.error("Chunk encryption error:", error);
        throw error;
    }
};

/**
 * Decrypt a single chunk of a file
 * @param {ArrayBuffer} encryptedChunk 
 * @param {Uint8Array} iv 
 * @returns {Promise<ArrayBuffer>}
 */
export const decryptFileChunk = async (encryptedChunk, iv) => {
    try {
        const key = await getCryptoKey();
        return await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encryptedChunk
        );
    } catch (error) {
        console.error("Chunk decryption error:", error);
        throw error;
    }
};

/**
 * Encrypt a file using Web Crypto API (Standard for new files)
 * @param {File} file 
 * @returns {Promise<Object>}
 */
export const encryptFile = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const { encryptedChunk, iv } = await encryptFileChunk(arrayBuffer);

        // Convert IV to string and Encrypted data to Base64 for transit
        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const base64Content = arrayBufferToBase64(encryptedChunk);

        return {
            encryptedData: base64Content,
            iv: ivHex,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            version: 'v2' // Web Crypto / GCM
        };
    } catch (error) {
        // Fallback to legacy if Web Crypto fails (unlikely in modern browsers)
        console.warn('Web Crypto failed, falling back to legacy CryptoJS:', error);
        return encryptFileLegacy(file);
    }
};

// Internal legacy helper (old implementation)
const encryptFileLegacy = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    const encrypted = CryptoJS.AES.encrypt(wordArray, SECRET_KEY).toString();
    return {
        encryptedData: encrypted,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        version: 'v1'
    };
};

/**
 * Decrypt a file for display/download
 * Detects version and uses appropriate method
 */
export const decryptFileToBlob = async (encryptedData, mimeType, ivHex = null, version = 'v1') => {
    try {
        let actualData = encryptedData;

        // If data is string, it might be base64 (v2) or raw encrypted string (v1)
        if (version === 'v2' && typeof encryptedData === 'string' && ivHex) {
            try {
                const binaryString = atob(encryptedData);
                actualData = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    actualData[i] = binaryString.charCodeAt(i);
                }
            } catch (e) {
                console.error("Failed to decode base64 encryptedData for v2:", e);
                // Keep as is, maybe it's already binary?
            }
        }

        if (version === 'v3') {
            const key = await getCryptoKey();
            const CHUNK_DATA_SIZE = 5 * 1024 * 1024; // 5MB
            const GCM_TAG_SIZE = 16;
            const IV_SIZE = 12;
            const FRAME_SIZE = IV_SIZE + CHUNK_DATA_SIZE + GCM_TAG_SIZE;

            const decryptedChunks = [];
            const dataView = new Uint8Array(actualData);
            let offset = 0;

            while (offset < dataView.length) {
                // Determine current frame size (last one might be smaller)
                const remaining = dataView.length - offset;
                // If remaining is less than IV + Tag, something is wrong
                if (remaining < IV_SIZE + GCM_TAG_SIZE) break;

                const iv = dataView.slice(offset, offset + IV_SIZE);
                offset += IV_SIZE;

                // The encrypted part (includes tag)
                // For all but last chunk, it's CHUNK_DATA_SIZE + GCM_TAG_SIZE
                // But we can just take the minimum of remaining vs the expected frame's encrypted part
                const encryptedPartSize = Math.min(CHUNK_DATA_SIZE + GCM_TAG_SIZE, dataView.length - offset);
                const encryptedPart = dataView.slice(offset, offset + encryptedPartSize);
                offset += encryptedPartSize;

                const decrypted = await window.crypto.subtle.decrypt(
                    { name: "AES-GCM", iv },
                    key,
                    encryptedPart
                );
                decryptedChunks.push(decrypted);
            }

            return new Blob(decryptedChunks, { type: mimeType });
        }

        if (version === 'v2' && ivHex) {
            const key = await getCryptoKey();
            const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                actualData
            );
            return new Blob([decrypted], { type: mimeType });
        } else {
            // Legacy CryptoJS
            const decrypted = CryptoJS.AES.decrypt(actualData, SECRET_KEY);
            const typedArray = wordArrayToUint8Array(decrypted);
            return new Blob([typedArray], { type: mimeType });
        }
    } catch (error) {
        console.error('File decryption error:', error);
        throw error;
    }
};

/**
 * Helper: Convert CryptoJS WordArray to Uint8Array
 */
const wordArrayToUint8Array = (wordArray) => {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    return u8;
};

/**
 * Check if a file URL points to an encrypted file
 */
export const isEncryptedFile = (fileUrl) => {
    if (!fileUrl) return false;
    return fileUrl.includes('.enc') || fileUrl.includes('encrypted=true');
};
