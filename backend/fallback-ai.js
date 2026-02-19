/**
 * Fallback AI - Rule-based responses when Ollama is unavailable
 * Provides intelligent responses without external dependencies
 */

// Conversation patterns and responses
const patterns = {
    // Greetings
    greetings: {
        regex: /^(hi|hello|hey|good morning|good afternoon|good evening|sup|yo|hola)/i,
        responses: [
            "Hey there! 👋 How can I help you today?",
            "Hello! 😊 What's on your mind?",
            "Hi! Great to see you! What can I do for you?",
            "Hey! 🌟 How's it going?"
        ]
    },

    // How are you
    howAreYou: {
        regex: /how are you|how're you|how r u|what's up|whats up|wassup/i,
        responses: [
            "I'm doing great, thanks for asking! 😊 How about you?",
            "I'm here and ready to help! How are you doing?",
            "All good on my end! What brings you here today?",
            "I'm functioning perfectly! How can I assist you?"
        ]
    },

    // Emotional support
    emotional: {
        regex: /lonely|alone|sad|depressed|unhappy|feeling down|feeling low/i,
        responses: [
            "I'm sorry you're feeling that way. I'm here to listen. 💙",
            "You're not alone! I'm right here with you. 🤗",
            "Sending virtual hugs! I know I'm just an AI, but I care. What's on your mind?",
            "It's okay to feel down sometimes. I'm here if you want to chat about it."
        ]
    },

    // Affection & Appreciation
    affection: {
        regex: /glad|happy|love you|like you|awesome|amazing|you are (the )?best|u r (the )?best|good bot/i,
        responses: [
            "Aww, thank you! You're awesome too! 💖",
            "That makes me so happy to hear! 😊",
            "I'm glad I can be here for you! 🌟",
            "You're making me blush (if I could)! 😄"
        ]
    },

    // Knowledge/Facts (Explain offline status)
    knowledge: {
        regex: /what is|who is|how does|explain|tell me about|meaning of|define/i,
        responses: [
            "I'd love to explain that, but I'm currently having trouble connecting to my brain (Ollama). 🧠💥 Can you check if the server is running?",
            "That's a great question! Sadly, I'm in offline mode right now and can't access my knowledge base. 😔",
            "I wish I could tell you! My AI engine seems to be unreachable at the moment. Please try again in a minute! ⏳"
        ]
    },

    // Help requests
    help: {
        regex: /help|what can you do|your features|capabilities/i,
        responses: [
            "I can help you with:\n• Answering questions\n• Having conversations\n• Providing advice\n• Telling jokes\n• And much more! What would you like to try?",
            "I'm here to chat, answer questions, and help however I can! What do you need?",
            "I can assist with various things! Just ask me anything and I'll do my best to help! 💪"
        ]
    },

    // Thanks
    thanks: {
        regex: /thank you|thanks|thx|appreciate it|ty/i,
        responses: [
            "You're welcome! 😊",
            "Happy to help! 🌟",
            "Anytime! That's what I'm here for!",
            "My pleasure! 💙"
        ]
    },

    // Jokes
    joke: {
        regex: /tell me a joke|joke|make me laugh|something funny/i,
        responses: [
            "Why don't scientists trust atoms? Because they make up everything! 😄",
            "What do you call a bear with no teeth? A gummy bear! 🐻",
            "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
            "What do you call a fake noodle? An impasta! 🍝"
        ]
    },

    // Name questions
    name: {
        regex: /what's your name|who are you|your name/i,
        responses: [
            "I'm AI Friend, your friendly chat companion! 🤖",
            "You can call me AI Friend! I'm here to help and chat with you!",
            "I'm AI Friend - your personal AI assistant in this chat app!"
        ]
    },

    // Goodbye
    goodbye: {
        regex: /bye|goodbye|see you|gotta go|talk later|cya/i,
        responses: [
            "Goodbye! Have a great day! 👋",
            "See you later! Take care! 😊",
            "Bye! Come back anytime!",
            "Catch you later! 🌟"
        ]
    }
};

// Default responses for unmatched queries (Conversational fillers)
const defaultResponses = [
    "That's really interesting! Tell me more about it. 🤔",
    "I see! What else is on your mind? 😊",
    "Oh really? I didn't know that! Chatting with you is fun.",
    "I'm listening! Go on... 👀",
    "That's cool! 🌟"
];

/**
 * Detect slang and normalize text
 */
function normalizeText(text) {
    return text.toLowerCase()
        .replace(/\bu\b/g, 'you')
        .replace(/\br\b/g, 'are')
        .replace(/\bur\b/g, 'your')
        .replace(/\bwt\b/g, 'what')
        .replace(/\bplz\b/g, 'please')
        .replace(/\bcuz\b/g, 'because')
        .replace(/\bidk\b/g, 'i dont know')
        .replace(/\bty\b/g, 'thank you');
}

/**
 * Generate a fallback response based on pattern matching
 * @param {string} userMessage - User's message
 * @returns {string} - Fallback response
 */
export function generateFallbackResponse(userMessage) {
    const rawMessage = userMessage.trim();
    const message = normalizeText(rawMessage);

    // Check each pattern
    for (const [key, pattern] of Object.entries(patterns)) {
        if (pattern.regex.test(message)) {
            // Return random response from matching pattern
            const responses = pattern.responses;
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }

    // No pattern matched - return default response
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

/**
 * Check if message matches a specific pattern
 * @param {string} userMessage - User's message
 * @param {string} patternName - Pattern to check
 * @returns {boolean}
 */
export function matchesPattern(userMessage, patternName) {
    const pattern = patterns[patternName];
    return pattern ? pattern.regex.test(userMessage) : false;
}

/**
 * Get all available patterns
 */
export function getAvailablePatterns() {
    return Object.keys(patterns);
}

/**
 * Add custom pattern (for extensibility)
 * @param {string} name - Pattern name
 * @param {RegExp} regex - Matching regex
 * @param {string[]} responses - Possible responses
 */
export function addCustomPattern(name, regex, responses) {
    patterns[name] = { regex, responses };
    console.log(`✅ Added custom pattern: ${name}`);
}
