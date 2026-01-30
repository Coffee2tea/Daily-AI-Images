/**
 * Image Analyzer & Idea Generator (Migrated to AI Builder Space API)
 * Uses AI Builder Chat API (OpenAI Compatible) to analyze images and generate design ideas
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
const IMAGES_DIR = path.join(rootDir, 'downloaded_images');
const API_BASE_URL = "https://space.ai-builders.com";
const API_TOKEN = process.env.AI_BUILDER_TOKEN;

/**
 * Convert image file to base64 for API
 */
function imageToBase64(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Call AI Builder Chat API (OpenAI Compatible)
 */
async function callChatApi(messages, jsonMode = true) {
    if (!API_TOKEN) {
        throw new Error("AI_BUILDER_TOKEN not found.");
    }

    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: "gpt-4o", // Using high capability model for vision/analysis
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
            response_format: jsonMode ? { type: "json_object" } : undefined
        });

        const url = new URL(`${API_BASE_URL}/backend/v1/chat/completions`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Length': Buffer.byteLength(data)
            },
            rejectUnauthorized: false
        };

        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(body);
                        const content = json.choices?.[0]?.message?.content;
                        if (!content) throw new Error("No content in API response");
                        resolve(content);
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

/**
 * Analyze images and generate design ideas
 */
async function analyzeAndGenerateIdeasInternal() {
    console.log('\n🧠 Starting image analysis and idea generation (via AI Builder API)...');

    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // Check API key
        if (!API_TOKEN) {
            console.log('   ⚠️ AI_BUILDER_TOKEN not found. Using sample ideas...');
            return generateSampleIdeas();
        }

        // Load scraped metadata
        const metadataPath = path.join(DATA_DIR, 'scraped_metadata.json');
        let scrapedData = [];

        if (fs.existsSync(metadataPath)) {
            scrapedData = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            console.log(`   📄 Loaded ${scrapedData.length} scraped entries`);
        }

        // Get downloaded images
        let imageFiles = [];
        if (fs.existsSync(IMAGES_DIR)) {
            imageFiles = fs.readdirSync(IMAGES_DIR)
                .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
                .map(f => path.join(IMAGES_DIR, f))
                .slice(0, 5); // Limit to 5 for speed with vision API
        }

        const ideas = [];
        const tasks = [];

        // Helper: Process in batches
        const processInBatches = async (items, limit, asyncFn) => {
            let results = [];
            for (let i = 0; i < items.length; i += limit) {
                const batch = items.slice(i, i + limit);
                console.log(`   🚀 Processing batch ${Math.floor(i / limit) + 1}/${Math.ceil(items.length / limit)} (${batch.length} items)...`);
                const batchResults = await Promise.all(batch.map(asyncFn));
                results = [...results, ...batchResults];
                if (i + limit < items.length) await new Promise(r => setTimeout(r, 1000));
            }
            return results;
        };

        // Strategy: Combine Vision Analysis + Text Generation

        if (imageFiles.length > 0) {
            console.log(`   🖼️ Analyzing ${imageFiles.length} images...`);

            // Create tasks for vision analysis
            imageFiles.forEach((img, i) => {
                tasks.push({ type: 'vision', index: i, data: img });
            });
        }

        // Fill remaining slots with text generation based on scraped metadata titles
        const remainingSlots = 10 - tasks.length;
        if (remainingSlots > 0 && scrapedData.length > 0) {
            console.log(`   📝 Scheduling ${remainingSlots} text-based generations...`);
            for (let i = 0; i < remainingSlots; i++) {
                tasks.push({
                    type: 'text',
                    index: tasks.length + i,
                    data: scrapedData[i % scrapedData.length]
                });
            }
        }

        // If still empty tasks (no images, no metadata), fallback to generic
        if (tasks.length === 0) {
            console.log('   ⚠️ No input data found. Using samples.');
            return generateSampleIdeas();
        }

        const processTask = async (task) => {
            const { index, type, data } = task;
            console.log(`   📊 Generating #${index + 1} (${type})...`);

            try {
                let messages = [];
                const jsonStructure = `
{
  "newIdea": { 
      "title": "String", 
      "theme": "String", 
      "style": "String", 
      "colorScheme": "String", 
      "targetAudience": "String", 
      "designElements": "String", 
      "mood": "String", 
      "aiPrompt": "String" 
  }
}`;

                if (type === 'vision') {
                    const b64 = imageToBase64(data);
                    const mime = getMimeType(data);
                    messages = [
                        {
                            role: "system",
                            content: "You are a professional T-shirt designer. Analyze the input design and create a NEW, UNIQUE design idea inspired by it. Return ONLY JSON."
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: `Analyze this design and generate a new idea. Return JSON structure: ${jsonStructure}` },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:${mime};base64,${b64}`
                                    }
                                }
                            ]
                        }
                    ];
                } else {
                    // Text based
                    const title = data.title || "T-Shirt Design";
                    messages = [
                        {
                            role: "system",
                            content: "You are a professional T-shirt designer. Create a unique design idea based on the trending concept provided. Return ONLY JSON."
                        },
                        {
                            role: "user",
                            content: `Trend Concept: "${title}". Create a new design idea. Return JSON structure: ${jsonStructure}`
                        }
                    ];
                }

                const responseText = await callChatApi(messages);
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const idea = parsed.newIdea || parsed; // Handle flat or nested
                    return {
                        id: index + 1,
                        inspirationSource: type === 'vision' ? path.basename(data) : (data.title || 'Trend'),
                        ...idea
                    };
                } else {
                    throw new Error("Invalid JSON in response");
                }

            } catch (e) {
                console.log(`   ⚠️ Failed task #${index + 1}: ${e.message}`);
                return generateSingleSampleIdea(index + 1);
            }
        };

        // Execute
        // Vision requests are heavy, process 3 at a time max
        const results = await processInBatches(tasks, 3, processTask);

        // Save ideas
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        fs.writeFileSync(ideasPath, JSON.stringify(results, null, 2));

        console.log(`\n✅ Generated ${results.length} design ideas!`);
        return results;

    } catch (fatalError) {
        console.log(`\n❌ Fatal error in Analyzer: ${fatalError.message}`);
        console.log(`   ⚠️ Switching to fallback: Generating sample ideas...`);
        return generateSampleIdeas();
    }
}

/**
 * Main Export - With Timeout Wrapper
 */
export async function analyzeAndGenerateIdeas() {
    // 5 Minute Timeout
    const timeoutMs = 300000;
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout of ${timeoutMs}ms exceeded`)), timeoutMs);
    });

    try {
        console.log(`\n⏱️ Starting Analysis with ${timeoutMs / 1000}s timeout...`);
        return await Promise.race([
            analyzeAndGenerateIdeasInternal(),
            timeoutPromise
        ]);
    } catch (error) {
        console.log(`\n❌ Analyzer Failed or Timed Out: ${error.message}`);
        return generateSampleIdeas();
    }
}

/**
 * Restore demo ideas from preset assets
 */
function restoreDemoIdeas() {
    const demoIdeasPath = path.join(DATA_DIR, 'demo_assets', 'ideas.json');
    if (fs.existsSync(demoIdeasPath)) {
        const ideas = JSON.parse(fs.readFileSync(demoIdeasPath, 'utf-8'));
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        fs.writeFileSync(ideasPath, JSON.stringify(ideas, null, 2));
        console.log(`\n✅ Demo analysis complete! Loaded ${ideas.length} preset ideas.`);
        return ideas;
    }
    return generateSampleIdeas();
}

/**
 * Generate sample ideas when API is not available
 */
function generateSampleIdeas() {
    const sampleIdeas = [
        {
            title: "Cosmic Wanderer",
            theme: "Space exploration",
            style: "Minimalist",
            colorScheme: "Deep purple, Electric blue",
            targetAudience: "Dreamers",
            designElements: "Astronaut, stars",
            mood: "Adventurous",
            aiPrompt: "Minimalist T-shirt design, astronaut silhouette, galaxy background. Deep purple and blue gradient."
        },
        {
            title: "Retro Sunset",
            theme: "80s nostalgia",
            style: "Synthwave",
            colorScheme: "Orange, Pink, Purple",
            targetAudience: "Retrowave fans",
            designElements: "Palm trees, sunset, grid",
            mood: "Nostalgic",
            aiPrompt: "Synthwave retro T-shirt design, sunset stripes, palm trees, perspective grid. 80s aesthetic."
        },
        {
            title: "Urban Graffiti",
            theme: "Street art",
            style: "Graffiti",
            colorScheme: "Yellow, Magenta, Cyan",
            targetAudience: "Street culture",
            designElements: "Spray paint, drips",
            mood: "Edgy",
            aiPrompt: "Urban graffiti T-shirt design, bold lettering, spray paint drips, vibrant colors."
        },
        {
            title: "Nature Spirit",
            theme: "Nature",
            style: "Line Art",
            colorScheme: "Earth tones",
            targetAudience: "Nature lovers",
            designElements: "Leaves, mountain",
            mood: "Peaceful",
            aiPrompt: "Line art T-shirt design, mountain range with leaves, earth tones, minimalist."
        },
        {
            title: "Geometric Wolf",
            theme: "Animals",
            style: "Geometric Low Poly",
            colorScheme: "Blue, White, Grey",
            targetAudience: "Animal lovers",
            designElements: "Wolf head, triangles",
            mood: "Strong",
            aiPrompt: "Geometric low poly wolf head T-shirt design, blue and white color palette, sharp angles."
        }
    ];

    // Duplicate to fill 10
    const ideas = [];
    for (let i = 0; i < 10; i++) {
        const template = sampleIdeas[i % sampleIdeas.length];
        ideas.push({
            id: i + 1,
            inspirationSource: 'Sample Library',
            ...template,
            title: `${template.title} ${Math.ceil((i + 1) / 5)}`
        });
    }

    // Save ideas
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const ideasPath = path.join(DATA_DIR, 'ideas.json');
    fs.writeFileSync(ideasPath, JSON.stringify(ideas, null, 2));

    console.log(`\n✅ Generated ${ideas.length} sample design ideas!`);
    return ideas;
}

/**
 * Format ideas as email-friendly text
 */
export function formatIdeasForEmail(ideas) {
    let text = '🎨 T-SHIRT DESIGN IDEAS\n';
    text += '='.repeat(50) + '\n\n';
    ideas.forEach((idea, index) => {
        text += `IDEA #${index + 1}: ${idea.title}\n`;
        text += `Style: ${idea.style} | Mood: ${idea.mood}\n`;
        text += `Prompt: ${idea.aiPrompt}\n\n`;
    });
    return text;
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    analyzeAndGenerateIdeas().catch(console.error);
}

export default analyzeAndGenerateIdeas;
