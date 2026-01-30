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
const MAX_IMAGES = 10;
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

export async function scrapeGoogleImages() {
    const dynamicQuery = getDynamicQuery();
    console.log('\n🔍 Starting Image Search (via AI Builder Tavily API)...');
    console.log(`   Search query: "${dynamicQuery}" (Randomized for variety)`);

    // Ensure directories exist
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const results = [];

    try {
        // --- API Search Logic ---
        console.log(`   🌐 Connecting to Search API...`);

        try {
            apiResponse = await searchImagesApi(dynamicQuery);
        } catch (e) {
            console.log(`   ⚠️ API Request Failed: ${e.message}`);
            console.log('   ℹ️ Ensure AI_BUILDER_TOKEN is set correctly.');
            throw e;
        }

        // Parse results
        // Structure: { results: [ { keyword: "...", response: { images: [ ... ], results: [ ... ] } } ] }
        const images = apiResponse.images || [];

        if (!images || images.length === 0) {
            console.log("   ⚠️ No images found in API response. Falling back to text results for links?");
            // If no images property, try to find image URLs in text results? Unlikely to work well for raw images.
            throw new Error('No images returned by Search API');
        }

        console.log(`   📷 Found ${images.length} candidates. Downloading (Parallel)...`);

        const downloadTasks = images.slice(0, MAX_IMAGES + 5).map(async (item, index) => {
            const imageUrl = item.url || item.src;
            if (!imageUrl) return null;

            const tempCount = index + 1; // Temporary ID for logging
            const filename = `google_design_${String(tempCount).padStart(2, '0')}.jpg`;
            const filepath = path.join(OUTPUT_DIR, filename);

            try {
                // console.log(`   ⬇️ Downloading image ${tempCount}...`);
                await downloadImage(imageUrl, filepath);
                return {
                    id: tempCount,
                    title: item.title || item.description || `Design #${tempCount}`,
                    imageUrl: `/downloaded_images/${filename}`,
                    localPath: filepath,
                    source: 'api-search',
                    originalLink: item.source_url || imageUrl
                };
            } catch (err) {
                // console.log(`   ⚠️ Failed to download image ${tempCount}: ${err.message}`);
                return null;
            }
        });

        const downloadResults = await Promise.all(downloadTasks);

        // Filter out failures and re-assign IDs to be sequential
        results.push(...downloadResults.filter(r => r !== null));

        // Re-number IDs
        results.forEach((r, i) => r.id = i + 1);

        // Trim to MAX_IMAGES
        if (results.length > MAX_IMAGES) {
            results.length = MAX_IMAGES;
        }

        if (results.length === 0) {
            throw new Error('Failed to download any valid images from API results');
        }

    } catch (error) {
        console.log(`   ⚠️ Scraping/API issue detected: ${error.message}`);
        console.log('   ✨ Using existing local images/placeholders for demo...');

        return await getFallbackData();
    }

    // Save metadata
    const metadataPath = path.join(DATA_DIR, 'scraped_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));

    console.log(`\n✅ Scraping complete! Saved ${results.length} images.`);
    return results;
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
    scrapeGoogleImages().catch(console.error);
}

export default scrapeGoogleImages;
