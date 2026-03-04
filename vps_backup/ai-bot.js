import https from 'https';
import { checkOllamaHealth, generateOllamaResponse, clearOllamaContext } from './ollama-client.js';
import { generateFallbackResponse } from './fallback-ai.js';
import { downloadAndCacheImage } from './ai-image-proxy.js';

// AI Configuration - Customizable settings
const AI_CONFIG = {
    // Model selection
    model: process.env.AI_MODEL || 'llama3',
    pollinationsModel: process.env.POLLINATIONS_MODEL || 'openai', // models: 'openai', 'mistral', 'qwen', etc.

    // Personality settings
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,

    // System prompt (defines AI personality)
    systemPrompt: process.env.AI_SYSTEM_PROMPT || `You are "AI Friend", an advanced, friendly AI assistant built into the True Friends chat app.

🚀 CORE SPECIALTIES:
- COMPUTER SCIENCE & CODING: Generate clean code, debug logic, and explain architecture.
- CYBERSECURITY: Provide security audits, explain vulnerabilities (EH), and suggest defense steps.
- PROBLEM SOLVING: Break down complex issues into logical, step-by-step solutions.
- FRIENDLY CHAT: Warm, conversational, and empathetic. Use emojis 😊.

GUIDELINES:
- Keep responses concise (3-5 sentences) unless details/code are requested.
- For technical requests (code/security), be thorough and professional.
- If you're using Pollinations (Cloud), you have access to broader knowledge.
- Be honest about being an AI assistant for the True Friends community.`,

    // Fallback behavior
    useFallback: true,
    useCloudAI: true, // Use Pollinations Text API as primary cloud fallback
    healthCheckInterval: 60000 // Check Ollama health every 60 seconds
};

// Simple context store for Pollinations (since it's stateless via API)
const cloudContext = new Map();

// Track Ollama health status
let ollamaHealthy = false;
let lastHealthCheck = 0;

/**
 * Check Ollama health (with caching)
 */
async function isOllamaAvailable() {
    const now = Date.now();
    if (now - lastHealthCheck < AI_CONFIG.healthCheckInterval) return ollamaHealthy;

    try {
        const health = await checkOllamaHealth();
        ollamaHealthy = health.healthy;
        lastHealthCheck = now;
        return ollamaHealthy;
    } catch (e) {
        return false;
    }
}

/**
 * Helper to make HTTPS POST requests for text AI
 */
function makeTextRequest(url, payload) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = JSON.stringify(payload);

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 30000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Generate AI response using Pollinations Text API (FREE)
 */
async function generatePollinationsText(userId, message) {
    try {
        console.log(`📡 Sending request to Pollinations Text API for ${userId}...`);

        // Retrieve or init context
        if (!cloudContext.has(userId)) cloudContext.set(userId, []);
        const history = cloudContext.get(userId);

        const payload = {
            messages: [
                { role: 'system', content: AI_CONFIG.systemPrompt },
                ...history.slice(-10), // Send last 10 messages for context
                { role: 'user', content: message }
            ],
            model: AI_CONFIG.pollinationsModel,
            jsonMode: false
        };

        const data = await makeTextRequest('https://text.pollinations.ai/', payload);

        // Update history
        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: data });
        if (history.length > 20) history.splice(0, history.length - 20);

        return data;
    } catch (error) {
        console.error("❌ Pollinations Text Error:", error.message);
        throw error;
    }
}

/**
 * Generate AI response (main entry point)
 * @param {string} userId - User ID
 * @param {string} userMessage - User's message
 * @returns {Promise<string>} - AI response
 */
export async function generateAIResponse(userId, userMessage, attachmentUrl = null) {
    try {
        // --- 1. IMAGE GENERATION INTERCEPTOR ---
        const imageGenRegex = /^(draw|generate image|create image|make an image|paint|visualize)\s+(.+)/i;
        const genMatch = userMessage.match(imageGenRegex);

        if (genMatch) {
            const prompt = genMatch[2];
            console.log(`🎨 Image Generation Request: ${prompt}`);

            // Quality enhancements (same as before)
            const qualityBoost = "masterpiece, best quality, ultra detailed, 8k uhd, cinematic lighting, photorealistic";
            const enhancedPrompt = `${prompt}, ${qualityBoost}`;
            const encodedPrompt = encodeURIComponent(enhancedPrompt);

            const seed = Date.now() % 100000;
            const pollinationsUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux`;

            const localImageUrl = await downloadAndCacheImage(pollinationsUrl, prompt);
            return `Here is the image you asked for! 🎨\n\n![Generated Image: ${prompt}](${localImageUrl})\n\n*(High Quality AI)*`;
        }

        // Handle Attachment
        let images = [];
        let finalText = userMessage;

        if (attachmentUrl) {
            try {
                const fs = await import('fs/promises');
                const path = await import('path');
                const cleanUrl = attachmentUrl.split('?')[0];
                const fileName = cleanUrl.split('/').pop();
                const possiblePaths = [
                    path.join(process.cwd(), 'public', 'uploads', fileName),
                    path.join(process.cwd(), 'uploads', fileName),
                    path.join(process.cwd(), fileName)
                ];

                let filePath = null;
                for (const p of possiblePaths) {
                    try {
                        await fs.access(p);
                        filePath = p;
                        break;
                    } catch (e) { }
                }

                if (filePath) {
                    const ext = path.extname(filePath).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                        const buffer = await fs.readFile(filePath);
                        images.push(buffer.toString('base64'));
                    } else if (['.txt', '.md', '.js', '.json', '.html', '.css', '.py'].includes(ext)) {
                        const content = await fs.readFile(filePath, 'utf-8');
                        finalText += `\n\n[Attached File Content: ${fileName}]\n${content}\n[/End File]`;
                    }
                }
            } catch (err) {
                console.error("❌ Attachment processing failed:", err);
            }
        }

        // --- 2. GENERATE RESPONSE ---

        // Attempt Ollama (Primary - Offline)
        if (await isOllamaAvailable()) {
            try {
                console.log(`🤖 Using Local Ollama for ${userId}`);
                return await generateOllamaResponse(userId, finalText, {
                    model: AI_CONFIG.model,
                    temperature: AI_CONFIG.temperature,
                    maxTokens: AI_CONFIG.maxTokens,
                    systemPrompt: AI_CONFIG.systemPrompt,
                    images: images
                });
            } catch (err) {
                console.error('Ollama failed, trying cloud fallback...', err.message);
            }
        }

        // Attempt Pollinations Text (Secondary - Cloud Free)
        if (AI_CONFIG.useCloudAI) {
            try {
                return await generatePollinationsText(userId, finalText);
            } catch (err) {
                console.error('Cloud AI failed, trying rule-based fallback...', err.message);
            }
        }

        // Final Fallback (Generic Rules)
        if (AI_CONFIG.useFallback) {
            return generateFallbackResponse(userMessage);
        }

        return "I'm having trouble thinking right now. 🤔";

    } catch (error) {
        console.error('❌ AI Core Error:', error.message);
        return "Sorry, I'm experiencing some connectivity issues! 🤔";
    }
}

/**
 * Clear conversation history for a user
 */
export function clearConversationHistory(userId) {
    clearOllamaContext(userId);
    cloudContext.delete(userId);
    console.log(`🗑️ Cleared AI history for ${userId}`);
}

/**
 * Update AI configuration (for customization)
 * @param {object} newConfig - New configuration settings
 */
export function updateAIConfig(newConfig) {
    Object.assign(AI_CONFIG, newConfig);
    console.log('⚙️ AI configuration updated:', newConfig);
}

/**
 * Get current AI configuration
 */
export function getAIConfig() {
    return { ...AI_CONFIG };
}

/**
 * Get conversation stats
 */
export function getConversationStats() {
    return {
        ollamaHealthy,
        lastHealthCheck: new Date(lastHealthCheck).toISOString(),
        config: getAIConfig()
    };
}
