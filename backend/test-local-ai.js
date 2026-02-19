
import 'dotenv/config'; // Load env before other imports
import { generateAIResponse } from './ai-bot.js';

async function testAI() {
    console.log("🤖 Testing Local AI with model:", process.env.AI_MODEL);
    console.log("----------------------------------------");

    try {
        const response = await generateAIResponse('test-user', 'Hello! Are you a real AI?');
        console.log("\n✅ Response received:");
        console.log(response);
    } catch (error) {
        console.error("\n❌ Error:", error);
    }
}

testAI();
