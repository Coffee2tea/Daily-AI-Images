/**
 * AI Image Generator (Migrated to AI Builder Space API)
 * Generates images using the hosted OpenAI-compatible Image Generation API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(rootDir, 'data');
const OUTPUT_DIR = path.join(rootDir, 'generated_images');
const API_BASE_URL = "https://space.ai-builders.com"; // Force correct backend URL
const API_TOKEN = process.env.AI_BUILDER_TOKEN;

async function generateImagesInternal() {
    console.log('\n🎨 Starting AI image generation (via AI Builder API)...');

    try {
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        // DEMO LOCK REMOVED - Always run real generation if possible
        // if (process.env.NODE_ENV === 'production') ...

        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        if (!fs.existsSync(ideasPath)) {
            console.log('   ❌ No ideas found.');
            return [];
        }

        const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
        console.log(`   📝 Loaded ${ideas.length} ideas`);

        // Initialize manifest
        const manifest = {
            generatedAt: new Date().toISOString(),
            images: []
        };

        if (!API_TOKEN) {
            console.log('   ⚠️ No AI_BUILDER_TOKEN. Creating placeholders...');
            return createPlaceholders(ideas);
        }

        // Helper: Process in batches (Sequential for stability with this API)
        const results = [];
        for (let i = 0; i < ideas.length; i++) {
            const idea = ideas[i];
            console.log(`   🚀 Generating Image ${i + 1}/${ideas.length}...`);
            const result = await generateSingleImage(idea, i);
            results.push(result);

            // Small delay to be nice to the API
            await new Promise(r => setTimeout(r, 1000));
        }

        manifest.images = results;

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

async function generateSingleImage(idea, index) {
    const filename = `design_${String(index + 1).padStart(2, '0')}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    console.log(`   🖼️ Generating ${index + 1}: ${idea.title}...`);

    try {
        const prompt = `T-shirt design, ${idea.title}. ${idea.theme}. ${idea.style}. ${idea.colorScheme}. Vector art, high quality, isolated on white background.`;

        // API Call
        const apiResponse = await callImageApi(prompt);

        // Response format expected: { created: ..., data: [{ b64_json: "..." }] }
        // or { created: ..., data: [{ url: "..." }] }
        // We requested b64_json preferably, or we handle URL.

        const imageObj = apiResponse.data?.[0];

        if (imageObj?.b64_json) {
            const buffer = Buffer.from(imageObj.b64_json, 'base64');
            fs.writeFileSync(filepath, buffer);
            console.log(`   ✅ Saved (Base64): ${filename}`);
        } else if (imageObj?.url) {
            console.log(`   ⬇️ Downloading from URL: ${imageObj.url}`);
            await downloadImage(imageObj.url, filepath);
            console.log(`   ✅ Saved (URL): ${filename}`);
        } else {
            throw new Error('No image data (b64 or url) in API response');
        }

        return {
            id: index + 1,
            title: idea.title,
            description: idea.theme,
            style: idea.style,
            imagePath: `/generated_images/${filename}`
        };

    } catch (e) {
        console.log(`   ⚠️ Generation failed for #${index + 1}: ${e.message}`);
        createPngPlaceholder(idea, filepath, index + 1);
        return {
            id: index + 1,
            title: idea.title,
            description: "Generation Failed",
            style: idea.style,
            imagePath: `/generated_images/${filename}`
        };
    }
}

async function callImageApi(prompt) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            prompt: prompt,
            n: 1,
            size: "1024x1024"
        });

        const url = new URL(`${API_BASE_URL}/backend/v1/images/generations`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Length': data.length
            },
            rejectUnauthorized: false
        };

        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`Failed to parse API response: ${e.message}`));
                    }
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

// Download helper for URL-based responses
import http from 'http';
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        console.log(`   🔍 DEBUG: Downloading from ${url}`);
        const isHttps = url.startsWith('https');
        console.log(`   🔍 DEBUG: Protocol: ${isHttps ? 'https' : 'http'}`);
        const lib = isHttps ? https : http;
        const req = lib.get(url, { rejectUnauthorized: false }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Download failed: ${res.statusCode}`));
                return;
            }
            const stream = fs.createWriteStream(filepath);
            res.pipe(stream);
            stream.on('finish', () => {
                stream.close();
                resolve();
            });
            stream.on('error', reject);
        });
        req.on('error', reject);
    });
}

function createPlaceholders(ideas) {
    const manifest = { generatedAt: new Date().toISOString(), images: [] };

    ideas.forEach((idea, i) => {
        const filename = `design_${String(i + 1).padStart(2, '0')}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        // Use existing if valid
        if (fs.existsSync(filepath) && fs.statSync(filepath).size > 500) {
            console.log(`   ✅ Preserving existing valid image: ${filename}`);
        } else {
            createPngPlaceholder(idea, filepath, i + 1);
        }

        manifest.images.push({
            id: i + 1,
            title: idea.title,
            description: idea.theme,
            style: idea.style,
            imagePath: `/generated_images/${filename}`
        });
    });

    fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest.images;
}

// Create a simple PNG placeholder using Base64 encoded 1x1 pixel images
function createPngPlaceholder(idea, filepath, idx) {
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

/**
 * Main Export - With Timeout Wrapper
 */
export async function generateImages() {
    // 10 Minute Timeout
    const timeoutMs = 600000;
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
        return [];
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateImages();
export default generateImages;
