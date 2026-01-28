
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function testImageGen() {
    console.log("Testing Native Image Generation with Gemini 2.5 Flash Image...");

    // Model ID from our analysis
    const modelId = 'gemini-2.5-flash-image';
    console.log(`Model: ${modelId}`);

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                responseModalities: ['IMAGE']
            }
        });

        console.log("Sending request...");
        const result = await model.generateContent("A cute retro robot t-shirt design");

        console.log("Response received.");
        if (result.response.candidates && result.response.candidates[0].content.parts[0].inlineData) {
            console.log("✅ Success! Image data received.");
            const dataBase64 = result.response.candidates[0].content.parts[0].inlineData.data;
            console.log(`   Data length: ${dataBase64.length}`);
        } else {
            console.log("❌ Failed. No image data found.");
            console.log(JSON.stringify(result, null, 2));
        }

    } catch (error) {
        console.error("❌ Generation Error:", error.message);
        if (error.response) console.error(JSON.stringify(error.response, null, 2));
    }
}

testImageGen();
