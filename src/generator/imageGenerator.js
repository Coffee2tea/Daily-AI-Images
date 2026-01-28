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
    console.log('\n🎨 Starting AI image generation (Internal)...');

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

                    // Detailed prompt for high-quality T-shirt design generation
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

                    // Extract image data from response
                    if (response.candidates &&
                        response.candidates[0] &&
                        response.candidates[0].content &&
                        response.candidates[0].content.parts) {

                        for (const part of response.candidates[0].content.parts) {
                            if (part.inlineData && part.inlineData.data) {
                                // Decode Base64 and save as PNG
                                const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                                fs.writeFileSync(filepath, imageBuffer);
                                console.log(`   ✅ Saved: ${filename}`);
                                generationSuccess = true;
                                break;
                            }
                        }
                    }

                    if (generationSuccess) break;

                    // If we got here without success, the response format was unexpected
                    throw new Error('No image data found in response');

                } catch (e) {
                    const isNetworkError = e.message.toLowerCase().includes('network') ||
                        e.message.toLowerCase().includes('fetch') ||
                        e.message.toLowerCase().includes('econnreset') ||
                        e.message.toLowerCase().includes('etimedout') ||
                        e.message.toLowerCase().includes('socket');
                    console.log(`   ⚠️ Error (Attempt ${attempt}): ${e.message}`);

                    if (isNetworkError && attempt >= MAX_RETRIES) {
                        console.log(`   ⚠️ Network error detected. Continuing with placeholder...`);
                        break;
                    }

                    if (attempt < MAX_RETRIES) {
                        const delay = isNetworkError ? attempt * 3000 : attempt * 2000;
                        console.log(`   ⏳ Waiting ${delay / 1000}s before retry...`);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }

            if (!generationSuccess) {
                console.log(`   ❌ All retries failed for ${idea.title}. Creating placeholder.`);
                createPngPlaceholder(idea, filepath, i + 1);
            }

            manifest.images.push({
                id: i + 1,
                title: idea.title,
                description: idea.theme,
                style: idea.style,
                imagePath: `/generated_images/${filename}`
            });

            // Delay to avoid rate limits
            await new Promise(r => setTimeout(r, 1500));
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

// Create a simple PNG placeholder using an SVG-to-PNG approach
// Since we don't have canvas, we'll create a minimal valid PNG or use SVG fallback
function createPngPlaceholder(idea, filepath, idx) {
    // Create an SVG that will be saved with .png extension but browsers will still display it
    // In a production environment, you'd use sharp or canvas to create actual PNGs
    const colors = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140']];
    const [c1, c2] = colors[idx % colors.length];

    // For now, we'll save as SVG with same name pattern but note this is a fallback
    // The actual Gemini image generation will produce real PNGs
    const svgPath = filepath.replace('.png', '.svg');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <rect width="500" height="500" fill="#1a1a2e"/>
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
  <rect x="50" y="50" width="400" height="400" rx="20" fill="url(#g)"/>
  <text x="250" y="220" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" font-weight="bold">PLACEHOLDER</text>
  <text x="250" y="260" font-family="Arial, sans-serif" font-size="60" fill="white" text-anchor="middle" font-weight="bold">${String(idx).padStart(2, '0')}</text>
  <text x="250" y="320" font-family="Arial, sans-serif" font-size="18" fill="white" text-anchor="middle">${idea.style || 'Design'}</text>
</svg>`;

    // Save as SVG since we can't generate actual PNG without additional libraries
    fs.writeFileSync(svgPath, svg);
    console.log(`   📋 Placeholder saved as SVG: ${path.basename(svgPath)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateImages();
export default generateImages;
