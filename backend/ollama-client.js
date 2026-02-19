// import fetch from 'node-fetch'; // Using native Node.js fetch

/**
 * Ollama Client - Wrapper for local Ollama API
 * Supports Llama 3, Mistral, Phi-3, and other models
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Store conversation context per user
const conversationContexts = new Map();

/**
 * Check if Ollama is running and healthy
 */
export async function checkOllamaHealth() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000) // 2 second timeout
        });

        if (response.ok) {
            const data = await response.json();
            return {
                healthy: true,
                models: data.models || []
            };
        }
        return { healthy: false, error: 'Ollama not responding' };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}

/**
 * Generate AI response using Ollama
 * @param {string} userId - User ID for context management
 * @param {string} userMessage - User's message
 * @param {object} options - Customization options
 * @returns {Promise<string>} - AI response
 */
export async function generateOllamaResponse(userId, userMessage, options = {}) {
    const {
        model = 'phi3:latest',
        temperature = 0.7,
        maxTokens = 500,
        systemPrompt = null,
        images = []
    } = options;

    try {
        // Get or create conversation context
        if (!conversationContexts.has(userId)) {
            conversationContexts.set(userId, []);
        }
        const context = conversationContexts.get(userId);

        // Build messages array
        const messages = [];

        // 1. System Prompt
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // 2. Chat history
        if (context.length > 0) {
            messages.push(...context);
        }

        // 3. User Message
        const userMsgObj = { role: 'user', content: userMessage };
        if (options.images && options.images.length > 0) {
            userMsgObj.images = options.images;
        }
        messages.push(userMsgObj);

        const requestBody = {
            model: model,
            messages: messages,
            stream: false,
            options: {
                temperature: temperature
            }
        };

        console.log(`🤖 Sending request to Ollama /api/chat (${model})...`);

        // Call Ollama API (Chat Endpoint)
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(300000) // 5 minutes timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Ollama Error Body: ${errorText}`);
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const aiResponse = data.message.content.trim();

        // Update conversation context (Store objects for direct API usage)
        context.push({ role: 'user', content: userMessage });
        context.push({ role: 'assistant', content: aiResponse });

        // Keep last 20 messages for context window management
        if (context.length > 20) context.splice(0, context.length - 20);

        return aiResponse;

    } catch (error) {
        console.error('Ollama generation error:', error.message);
        throw error;
    }
}

/**
 * Clear conversation context for a user
 */
export function clearOllamaContext(userId) {
    conversationContexts.delete(userId);
    console.log(`🗑️ Cleared Ollama context for user ${userId}`);
}

/**
 * Get available models from Ollama
 */
export async function getAvailableModels() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error('Failed to get models:', error);
        return [];
    }
}

/**
 * Get conversation stats
 */
export function getOllamaStats() {
    return {
        activeUsers: conversationContexts.size,
        totalMessages: Array.from(conversationContexts.values())
            .reduce((sum, ctx) => sum + ctx.length, 0)
    };
}
