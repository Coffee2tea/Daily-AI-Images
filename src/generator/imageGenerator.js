/**
 * AI Image Generator - Uses Gemini 2.0 Flash to generate actual T-shirt design images (PNG)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(rootDir, 'data');
const OUTPUT_DIR = path.join(rootDir, 'generated_images');

async function generateImagesInternal() {
    console.log('\n🎨 Starting AI image generation (Internal - Parallel Batches)...');

    try {
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        if (!fs.existsSync(ideasPath)) {
            console.log('   ❌ No ideas found.');
            return [];
        }

        const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
        console.log(`   📝 Loaded ${ideas.length} ideas`);

        if (!process.env.GEMINI_API_KEY) {
            console.log('   ⚠️ No API key. Creating placeholders...');
            return createPlaceholders(ideas);
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Use Gemini 2.0 Flash with native image generation
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                responseModalities: ['IMAGE']
            }
        });

        const manifest = { generatedAt: new Date().toISOString(), images: [] };

        // Batch processing to respect rate limits while improving speed
        const BATCH_SIZE = 3;
        for (let i = 0; i < ideas.length; i += BATCH_SIZE) {
            const batch = ideas.slice(i, i + BATCH_SIZE);
            console.log(`\n   🚀 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} images)...`);

            const batchPromises = batch.map((idea, index) =>
                generateSingleImage(model, idea, i + index)
            );

            const results = await Promise.all(batchPromises);
            manifest.images.push(...results);

            // Short delay between batches to avoid 429 errors
            if (i + BATCH_SIZE < ideas.length) {
                console.log('   ⏳ Batch delay (2s)...');
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
        console.log(`\n✅ Generated ${manifest.images.length} images!`);
        return manifest.images;

    } catch (fatalError) {
        console.log(`\n❌ Fatal error in Generator: ${fatalError.message}`);
        console.log(`   ⚠️ Switching to fallback: Creating placeholders...`);
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        if (fs.existsSync(ideasPath)) {
            const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
            return createPlaceholders(ideas);
        }
        return [];
    }
}

async function generateSingleImage(model, idea, index) {
    const filename = `design_${String(index + 1).padStart(2, '0')}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    console.log(`   🖼️ Generating ${index + 1}: ${idea.title}...`);

    const MAX_RETRIES = 3;
    let generationSuccess = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 1) console.log(`   🔄 Retry ${attempt}/${MAX_RETRIES} for #${index + 1}...`);

            const prompt = `Create a professional, print-ready t-shirt design illustration:
DESIGN CONCEPT:
- Title: "${idea.title}"
- Theme: ${idea.theme}
- Style: ${idea.style}
- Color Scheme: ${idea.colorScheme}

REQUIREMENTS:
- Create a striking, eye-catching graphic design suitable for screen printing on a t-shirt
- The design should be centered and work well on a solid color t-shirt background
- Use bold, clear shapes and strong contrast
- Make it artistic, trendy, and commercially appealing
- NO text unless it's an integral part of the design concept
- Professional quality that could sell on platforms like Etsy or Redbubble
- Clean edges, suitable for print production`;

            const result = await model.generateContent(prompt);
            const response = result.response;

            if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                        fs.writeFileSync(filepath, imageBuffer);
                        console.log(`   ✅ Saved: ${filename}`);
                        generationSuccess = true;
                        break;
                    }
                }
            }

            if (generationSuccess) break;
            throw new Error('No image data found in response');

        } catch (e) {
            const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
            console.log(`   ⚠️ Error #${index + 1} (Attempt ${attempt}): ${e.message}`);

            if (isQuota && attempt < MAX_RETRIES) {
                console.log('   ⚠️ Quota limit hit. Waiting 5s...');
                await new Promise(r => setTimeout(r, 5000));
            } else if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    if (!generationSuccess) {
        console.log(`   ❌ Failed to generate ${idea.title}. Using placeholder.`);
        createPngPlaceholder(idea, filepath, index + 1);
    }

    return {
        id: index + 1,
        title: idea.title,
        description: idea.theme,
        style: idea.style,
        imagePath: `/generated_images/${filename}`
    };
}

/**
 * Main Export - With Timeout Wrapper
 */
export async function generateImages() {
    // 60 Second Timeout for generation too
    const timeoutMs = 60000;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout of ${timeoutMs}ms exceeded`)), timeoutMs);
    });

    try {
        console.log(`\n⏱️ Starting Generation with ${timeoutMs / 1000}s timeout...`);
        return await Promise.race([
            generateImagesInternal(),
            timeoutPromise
        ]);
    } catch (error) {
        console.log(`\n❌ Generator Failed or Timed Out: ${error.message}`);
        console.log('   ⚠️ Triggering safety fallback...');

        // Load ideas to create placeholders
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        if (fs.existsSync(ideasPath)) {
            const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
            return createPlaceholders(ideas);
        }
        return [];
    }
}

function createPlaceholders(ideas) {
    const manifest = { generatedAt: new Date().toISOString(), images: [] };
    ideas.forEach((idea, i) => {
        const filename = `design_${String(i + 1).padStart(2, '0')}.png`;
        createPngPlaceholder(idea, path.join(OUTPUT_DIR, filename), i + 1);
        manifest.images.push({
            id: i + 1, title: idea.title, description: idea.theme,
            style: idea.style, imagePath: `/generated_images/${filename}`
        });
    });
    fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest.images;
}

// Create a simple PNG placeholder using Base64 encoded 1x1 pixel images
function createPngPlaceholder(idea, filepath, idx) {
    // 1x1 Pixel PNGs in Base64 (Red, Green, Blue, Yellow, Purple, Cyan, Orange, Pink)
    const placeholders = [
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // Red
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Green
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // Blue
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // Purple
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPk+M/AAAD0AQQA7tSCIQAAAABJRU5ErkJggg==', // Yellow
    ];

    const b64 = placeholders[idx % placeholders.length];
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(filepath, buffer);
    console.log(`   📋 Placeholder saved as PNG: ${path.basename(filepath)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateImages();
export default generateImages;
