/**
 * Image Analyzer & Idea Generator
 * Uses Gemini Vision API to analyze images and generate design ideas
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
const IMAGES_DIR = path.join(rootDir, 'downloaded_images');

/**
 * Convert image file to base64 for Gemini API
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
 * Analyze images and generate design ideas
 */
async function analyzeAndGenerateIdeasInternal() {
    console.log('\n🧠 Starting image analysis and idea generation (Internal)...');

    try {
        // DEMO MODE CHECK
        if (process.env.NODE_ENV === 'production') {
            console.log('   ☁️  SERVER/DEMO MODE: Using high-quality preset ideas.');
            console.log('   ⏳ Analyzing design trends (Simulated)...');
            await new Promise(r => setTimeout(r, 2000));
            return restoreDemoIdeas();
        }

        // Check API key
        if (!process.env.GEMINI_API_KEY) {
            console.log('   ⚠️ GEMINI_API_KEY not found. Using sample ideas...');
            return generateSampleIdeas();
        }

        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
                .slice(0, 10);
        }

        const ideas = [];

        // Helper for concurrency
        const runWithConcurrency = async (items, limit, fn) => {
            const results = [];
            const executing = [];
            for (const item of items) {
                const p = fn(item).then(res => results.push(res));
                executing.push(p);
                if (executing.length >= limit) {
                    await Promise.race(executing);
                    // Remove completed promises
                    /* eslint-disable-next-line no-loop-func */
                    const index = executing.findIndex(p => p.status === 'fulfilled'); // Only works if we track status, simplifying:
                    // Actually, simpler approach for this scale:
                }
            }
            // Better simple implementation for "Limit 3"
            // We will just chunk it or use a simple queue
            return results;
        };

        // Simpler Queue Implementation
        const processInBatches = async (items, limit, asyncFn) => {
            let results = [];
            for (let i = 0; i < items.length; i += limit) {
                const batch = items.slice(i, i + limit);
                console.log(`   🚀 Processing batch ${Math.floor(i / limit) + 1}/${Math.ceil(items.length / limit)} (${batch.length} items)...`);
                const batchResults = await Promise.all(batch.map(asyncFn));
                results = [...results, ...batchResults];
                // Small delay between batches to be nice
                if (i + limit < items.length) await new Promise(r => setTimeout(r, 200));
            }
            return results;
        };

        // Prepare tasks
        let tasks = [];

        // If we have actual images, analyze them
        if (imageFiles.length > 0) {
            console.log(`   🖼️ Analyzing images to generate 10 unique ideas (Parallel Mode)...`);

            // Create 10 tasks
            for (let i = 0; i < 10; i++) {
                tasks.push({
                    index: i,
                    imagePath: imageFiles[i % imageFiles.length],
                    type: 'image_analysis'
                });
            }

            const processTask = async (task) => {
                const { index, imagePath } = task;
                console.log(`   📊 analyzing #${index + 1}...`);

                try {
                    const imageData = imageToBase64(imagePath);
                    const mimeType = getMimeType(imagePath);
                    const prompt = `You are a professional T-shirt designer analyzing popular designs.
Analyze this T-shirt design image and create a NEW unique design idea inspired by it.
Return your response in this exact JSON format (no markdown, just pure JSON):
{
  "originalAnalysis": { "colorPalette": [], "style": "", "theme": "", "targetAudience": "", "technique": "" },
  "newIdea": { "title": "", "theme": "", "style": "", "colorScheme": "", "targetAudience": "", "designElements": "", "mood": "", "aiPrompt": "" }
}`;

                    const result = await model.generateContent([
                        { text: prompt },
                        { inlineData: { mimeType, data: imageData } }
                    ]);

                    const responseText = result.response.text();
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        return {
                            id: index + 1,
                            inspirationSource: path.basename(imagePath),
                            ...parsed.newIdea,
                            originalAnalysis: parsed.originalAnalysis
                        };
                    }
                } catch (error) {
                    console.log(`   ⚠️ Error analyzing #${index + 1}: ${error.message}`);
                    return generateSingleSampleIdea(index + 1);
                }
                return generateSingleSampleIdea(index + 1);
            };

            const results = await processInBatches(tasks, 10, processTask);
            // Filter out nulls/duplicates if any logic required, but here we just push
            results.forEach(r => ideas.push(r));

        } else {
            // No images available
            console.log('   📝 Generating ideas from metadata (Parallel Mode)...');

            for (let i = 0; i < 10; i++) {
                tasks.push({
                    index: i,
                    sourceData: scrapedData[i] || { title: `Design ${i + 1}`, style: 'Modern' },
                    type: 'text_generation'
                });
            }

            const processTask = async (task) => {
                const { index, sourceData } = task;

                try {
                    const prompt = `You are a professional T-shirt designer.
Based on this trending T-shirt design concept: "${sourceData.title}" (Style: ${sourceData.style || 'Contemporary'})
Create a unique NEW design idea. Return your response in this exact JSON format (no markdown, just pure JSON):
{ "title": "", "theme": "", "style": "", "colorScheme": "", "targetAudience": "", "designElements": "", "mood": "", "aiPrompt": "" }`;

                    const result = await model.generateContent(prompt);
                    const responseText = result.response.text();
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        return {
                            id: index + 1,
                            inspirationSource: sourceData.title,
                            ...parsed
                        };
                    }
                } catch (error) {
                    console.log(`   ⚠️ Error generating #${index + 1}: ${error.message}`);
                    return generateSingleSampleIdea(index + 1);
                }
                return generateSingleSampleIdea(index + 1);
            };

            const results = await processInBatches(tasks, 4, processTask); // Text generation is faster
            results.forEach(r => ideas.push(r));
        }

        // Save ideas
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        fs.writeFileSync(ideasPath, JSON.stringify(ideas, null, 2));

        console.log(`\n✅ Generated ${ideas.length} design ideas!`);
        console.log(`   📄 Ideas saved to: ${ideasPath}`);

        return ideas;

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
    // 5 Minute Timeout to prevent platform 504 errors
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
        console.log('   ⚠️ Triggering safety fallback...');
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

        // Ensure we write it to the main ideas.json so the generator can find it
        const ideasPath = path.join(DATA_DIR, 'ideas.json');
        fs.writeFileSync(ideasPath, JSON.stringify(ideas, null, 2));

        console.log(`\n✅ Demo analysis complete! Loaded ${ideas.length} preset ideas.`);
        return ideas;
    }

    console.log('   ⚠️ Demo ideas not found. Generating samples...');
    return generateSampleIdeas();
}

/**
 * Generate sample ideas when API is not available
 */
function generateSampleIdeas() {
    const sampleIdeas = [
        {
            title: "Cosmic Wanderer",
            theme: "Space exploration and wonder",
            style: "Minimalist with gradient accents",
            colorScheme: "Deep purple (#2D1B69), Electric blue (#00D4FF), White",
            targetAudience: "Young adults, space enthusiasts, dreamers",
            designElements: "Silhouette of astronaut, stars, galaxy swirls",
            mood: "Adventurous, mysterious, inspiring",
            aiPrompt: "Minimalist T-shirt design featuring an astronaut silhouette floating in space, surrounded by scattered stars and a subtle galaxy spiral. Use deep purple (#2D1B69) to electric blue (#00D4FF) gradient background fading to black. Clean vector style, centered composition. Professional print-ready design on transparent background."
        },
        {
            title: "Neon Tokyo Nights",
            theme: "Japanese urban aesthetics",
            style: "Cyberpunk neon",
            colorScheme: "Hot pink (#FF1493), Cyan (#00FFFF), Black",
            targetAudience: "Anime fans, urban fashion lovers",
            designElements: "Japanese kanji, neon signs, city skyline",
            mood: "Energetic, futuristic, cool",
            aiPrompt: "Cyberpunk T-shirt design with Japanese neon sign aesthetic. Feature glowing kanji characters meaning 'dream' in hot pink (#FF1493) and cyan (#00FFFF). Include simplified Tokyo skyline silhouette at bottom. Dark background with neon glow effects. Retro-futuristic style, print-ready on transparent background."
        },
        {
            title: "Wild Heart",
            theme: "Nature and freedom",
            style: "Boho watercolor",
            colorScheme: "Terracotta (#E07A5F), Sage green (#81B29A), Cream",
            targetAudience: "Nature lovers, bohemian style enthusiasts",
            designElements: "Mountain range, wildflowers, sun rays",
            mood: "Free-spirited, peaceful, grounded",
            aiPrompt: "Bohemian watercolor T-shirt design featuring a mountain range with wildflowers in front. Use terracotta (#E07A5F) and sage green (#81B29A) color palette. Include radiating sun rays behind mountains. Soft, hand-painted watercolor texture. Centered composition, print-ready on transparent background."
        },
        {
            title: "Retro Sunset Vibes",
            theme: "80s nostalgia",
            style: "Synthwave retro",
            colorScheme: "Orange (#FF6B35), Pink (#FF006E), Purple (#8338EC)",
            targetAudience: "80s enthusiasts, retrowave fans",
            designElements: "Palm trees, sunset stripes, grid lines",
            mood: "Nostalgic, fun, vibrant",
            aiPrompt: "Synthwave retro T-shirt design with horizontal sunset stripes in orange (#FF6B35), pink (#FF006E), and purple (#8338EC). Include silhouette palm trees and perspective grid at bottom. Sun in center with striped pattern. Vintage 80s aesthetic, clean vector style, print-ready on transparent background."
        },
        {
            title: "Zen Lotus",
            theme: "Mindfulness and peace",
            style: "Elegant line art",
            colorScheme: "Gold (#D4AF37), Black, White",
            targetAudience: "Yoga practitioners, meditation enthusiasts",
            designElements: "Lotus flower, geometric mandala, fine lines",
            mood: "Calm, spiritual, refined",
            aiPrompt: "Elegant line art T-shirt design of a lotus flower with geometric mandala pattern. Use gold (#D4AF37) lines on black or single color. Intricate fine line details, symmetrical design. Minimalist yet detailed, centered composition. Print-ready on transparent background."
        },
        {
            title: "Pixel Adventure",
            theme: "Gaming and nostalgia",
            style: "8-bit pixel art",
            colorScheme: "Bright green (#39FF14), Blue (#0066FF), Red (#FF0000)",
            targetAudience: "Gamers, retro gaming enthusiasts",
            designElements: "Pixel character, hearts, coins, retro elements",
            mood: "Playful, nostalgic, fun",
            aiPrompt: "8-bit pixel art T-shirt design featuring a cute pixel character on an adventure. Include pixel hearts, coins, and retro game elements. Use bright arcade colors: green (#39FF14), blue (#0066FF), red (#FF0000). Authentic retro game aesthetic, centered, print-ready on transparent background."
        },
        {
            title: "Ocean Dreams",
            theme: "Sea life and tranquility",
            style: "Illustrative watercolor",
            colorScheme: "Teal (#008B8B), Coral (#FF7F50), Navy (#001F3F)",
            targetAudience: "Ocean lovers, beach enthusiasts",
            designElements: "Whale, waves, seashells, bubbles",
            mood: "Dreamy, peaceful, magical",
            aiPrompt: "Dreamy watercolor T-shirt design featuring a majestic whale swimming through stylized waves. Include scattered bubbles and small fish. Use teal (#008B8B), coral (#FF7F50) and navy (#001F3F) palette. Soft watercolor texture with flowing lines. Centered composition, print-ready on transparent background."
        },
        {
            title: "Urban Graffiti",
            theme: "Street art culture",
            style: "Bold graffiti",
            colorScheme: "Yellow (#FFE135), Magenta (#FF00FF), Cyan (#00FFFF)",
            targetAudience: "Street art fans, hip-hop culture",
            designElements: "Spray paint effects, drips, bold letters",
            mood: "Edgy, rebellious, creative",
            aiPrompt: "Bold graffiti-style T-shirt design with abstract spray paint elements and dripping effects. Use vibrant yellow (#FFE135), magenta (#FF00FF), and cyan (#00FFFF). Include paint splatter textures. Urban street art aesthetic, dynamic composition. Print-ready on transparent background."
        },
        {
            title: "Forest Spirit",
            theme: "Mystical nature",
            style: "Illustrated fantasy",
            colorScheme: "Forest green (#228B22), Brown (#8B4513), Gold accents",
            targetAudience: "Fantasy lovers, nature enthusiasts",
            designElements: "Deer with antlers, forest silhouette, mystical elements",
            mood: "Magical, serene, enchanting",
            aiPrompt: "Fantasy illustration T-shirt design featuring a majestic deer with flowering antlers. Forest tree silhouettes in background with tiny glowing fireflies. Use forest green (#228B22) and brown (#8B4513) with gold accents. Mystical atmosphere, centered composition. Print-ready on transparent background."
        },
        {
            title: "Positive Energy",
            theme: "Happiness and motivation",
            style: "Bold typography",
            colorScheme: "Sunshine yellow (#FFDD00), Orange (#FF8C00), Coral",
            targetAudience: "Optimists, motivational seekers",
            designElements: "Uplifting quote, sun rays, positive symbols",
            mood: "Happy, energizing, uplifting",
            aiPrompt: "Bold typography T-shirt design with the phrase 'Choose Joy' in chunky modern font. Include radiating sun rays and small decorative elements like stars and hearts. Use sunshine yellow (#FFDD00) to orange (#FF8C00) gradient. Cheerful and bold, centered composition. Print-ready on transparent background."
        }
    ];

    // Generate 10 sample ideas
    const ideas = sampleIdeas.slice(0, 10).map((idea, index) => ({
        id: index + 1,
        inspirationSource: 'Sample Design Library',
        ...idea
    }));

    // Save ideas
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const ideasPath = path.join(DATA_DIR, 'ideas.json');
    fs.writeFileSync(ideasPath, JSON.stringify(ideas, null, 2));

    console.log(`\n✅ Generated ${ideas.length} sample design ideas!`);
    console.log(`   📄 Ideas saved to: ${ideasPath}`);

    return ideas;
}

/**
 * Generate a single sample idea
 */
function generateSingleSampleIdea(id) {
    const themes = ['Space', 'Nature', 'Urban', 'Retro', 'Minimal', 'Abstract', 'Cute', 'Bold', 'Elegant', 'Fun'];
    const styles = ['Minimalist', 'Watercolor', 'Vector', 'Hand-drawn', 'Geometric', 'Vintage', 'Modern', 'Grunge'];

    return {
        id,
        inspirationSource: 'Auto-generated',
        title: `Creative Design ${id}`,
        theme: themes[id % themes.length],
        style: styles[id % styles.length],
        colorScheme: 'Vibrant mixed palette',
        targetAudience: 'General audience',
        designElements: 'Abstract shapes, typography, decorative elements',
        mood: 'Inspiring and contemporary',
        aiPrompt: `Create a unique T-shirt design with ${themes[id % themes.length].toLowerCase()} theme in ${styles[id % styles.length].toLowerCase()} style. Use vibrant colors, centered composition, print-ready on transparent background.`
    };
}

/**
 * Format ideas as email-friendly text
 */
export function formatIdeasForEmail(ideas) {
    let text = '🎨 T-SHIRT DESIGN IDEAS\n';
    text += '='.repeat(50) + '\n\n';
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Total Ideas: ${ideas.length}\n\n`;

    ideas.forEach((idea, index) => {
        text += `${'─'.repeat(50)}\n`;
        text += `IDEA #${index + 1}: ${idea.title}\n`;
        text += `${'─'.repeat(50)}\n\n`;
        text += `📌 Theme: ${idea.theme}\n`;
        text += `🎨 Style: ${idea.style}\n`;
        text += `🌈 Colors: ${idea.colorScheme}\n`;
        text += `👥 Target: ${idea.targetAudience}\n`;
        text += `✨ Elements: ${idea.designElements}\n`;
        text += `💭 Mood: ${idea.mood}\n`;
        text += `\n📝 AI Generation Prompt:\n${idea.aiPrompt}\n\n`;
    });

    return text;
}

// Run directly if executed as main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    analyzeAndGenerateIdeas().catch(console.error);
}

export default analyzeAndGenerateIdeas;
