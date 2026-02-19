import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for cached AI images
const AI_IMAGES_DIR = path.join(__dirname, 'public', 'uploads', 'ai-images');

/**
 * Ensure the AI images directory exists
 */
export async function ensureAIImagesDir() {
    try {
        await fs.mkdir(AI_IMAGES_DIR, { recursive: true });
        console.log('✅ AI images directory ready:', AI_IMAGES_DIR);
    } catch (error) {
        console.error('❌ Failed to create AI images directory:', error);
    }
}

/**
 * Generate a unique filename based on the prompt
 * @param {string} prompt - The image generation prompt
 * @returns {string} - Hashed filename
 */
function generateFilename(prompt) {
    const hash = crypto.createHash('md5').update(prompt).digest('hex');
    return `${hash}.jpg`;
}

/**
 * Download image from URL and save to disk
 * @param {string} url - The image URL to download
 * @param {string} filepath - Local path to save the image
 * @returns {Promise<void>}
 */
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        console.log(`📥 Downloading image from: ${url.substring(0, 80)}...`);

        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(filepath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✅ Image saved to: ${filepath}`);
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlink(filepath).catch(() => { }); // Clean up partial file
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Download and cache an AI-generated image locally
 * @param {string} pollinationsUrl - The Pollinations.ai image URL
 * @param {string} prompt - The original prompt (for filename generation)
 * @returns {Promise<string>} - Local URL path (e.g., /uploads/ai-images/abc123.jpg)
 */
export async function downloadAndCacheImage(pollinationsUrl, prompt) {
    try {
        const filename = generateFilename(prompt);
        const filepath = path.join(AI_IMAGES_DIR, filename);
        const localUrl = `/uploads/ai-images/${filename}`;

        // Check if image already exists (cache hit)
        try {
            await fs.access(filepath);
            console.log(`🎯 Cache hit! Using existing image: ${filename}`);
            return localUrl;
        } catch {
            // File doesn't exist, proceed with download
        }

        // Download the image
        await downloadImage(pollinationsUrl, filepath);

        return localUrl;
    } catch (error) {
        console.error('❌ Image proxy error:', error);
        // Fallback: return original URL (will fail in browser, but won't crash)
        return pollinationsUrl;
    }
}
