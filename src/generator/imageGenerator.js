/**
 * AI Image Generator - Uses Gemini to generate T-shirt designs
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

export async function generateImages() {
    console.log('\n🎨 Starting AI image generation...');

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const manifest = { generatedAt: new Date().toISOString(), images: [] };

    for (let i = 0; i < ideas.length; i++) {
        const idea = ideas[i];
        const filename = `design_${String(i + 1).padStart(2, '0')}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        console.log(`   🖼️ Generating ${i + 1}/${ideas.length}: ${idea.title}...`);

        const MAX_RETRIES = 3;
        let generationSuccess = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1) console.log(`   🔄 Retry ${attempt}/${MAX_RETRIES}...`);

                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: `T-shirt design: ${idea.aiPrompt}` }] }],
                    // Removed experimental responseModalities to ensure stability
                });

                let saved = false;
                const parts = result.response.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, 'base64'));
                        saved = true;
                        break;
                    }
                }

                if (saved) {
                    generationSuccess = true;
                    break; // Success, exit retry loop
                } else {
                    throw new Error('No image data in response');
                }
            } catch (e) {
                console.log(`   ⚠️ Error (Attempt ${attempt}): ${e.message}`);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, attempt * 2000));
                }
            }
        }

        if (!generationSuccess) {
            console.log(`   ❌ All retries failed for ${idea.title}. Creating placeholder.`);
            createSvgPlaceholder(idea, filepath, i + 1);
        }

        manifest.images.push({
            id: i + 1, title: idea.title, description: idea.theme,
            style: idea.style, imagePath: `/generated_images/${filename}`
        });
        await new Promise(r => setTimeout(r, 1500));
    }

    fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`\n✅ Generated ${manifest.images.length} images!`);
    return manifest.images;
}

function createPlaceholders(ideas) {
    const manifest = { generatedAt: new Date().toISOString(), images: [] };
    ideas.forEach((idea, i) => {
        const filename = `design_${String(i + 1).padStart(2, '0')}.svg`;
        createSvgPlaceholder(idea, path.join(OUTPUT_DIR, filename), i + 1);
        manifest.images.push({
            id: i + 1, title: idea.title, description: idea.theme,
            style: idea.style, imagePath: `/generated_images/${filename}`
        });
    });
    fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest.images;
}

function createSvgPlaceholder(idea, filepath, idx) {
    const colors = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140']];
    const [c1, c2] = colors[idx % colors.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="#1a1a2e"/>
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
  <rect x="100" y="100" width="400" height="400" rx="20" fill="url(#g)"/>
  <text x="300" y="280" font-family="Arial" font-size="80" fill="white" text-anchor="middle">${String(idx).padStart(2, '0')}</text>
  <text x="300" y="340" font-family="Arial" font-size="20" fill="white" text-anchor="middle">${idea.style || 'Design'}</text>
</svg>`;
    fs.writeFileSync(filepath.replace('.png', '.svg'), svg);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateImages();
export default generateImages;
