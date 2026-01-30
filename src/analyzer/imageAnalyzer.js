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

        console.log(`   🧠 Analyzing ${trendsData.length} trends to generate 1 idea...`);

        // Prepare Context string
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

        const messages = [
            {
                role: "system",
                content: "You are a visionary Creative Director. Your goal is to synthesize multiple fashion trends into unique, avant-garde T-shirt designs. Do not just copy the trends; mix and match them to create something fresh and unexpected."
            },
            {
                role: "user",
                content: `Here are 10 diverse trending topics for 2024/2025:\n\n${context}\n\nSynthesize these inputs. Combine contrasting elements (e.g., retro + futuristic, nature + geometry) to generate 1 highly creative and distinct T-shirt design idea. Return strict JSON structure: ${jsonStructure}`
            }
        ];

        // Call API once for all ideas (faster/cheaper)
        const responseText = await callChatApi(messages);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        let generatedIdeas = [];
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            generatedIdeas = parsed.ideas || [];
        }

        if (generatedIdeas.length === 0) {
            throw new Error("Failed to generate ideas from LLM response");
        }

        // Format results
        const results = generatedIdeas.slice(0, 1).map((idea, i) => ({
            id: i + 1,
            inspirationSource: 'Trend Analysis',
            ...idea
        }));

        // Save ideas
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        fs.writeFileSync(ideasPath, JSON.stringify(results, null, 2));

        console.log(`\n✅ Generated ${results.length} design ideas from trends!`);
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
