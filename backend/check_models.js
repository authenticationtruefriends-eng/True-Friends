import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("Checking available models...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        // check if we can actually access the list via a simpler client call if available, 
        // but the SDK structure is usually specific. 
        // Actually, standard list is not clearly exposed in the simplified SDK sometimes, 
        // but let's try to just output what we are using.

        // Better approach: trying common names
        console.log("Testing gemini-1.5-flash-001...");
        const model1 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
        const result1 = await model1.generateContent("Test");
        console.log("SUCCESS: gemini-1.5-flash-001 works!");
    } catch (error) {
        console.error("Error with gemini-1.5-flash-001:", error.message);
    }

    try {
        console.log("Testing gemini-pro...");
        const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result2 = await model2.generateContent("Test");
        console.log("SUCCESS: gemini-pro works!");
    } catch (error) {
        console.error("Error with gemini-pro:", error.message);
    }
}

listModels();
