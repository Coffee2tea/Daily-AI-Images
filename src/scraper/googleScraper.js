/**
 * Google Image Scraper (Migrated to AI Builder Space Search API)
 * Scrapes T-shirt design images using the hosted Tavily Search API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

// Configuration
const SEARCH_QUERY = 'creative t-shirt design trends graphic 2024';
const MAX_IMAGES = 5;
const OUTPUT_DIR = path.join(rootDir, 'downloaded_images');
const DATA_DIR = path.join(rootDir, 'data');
const API_BASE_URL = "https://space.ai-builders.com"; // Force correct API URL
const API_TOKEN = process.env.AI_BUILDER_TOKEN;

/**
 * Save base64 image to file
 */
function saveBase64Image(base64Data, filepath) {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return false;
    }
    const buffer = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(filepath, buffer);
    return true;
}

/**
 * Download image from URL
 */
async function downloadImage(url, filepath, timeout = 30000) {
    // Handle base64 directly
    if (url.startsWith('data:image')) {
        return saveBase64Image(url, filepath);
    }

    return new Promise((resolve, reject) => {
        // Log for debug
        // console.log(`   🔍 DEBUG: Downloading ${url}`);

        const lib = url.startsWith('https') ? https : http;

        const options = {
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        const request = lib.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location, filepath, timeout)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(filepath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(filepath);
            });
            fileStream.on('error', reject);
        });
        request.on('error', reject);
        request.setTimeout(timeout, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

// Fallback data
const STATIC_FALLBACK_DATA = [
    { id: 1, title: "Modern Abstract Design", imageUrl: "/downloaded_images/google_design_01.jpg", localPath: "/downloaded_images/google_design_01.jpg", source: 'offline-demo' },
    { id: 2, title: "Retro Typography", imageUrl: "/downloaded_images/google_design_02.jpg", localPath: "/downloaded_images/google_design_02.jpg", source: 'offline-demo' },
    { id: 3, title: "Geometric Patterns", imageUrl: "/downloaded_images/google_design_03.jpg", localPath: "/downloaded_images/google_design_03.jpg", source: 'offline-demo' },
    { id: 4, title: "Street Art Graffiti", imageUrl: "/downloaded_images/google_design_04.jpg", localPath: "/downloaded_images/google_design_04.jpg", source: 'offline-demo' },
    { id: 5, title: "Vintage Illustration", imageUrl: "/downloaded_images/google_design_05.jpg", localPath: "/downloaded_images/google_design_05.jpg", source: 'offline-demo' },
];

/**
 * Call AI Builder Search API
 */
async function searchImagesApi(query) {
    if (!API_TOKEN) {
        throw new Error("AI_BUILDER_TOKEN not found in environment variables.");
    }

    console.log(`   📡 Calling Search API: ${API_BASE_URL}/backend/v1/search/`);

    // We construct the request manually with https to avoid dependency issues
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            keywords: [query],
            max_results: 10,
            include_images: true, // Request images explicitly
            include_image_descriptions: true,
            search_depth: "advanced"
        });

        const url = new URL(`${API_BASE_URL}/backend/v1/search/`);
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
                        const json = JSON.parse(body);

                        // Parse response (Tavily usually returns 'results' or 'queries' depending on version/wrapper)
                        const searchResult = json.results?.[0] || json.queries?.[0]; // Handle both
                        const resp = searchResult?.response;

                        // Check images presence
                        if (resp && resp.images) {
                            resolve({
                                images: resp.images.map(img => ({
                                    url: img.url,
                                    description: img.description || "Found via AI Search"
                                }))
                            });
                        } else {
                            // Fallback to text results or just context
                            console.log("   ⚠️ No images in 'response.images'.");
                            resolve({ images: [] });
                        }
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

// Dynamic Search Query Generator
const STYLES = ['vintage', 'modern minimalist', 'cyberpunk', 'retro 80s', 'typography', 'abstract art', 'streetwear', 'geometric', 'watercolor', 'pop art'];
const YEARS = ['2023', '2024', '2025'];

function getDynamicQuery() {
    const style = STYLES[Math.floor(Math.random() * STYLES.length)];
    const year = YEARS[Math.floor(Math.random() * YEARS.length)];
    return `creative t-shirt design trends ${style} graphic ${year}`;
}

// Trend Search Configuration
const TREND_QUERIES = [
    'top t-shirt design trends 2024 2025',
    'graphic design fashion trends 2025',
    'trending aesthetics for streetwear 2025',
    'popular typography styles for apparel'
];

export async function scrapeDesignTrends() {
    const query = TREND_QUERIES[Math.floor(Math.random() * TREND_QUERIES.length)];

    console.log('\n🔍 Starting Trend Search (via AI Builder Tavily API)...');
    console.log(`   Search query: "${query}"`);

    // Ensure directories exist
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const results = [];

    try {
        console.log(`   🌐 Connecting to Search API for text trends...`);

        // Helper to call API
        const textResults = await searchTrendsApi(query);

        if (!textResults || textResults.length === 0) {
            throw new Error('No text results returned.');
        }

        console.log(`   📝 Found ${textResults.length} trend articles/snippets.`);

        // Process results
        textResults.slice(0, MAX_IMAGES).forEach((item, index) => {
            results.push({
                id: index + 1,
                title: item.title,
                content: item.content || item.snippet || "No description available",
                url: item.url,
                source: 'api-search',
                timestamp: new Date().toISOString()
            });
        });

    } catch (error) {
        console.log(`   ⚠️ Trend Search issue detected: ${error.message}`);
        console.log('   ✨ Using outdated/fallback trend data...');
        return getFallbackTrends();
    }

    // Save metadata
    const trendsPath = path.join(DATA_DIR, 'trends.json');
    fs.writeFileSync(trendsPath, JSON.stringify(results, null, 2));

    console.log(`\n✅ Trend Search complete! Saved ${results.length} insights.`);
    return results;
}

// ... helper to get fallback trends
function getFallbackTrends() {
    return [
        { id: 1, title: 'Retro Futurism', content: 'Combining 80s aesthetics with futuristic elements.', url: '#', source: 'fallback' },
        { id: 2, title: 'Sustainable Nature', content: 'Eco-friendly themes, plants, and earth tones.', url: '#', source: 'fallback' },
        { id: 3, title: 'Minimalist Typography', content: 'Bold, simple text-based designs with meaningful quotes.', url: '#', source: 'fallback' },
        { id: 4, title: 'Cyberpunk Glitch', content: 'Distorted digital art and neon colors.', url: '#', source: 'fallback' },
        { id: 5, title: 'Abstract Geometry', content: 'Clean lines and geometric shapes in pastel colors.', url: '#', source: 'fallback' }
    ];
}

async function searchTrendsApi(query) {
    if (!API_TOKEN) throw new Error("AI_BUILDER_TOKEN missing");

    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            keywords: [query],
            max_results: 10,
            include_images: false, // Text only
            include_raw_content: false,
            search_depth: "basic" // Faster
        });

        const url = new URL(`${API_BASE_URL}/backend/v1/search/`);
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
                        const json = JSON.parse(body);
                        const searchResult = json.results?.[0] || json.queries?.[0];
                        const resp = searchResult?.response;
                        // Tavily results usually in `results` array inside response
                        resolve(resp?.results || []);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`API Error ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ... helper functions for fallback ...

async function getFallbackData() {
    // FAIL-SAFE: Use existing images if available
    const localResults = [];
    try {
        if (fs.existsSync(OUTPUT_DIR)) {
            const existingFiles = fs.readdirSync(OUTPUT_DIR)
                .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
                .slice(0, MAX_IMAGES);

            for (let i = 0; i < existingFiles.length; i++) {
                localResults.push({
                    id: i + 1,
                    title: `Fallback Design ${i + 1}`,
                    imageUrl: `/downloaded_images/${existingFiles[i]}`,
                    localPath: path.join(OUTPUT_DIR, existingFiles[i]),
                    source: 'local-cache'
                });
            }
        }
        if (localResults.length > 0) return localResults;
    } catch (e) { }

    // Ultimate fallback
    console.log('   📦 Using placeholder data...');
    const metadataPath = path.join(DATA_DIR, 'scraped_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(STATIC_FALLBACK_DATA, null, 2));
    return STATIC_FALLBACK_DATA;
}


import http from 'http'; // Needed for downloadImage fallback

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    scrapeDesignTrends().catch(console.error);
}

export default scrapeDesignTrends;
