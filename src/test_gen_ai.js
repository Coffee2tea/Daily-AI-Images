
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function testSvgGen() {
    console.log("Testing SVG Generation with Gemini 2.0 Flash...");
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        console.log("Sending request...");
        const result = await model.generateContent("Generate an SVG string for a cute retro robot t-shirt design. Return only the SVG code.");

        console.log("Response received.");
        const text = result.response.text();
        console.log("Preview:", text.substring(0, 200));

        if (text.includes("<svg")) {
            console.log("Success! SVG generated.");
        } else {
            console.log("No SVG found.");
        }

    } catch (error) {
        console.error("SVG Gen Error:", error);
    }
}

testSvgGen();
