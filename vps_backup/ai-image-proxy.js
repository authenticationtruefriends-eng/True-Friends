import https from 'https';
import http from 'http';
import fs from 'fs';
import fsPromises from 'fs/promises';
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
        await fsPromises.mkdir(AI_IMAGES_DIR, { recursive: true });
        console.log('✅ AI images directory ready:', AI_IMAGES_DIR);
    } catch (error) {
        console.error('❌ Failed to create AI images directory:', error);
    }
}

/**
 * Generate a unique filename base based on the prompt
 * @param {string} prompt - The image generation prompt
 * @returns {string} - Hashed filename base
 */
function generateFileBase(prompt) {
    return crypto.createHash('md5').update(prompt).digest('hex');
}

/**
 * Maps MIME types to file extensions
 */
const MIME_MAP = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif'
};

/**
 * Download image from URL and save to disk
 * @param {string} url - The image URL to download
 * @param {string} fileBase - Local filename without extension
 * @param {string} targetDir - Directory to save in
 * @returns {Promise<string>} - The final relative path
 */
function downloadImage(url, fileBase, targetDir, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            return reject(new Error('Too many redirects'));
        }

        const protocol = url.startsWith('https') ? https : http;
        console.log(`📥 Downloading image from: ${url.substring(0, 80)}... (redirect: ${redirectCount})`);

        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            timeout: 30000 // 30 second timeout
        };

        const req = protocol.get(url, requestOptions, (response) => {
            // Follow redirects (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                const redirectUrl = response.headers.location;
                if (!redirectUrl) {
                    return reject(new Error(`Redirect with no location header: HTTP ${response.statusCode}`));
                }

                // Handle relative redirects
                let absoluteRedirectUrl = redirectUrl;
                if (!redirectUrl.startsWith('http')) {
                    const originalUrl = new URL(url);
                    absoluteRedirectUrl = `${originalUrl.protocol}//${originalUrl.host}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
                }

                console.log(`↪️ Following redirect to: ${absoluteRedirectUrl.substring(0, 80)}...`);
                response.resume();
                return downloadImage(absoluteRedirectUrl, fileBase, targetDir, redirectCount + 1).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
            }

            // Determine extension from Content-Type
            const contentType = response.headers['content-type'] || '';

            // STRICT IMAGE CHECK: Reject if it's HTML or missing content-type
            if (contentType.includes('text/html') || !contentType.includes('image')) {
                response.resume();
                return reject(new Error(`Rejected non-image content: ${contentType}`));
            }

            const extension = MIME_MAP[contentType] || '.jpg';
            const filename = `${fileBase}${extension}`;
            const filepath = path.join(targetDir, filename);
            const localUrl = `/uploads/ai-images/${filename}`;

            const fileStream = fs.createWriteStream(filepath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✅ Image saved to: ${filepath}`);
                resolve(localUrl);
            });

            fileStream.on('error', (err) => {
                fsPromises.unlink(filepath).catch(() => { });
                reject(err);
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
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
        const fileBase = generateFileBase(prompt);

        // Scan directory for existing file with any known extension
        const files = await fsPromises.readdir(AI_IMAGES_DIR);
        const existingFile = files.find(f => f.startsWith(fileBase));

        if (existingFile) {
            console.log(`🎯 Cache hit! Using existing image: ${existingFile}`);
            return `/uploads/ai-images/${existingFile}`;
        }

        // Download the image and get the final URL
        return await downloadImage(pollinationsUrl, fileBase, AI_IMAGES_DIR);
    } catch (error) {
        console.error('❌ Image proxy error:', error);
        // Fallback: return original URL (will likely fail in browser due to CORS, but better than nothing)
        return pollinationsUrl;
    }
}
