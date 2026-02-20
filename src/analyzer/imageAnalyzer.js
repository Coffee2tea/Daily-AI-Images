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
            model: "gpt-5", // Using 'gpt-5' alias from spec
            messages: messages,
            temperature: 0.7,
            max_tokens: 4096, // Increased to avoid 'length' cut-off
            response_format: { type: "json_object" }
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
                        reject(new Error(`Failed to parse API response: ${e.message}. Body: ${body.substring(0, 200)}...`));
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

        // Load Trend Data
        const trendsPath = path.join(DATA_DIR, 'trends.json');
        let trendsData = [];

        if (fs.existsSync(trendsPath)) {
            trendsData = JSON.parse(fs.readFileSync(trendsPath, 'utf-8'));
            console.log(`   📄 Loaded ${trendsData.length} trend insights.`);
        } else {
            console.log('   ⚠️ No trends.json found. Using samples.');
            return generateSampleIdeas();
        }

        console.log(`   🧠 Analyzing ALL trends to generate 5 unique ideas...`);

        // Prepare Context string
        // Use ALL trends for maximum context
        const context = trendsData.map(t => `- ${t.title}: ${t.content}`).join('\n');

        const jsonStructure = `
{
  "ideas": [
      {
        "title": "String", 
        "theme": "String", 
        "style": "String", 
        "colorScheme": "String", 
        "designElements": "String", 
        "mood": "String", 
        "aiPrompt": "String" 
      }
  ]
}`;

        // Single API call to generate all 5 ideas at once for better coherence and diversity
        console.log(`   🧠 Sending trend context to AI for batch generation...`);

        const messages = [
            {
                role: "system",
                content: "You are a visionary Creative Director. Your goal is to synthesize multiple fashion trends into 5 UNIQUE and DISTINCT avant-garde T-shirt designs. Mix and match different trends for each idea. Avoid repetition. Output valid JSON only."
            },
            {
                role: "user",
                content: `Here are diverse trending topics for 2024/2025:\n\n${context}\n\nSynthesize these inputs to generate 5 highly creative and distinct T-shirt design ideas. \n\nIMPORTANT requirements:\n1. Each idea must be significantly different from the others (different styles, moods, color palettes).\n2. Mix different trends together creatively.\n3. Return ONLY a valid JSON object matching this structure under the 'ideas' key.\n${jsonStructure}`
            }
        ];

        let generatedIdeas = [];
        try {
            const responseText = await callChatApi(messages);
            let jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.ideas && Array.isArray(parsed.ideas)) {
                    generatedIdeas = parsed.ideas;
                } else {
                    throw new Error("Invalid structure: missing 'ideas' array");
                }
            } else {
                throw new Error("No JSON found in response");
            }
        } catch (e) {
            console.log(`   ⚠️ Batch idea generation failed: ${e.message}`);
            throw e;
        }

        // Validate we have 5 ideas
        if (generatedIdeas.length < 5) {
            console.log(`   ⚠️ Only generated ${generatedIdeas.length} ideas. Filling with samples/duplicates if needed (not implemented yet).`);
        }

        if (generatedIdeas.length === 0) {
            throw new Error("Failed to generate any ideas");
        }

        // Format results
        generatedIdeas = generatedIdeas.map((idea, i) => ({
            id: i + 1,
            inspirationSource: 'Trend Analysis',
            ...idea
        }));

        if (generatedIdeas.length === 0) {
            console.log("   ⚠️ No ideas found in response. Using samples.");
            return generateSampleIdeas();
        }

        // Sanitize ideas to remove smart quotes/non-ASCII that might break downstream APIs
        generatedIdeas = generatedIdeas.map(idea => {
            const clean = (str) => {
                if (typeof str !== 'string') return str;
                return str
                    .replace(/[\u2018\u2019]/g, "'") // Smart quotes
                    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
                    .replace(/[^\x20-\x7E]/g, '');   // Strip non-printable/non-ASCII
            };
            return {
                ...idea,
                title: clean(idea.title),
                theme: clean(idea.theme),
                style: clean(idea.style),
                colorScheme: clean(idea.colorScheme),
                designElements: clean(idea.designElements),
                mood: clean(idea.mood),
                aiPrompt: clean(idea.aiPrompt)
            };
        });

        console.log(`   ✨ Generated ${generatedIdeas.length} design ideas from trends!`);

        // If we have fewer than 5, maybe fill with samples? 
        // For now, just return what we have (or duplicated if needed, but let's stick to valid ones)

        // Save to file
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        fs.writeFileSync(ideasPath, JSON.stringify(generatedIdeas, null, 2));

        return generatedIdeas;
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

    // Duplicate to fill 5
    const ideas = [];
    for (let i = 0; i < 5; i++) {
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
