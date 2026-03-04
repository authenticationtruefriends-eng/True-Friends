import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        console.log("Fetching models...");
        // Use the native fetch approach to list models if SDK doesn't expose it easily
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("\n✅ Available Models:");
            data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.log("\n❌ No models found in response:", JSON.stringify(data));
        }
    } catch (error) {
        console.error("❌ Error listing models:", error.message);
    }
}

listModels();
