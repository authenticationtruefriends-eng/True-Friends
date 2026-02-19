import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 Testing Gemini API Key...\n');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC_UBXk8C3yzzCh1jLn1A3_tuW8lvN1b9o';

console.log(`API Key: ${GEMINI_API_KEY.substring(0, 20)}...`);
console.log('');

async function testGemini() {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        console.log('📡 Sending test prompt to Gemini...');
        const startTime = Date.now();

        const result = await model.generateContent('Say "Hello! I am working!" in a friendly way.');
        const response = await result.response;
        const text = response.text();

        const elapsed = Date.now() - startTime;

        console.log(`\n✅ SUCCESS! (${elapsed}ms)`);
        console.log(`\n🤖 Gemini Response:`);
        console.log(`"${text}"`);
        console.log(`\n🎉 The API key is VALID and working!`);

    } catch (error) {
        console.error(`\n❌ FAILED: ${error.message}`);

        if (error.message.includes('API_KEY_INVALID')) {
            console.log(`\n⚠️  The API key is INVALID or has been revoked.`);
            console.log(`   Generate a new one at: https://makersuite.google.com/app/apikey`);
        } else if (error.message.includes('quota')) {
            console.log(`\n⚠️  API quota exceeded. Wait a few minutes and try again.`);
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
            console.log(`\n⚠️  Network error - your WiFi might be blocking Google AI APIs.`);
            console.log(`   Try: Mobile hotspot or VPN`);
        } else {
            console.log(`\n⚠️  Unknown error. Full details above.`);
        }
    }
}

testGemini();
