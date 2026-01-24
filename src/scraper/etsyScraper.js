/**
 * Etsy Image Scraper
 * Scrapes popular T-shirt designs from Etsy using Playwright
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

// Configuration
const SEARCH_QUERY = 'best seller t-shirt design graphic';
const MAX_IMAGES = 10;
const OUTPUT_DIR = path.join(rootDir, 'downloaded_images');
const DATA_DIR = path.join(rootDir, 'data');

/**
 * Download image from URL
 */
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const options = {
            rejectUnauthorized: false // Bypass SSL certificate issues
        };

        const request = protocol.get(url, options, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location, filepath)
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
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

/**
 * Main scraping function
 */
export async function scrapeEtsy() {
    console.log('\n🔍 Starting Etsy scraper...');
    console.log(`   Search query: "${SEARCH_QUERY}"`);

    // Ensure directories exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let browser;
    const results = [];

    try {
        // Launch browser
        console.log('   🌐 Launching browser...');
        browser = await chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        // Navigate to Etsy search
        const searchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(SEARCH_QUERY)}&ref=pagination&page=1`;
        console.log(`   📄 Navigating to Etsy...`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        // Wait longer for dynamic content to load
        console.log('   ⏳ Waiting for content to load...');
        await page.waitForTimeout(5000);

        // Save debug screenshot
        const screenshotPath = path.join(DATA_DIR, 'debug_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`   📸 Debug screenshot saved: ${screenshotPath}`);

        // Try to find listing items
        console.log('   🔎 Searching for T-shirt designs...');

        // Multiple selectors to try (Etsy changes their DOM frequently)
        const selectors = [
            '[data-listing-id]',
            '.v2-listing-card',
            '.listing-link',
            '[data-search-result]',
            '.wt-grid__item-xs-6'
        ];

        let listings = [];
        for (const selector of selectors) {
            listings = await page.$$(selector);
            if (listings.length > 0) {
                console.log(`   ✓ Found ${listings.length} listings with selector: ${selector}`);
                break;
            }
        }

        if (listings.length === 0) {
            console.log('   ⚠️ Could not find listings with standard selectors.');
            console.log('   📸 Using fallback: extracting images directly...');

            // Scroll to load more images
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await page.waitForTimeout(1000);
            }

            // Fallback: get all product images with updated logic
            const images = await page.$$eval('img', imgs =>
                imgs
                    .filter(img => {
                        const src = img.src || '';
                        const dataSrc = img.getAttribute('data-src') || '';
                        const actualSrc = src || dataSrc;

                        // Check for Etsy image patterns
                        const isEtsyImage = actualSrc.includes('etsystatic') ||
                            actualSrc.includes('etsy.com');

                        // Check dimensions
                        const hasGoodSize = (img.width > 100 || img.naturalWidth > 100 ||
                            img.height > 100 || img.naturalHeight > 100);

                        // Exclude non-product images
                        const isNotIcon = !actualSrc.includes('avatar') &&
                            !actualSrc.includes('icon') &&
                            !actualSrc.includes('sprite') &&
                            !actualSrc.includes('logo');

                        return isEtsyImage && hasGoodSize && isNotIcon;
                    })
                    .slice(0, 30)
                    .map(img => ({
                        src: img.src || img.getAttribute('data-src'),
                        alt: img.alt || 'T-shirt Design'
                    }))
            );

            console.log(`   📷 Found ${images.length} potential images`);

            // Download images
            for (let i = 0; i < Math.min(images.length, MAX_IMAGES); i++) {
                const img = images[i];
                if (!img.src) continue;

                try {
                    // Get higher resolution version
                    let imageUrl = img.src.replace(/il_\d+x\d+/, 'il_794xN');

                    const filename = `etsy_design_${String(i + 1).padStart(2, '0')}.jpg`;
                    const filepath = path.join(OUTPUT_DIR, filename);

                    console.log(`   ⬇️ Downloading image ${i + 1}/${MAX_IMAGES}...`);
                    await downloadImage(imageUrl, filepath);

                    results.push({
                        id: i + 1,
                        title: img.alt || `Design ${i + 1}`,
                        imageUrl: imageUrl,
                        localPath: filepath,
                        source: 'etsy'
                    });
                } catch (err) {
                    console.log(`   ⚠️ Failed to download image ${i + 1}: ${err.message}`);
                }
            }
        } else {
            // Extract data from listings
            for (let i = 0; i < Math.min(listings.length, MAX_IMAGES); i++) {
                try {
                    const listing = listings[i];

                    // Get image
                    const img = await listing.$('img');
                    const imgSrc = img ? await img.getAttribute('src') : null;
                    const imgAlt = img ? await img.getAttribute('alt') : `Design ${i + 1}`;

                    if (imgSrc) {
                        // Get higher resolution
                        let imageUrl = imgSrc.replace(/il_\d+x\d+/, 'il_794xN');

                        const filename = `etsy_design_${String(i + 1).padStart(2, '0')}.jpg`;
                        const filepath = path.join(OUTPUT_DIR, filename);

                        console.log(`   ⬇️ Downloading image ${i + 1}/${MAX_IMAGES}...`);
                        await downloadImage(imageUrl, filepath);

                        results.push({
                            id: i + 1,
                            title: imgAlt || `Design ${i + 1}`,
                            imageUrl: imageUrl,
                            localPath: filepath,
                            source: 'etsy'
                        });
                    }
                } catch (err) {
                    console.log(`   ⚠️ Error processing listing ${i + 1}: ${err.message}`);
                }
            }
        }

        await browser.close();

    } catch (error) {
        console.error(`   ❌ Scraping error: ${error.message}`);
        if (browser) await browser.close();

        // Fallback: create placeholder data if scraping fails
        console.log('   📦 Creating sample data with demo images...');
        return await createSampleData();
    }

    // If no images were scraped, use demo images
    if (results.length === 0) {
        console.log('   ⚠️ No images scraped. Using demo images instead...');
        return await createSampleData();
    }

    // Save metadata
    const metadataPath = path.join(DATA_DIR, 'scraped_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));

    console.log(`\n✅ Scraping complete! Downloaded ${results.length} images.`);
    console.log(`   📁 Images saved to: ${OUTPUT_DIR}`);
    console.log(`   📄 Metadata saved to: ${metadataPath}`);

    return results;
}

/**
 * Create sample data with real images from Unsplash
 */
async function createSampleData() {
    const sampleDesigns = [
        { title: 'Vintage Sunset Mountain Design', style: 'Retro', query: 'mountain sunset' },
        { title: 'Minimalist Line Art Portrait', style: 'Minimalist', query: 'line art' },
        { title: 'Abstract Geometric Pattern', style: 'Abstract', query: 'geometric pattern' },
        { title: 'Tropical Palm Paradise', style: 'Nature', query: 'palm tree tropical' },
        { title: 'Urban Street Art Graffiti', style: 'Street Art', query: 'graffiti art' },
        { title: 'Cute Kawaii Character', style: 'Kawaii', query: 'cute illustration' },
        { title: 'Bold Typography Quote', style: 'Typography', query: 'typography design' },
        { title: 'Watercolor Floral Bouquet', style: 'Watercolor', query: 'watercolor flowers' },
        { title: 'Retro 80s Neon Vibes', style: '80s Retro', query: 'neon lights' },
        { title: 'Space Galaxy Explorer', style: 'Sci-Fi', query: 'galaxy space' }
    ];

    const results = [];

    // Download sample images from Unsplash (free API, no key needed for limited use)
    for (let i = 0; i < sampleDesigns.length; i++) {
        const design = sampleDesigns[i];
        const filename = `sample_design_${String(i + 1).padStart(2, '0')}.jpg`;
        const filepath = path.join(OUTPUT_DIR, filename);

        // Use Unsplash Source for random images (deprecated but still works)
        // Or use picsum.photos as alternative
        const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(design.query)}/600/600`;

        try {
            console.log(`   ⬇️ Downloading sample image ${i + 1}/${sampleDesigns.length}...`);
            await downloadImage(imageUrl, filepath);

            results.push({
                id: i + 1,
                title: design.title,
                style: design.style,
                imageUrl: imageUrl,
                localPath: filepath,
                url: `https://unsplash.com/s/photos/${encodeURIComponent(design.query)}`,
                source: 'demo'
            });
        } catch (err) {
            console.log(`   ⚠️ Failed to download sample ${i + 1}: ${err.message}`);
            results.push({
                id: i + 1,
                title: design.title,
                style: design.style,
                imageUrl: null,
                localPath: null,
                source: 'sample'
            });
        }
    }

    // Save metadata
    const metadataPath = path.join(DATA_DIR, 'scraped_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));

    console.log(`   ✅ Created ${results.length} sample design entries.`);
    return results;
}

// Run directly if executed as main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    scrapeEtsy().catch(console.error);
}

export default scrapeEtsy;
