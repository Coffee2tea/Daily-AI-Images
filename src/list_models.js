
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API KEY");
        return;
    }

    console.log("Fetching models...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log(`Found ${data.models.length} models:`);
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name} (${m.displayName})`);
                    console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
                }
            });

            // Check for image generation specific models
            const imageModels = data.models.filter(m => m.name.includes('image') || m.supportedGenerationMethods.includes('predict')); // 'predict' often used for older PaLM
            console.log("\nPotential Image Models:");
            imageModels.forEach(m => console.log(`- ${m.name}`));

        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

listModels();
