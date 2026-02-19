import CryptoJS from 'crypto-js';

const SECRET_KEY = "TRUE_FRIENDS_SECRET_V1_2026"; // Must match frontend key

// Check if string is encrypted
const isEncrypted = (str) => {
    return typeof str === 'string' && str.startsWith('U2FsdGVkX1');
};

// Decrypt message text
export const decryptMessage = (cipherText) => {
    if (!cipherText) return "";
    if (!isEncrypted(cipherText)) return cipherText; // Already decrypted

    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || cipherText;
    } catch (e) {
        console.error("Decryption Error:", e);
        return cipherText;
    }
};

// Encrypt message text
export const encryptMessage = (text) => {
    if (!text) return text;
    try {
        return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    } catch (e) {
        console.error("Encryption Error:", e);
        return text;
    }
};
