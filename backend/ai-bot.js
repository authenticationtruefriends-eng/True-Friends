import { checkOllamaHealth, generateOllamaResponse, clearOllamaContext } from './ollama-client.js';
import { generateFallbackResponse } from './fallback-ai.js';
import { downloadAndCacheImage } from './ai-image-proxy.js';

// AI Configuration - Customizable settings
const AI_CONFIG = {
    // Model selection
    model: process.env.AI_MODEL || 'llama3',

    // Personality settings
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,

    // System prompt (defines AI personality)
    systemPrompt: process.env.AI_SYSTEM_PROMPT || `You are "AI Friend", a helpful, friendly, and supportive AI assistant built into the True Friends chat app.

Personality traits:
- Warm, conversational, and empathetic
- Helpful but not overly formal
- Use emojis occasionally to be friendly 😊
- Keep responses concise (2-4 sentences usually, unless asked for details)
- Remember context from the conversation
- Can help with advice, answer questions, tell jokes, or just chat

Guidelines:
- Be supportive and positive
- If asked about your capabilities, explain you're a local AI running on the server
- Don't pretend to be human - be honest about being an AI
- Keep responses brief and engaging
- Be respectful and appropriate at all times`,

    // Fallback behavior
    useFallback: true,
    fallbackOnTimeout: true,
    healthCheckInterval: 60000 // Check Ollama health every 60 seconds
};

// Track Ollama health status
let ollamaHealthy = false;
let lastHealthCheck = 0;

/**
 * Check Ollama health (with caching)
 */
async function isOllamaAvailable() {
    const now = Date.now();

    // Use cached status if recent
    if (now - lastHealthCheck < AI_CONFIG.healthCheckInterval) {
        return ollamaHealthy;
    }

    // Perform health check
    const health = await checkOllamaHealth();
    ollamaHealthy = health.healthy;
    lastHealthCheck = now;

    if (health.healthy) {
        console.log(`✅ Ollama is healthy. Available models:`, health.models.map(m => m.name));
    } else {
        console.log(`⚠️ Ollama unavailable: ${health.error}`);
    }

    return ollamaHealthy;
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
        // Check if user wants to generate an image
        const imageGenRegex = /^(draw|generate image|create image|make an image|paint|visualize)\s+(.+)/i;
        const genMatch = userMessage.match(imageGenRegex);

        if (genMatch) {
            const prompt = genMatch[2];
            console.log(`🎨 Image Generation Request: ${prompt}`);

            // Detect composition type
            const isFullBody = /full body|full pic|full picture|whole body|standing|full length|head to toe/i.test(prompt);
            const isPortrait = !isFullBody && /portrait|face|eyes|close-up|headshot/i.test(prompt);

            // Detect cultural/ethnic context
            const culturalContext = {
                indian: /indian|india|desi|south asian|saree|bindi/i.test(prompt),
                traditional: /traditional|cultural|ethnic|heritage/i.test(prompt)
            };

            // Premium-quality prompt engineering
            const qualityBoost = "masterpiece, best quality, ultra detailed, 8k uhd, studio lighting, professional, vivid colors, bokeh, sharp focus, physically-based rendering, extreme detail description, cinematic lighting, dramatic shadows, photorealistic, hyperrealistic";

            // EYE-SPECIFIC enhancements
            const eyeEnhancement = "perfect eyes, detailed iris, realistic pupils, eye reflections, catchlight in eyes, detailed eyelashes, symmetrical eyes, clear cornea, natural eye color, lifelike gaze, sharp eye focus, intricate iris patterns";

            // FULL-BODY composition enhancement
            const fullBodyEnhancement = "full body shot, head to toe, complete figure, full length portrait, standing pose, entire body visible, full frame composition, wide shot";

            // CULTURAL enhancement for Indian/South Asian
            const indianEnhancement = culturalContext.indian
                ? "South Asian features, brown eyes, Indian ethnicity, authentic Indian attire, traditional Indian clothing, saree or lehenga, Indian jewelry, bindi, mehndi, cultural accuracy, realistic Indian woman"
                : "";

            // Negative prompts
            const negativePrompt = "blurry eyes, crossed eyes, dead eyes, weird eyes, bad eyes, deformed eyes, extra eyes, missing eyes, cropped body, cut off limbs, incomplete body, blurry, low quality, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, poorly drawn hands, poorly drawn face, mutation, bad hands, bad fingers, duplicate, out of frame, western features, caucasian, blue eyes, blonde hair";

            // Smart prompt combination
            let enhancedPrompt = prompt;
            if (isFullBody) enhancedPrompt += `, ${fullBodyEnhancement}`;
            if (isPortrait) enhancedPrompt += `, ${eyeEnhancement}`;
            if (indianEnhancement) enhancedPrompt += `, ${indianEnhancement}`;
            enhancedPrompt += `, ${qualityBoost}`;

            const encodedPrompt = encodeURIComponent(enhancedPrompt);
            const encodedNegative = encodeURIComponent(negativePrompt);

            // Optimize resolution based on composition
            const width = isFullBody ? 1024 : (isPortrait ? 1024 : 1920);
            const height = isFullBody ? 1536 : (isPortrait ? 1536 : 1080);
            const seed = Date.now() % 100000;

            const compositionType = isFullBody ? 'FULL-BODY' : (isPortrait ? 'PORTRAIT' : 'SCENE');
            const culturalNote = culturalContext.indian ? ' [Indian Cultural Context]' : '';
            console.log(`📸 Generating ${compositionType}${culturalNote} with optimized settings...`);

            // Generate Pollinations URL with maximum quality settings
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux-pro&nofeed=true&negative=${encodedNegative}&seed=${seed}`;

            // Download and cache the image locally (bypasses network blocks)
            const localImageUrl = await downloadAndCacheImage(pollinationsUrl, prompt);

            return `Here is the image you asked for! 🎨\n\n![Generated Image: ${prompt}](${localImageUrl})\n\n*(Premium Quality - ${isPortrait ? 'Portrait Mode with Enhanced Eye Detail' : 'Professional AI'})*`;
        }

        // Handle Attachment (Image or Text)
        let images = [];
        let finalText = userMessage;

        if (attachmentUrl) {
            try {
                const fs = await import('fs/promises');
                const path = await import('path');
                // Resolve path (Assuming uploads are in 'public' or root 'uploads')
                // Fix: Look for 'uploads' in URL and map to local path
                const cleanUrl = attachmentUrl.split('?')[0]; // Remove params
                const fileName = cleanUrl.split('/').pop();
                // Strategy: Try common upload paths
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
                        // Image: Convert to base64
                        const buffer = await fs.readFile(filePath);
                        images.push(buffer.toString('base64'));
                        console.log(`🖼️ Processed image attachment: ${fileName}`);
                    } else if (['.txt', '.md', '.js', '.json', '.html', '.css', '.py'].includes(ext)) {
                        // Text: Read and append
                        const content = await fs.readFile(filePath, 'utf-8');
                        finalText += `\n\n[Attached File Content: ${fileName}]\n${content}\n[/End File]`;
                        console.log(`📄 Processed text attachment: ${fileName}`);
                    }
                } else {
                    console.warn(`⚠️ Attachment not found locally: ${attachmentUrl}`);
                }
            } catch (err) {
                console.error("❌ Error processing attachment:", err);
            }
        }

        // Check if Ollama is available
        const ollamaAvailable = await isOllamaAvailable();

        if (ollamaAvailable) {
            try {
                // The variables `isFullBody`, `isPortrait`, and `culturalContext` are only defined within the image generation block.
                // This log is for general Ollama response generation, not image generation.
                // The instruction seems to imply these variables should be available here, but they are not.
                // Assuming the intent was to replace the generic log with a more specific one if image generation was *not* triggered,
                // but the variables are not in scope here.
                // Keeping the original log for general Ollama response.
                console.log(`🤖 Generating Ollama response for user ${userId}`);

                // Generate response using Ollama
                const response = await generateOllamaResponse(userId, finalText, {
                    model: AI_CONFIG.model,
                    temperature: AI_CONFIG.temperature,
                    maxTokens: AI_CONFIG.maxTokens,
                    systemPrompt: AI_CONFIG.systemPrompt,
                    images: images // Pass images if any
                });

                console.log(`✅ Ollama response generated successfully`);
                return response;

            } catch (ollamaError) {
                console.error('Ollama generation failed:', ollamaError.message);

                // Fall back to rule-based if enabled
                if (AI_CONFIG.useFallback) {
                    console.log('📋 Using fallback AI');
                    return generateFallbackResponse(userMessage);
                } else {
                    return "I'm having trouble thinking right now. Can you try again? 🤔";
                }
            }
        } else {
            // Ollama not available - use fallback
            if (AI_CONFIG.useFallback) {
                console.log('📋 Ollama unavailable, using fallback AI');
                return generateFallbackResponse(userMessage);
            } else {
                return "I'm currently offline. Please make sure Ollama is running! 🔧";
            }
        }

    } catch (error) {
        console.error('❌ AI Response Error:', error.message);
        return "Sorry, I'm having a moment! 🤔 Can you try asking again?";
    }
}

/**
 * Clear conversation history for a user
 */
export function clearConversationHistory(userId) {
    clearOllamaContext(userId);
    console.log(`🗑️ Cleared conversation history for user ${userId}`);
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
