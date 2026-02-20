/**
 * Etsy Listing Uploader
 * Requires OAuth2 access token (run `npm run etsy-auth` first)
 * Creates draft listings in your Etsy shop with AI-generated images
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const ETSY_API_KEY = process.env.ETSY_API_KEY;
const ETSY_ACCESS_TOKEN = process.env.ETSY_ACCESS_TOKEN;
const ETSY_SHOP_ID = process.env.ETSY_SHOP_ID;
const BASE = 'openapi.etsy.com';

/**
 * Make an authenticated request to the Etsy API
 */
function etsyRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        if (!ETSY_ACCESS_TOKEN) {
            reject(new Error('ETSY_ACCESS_TOKEN not set. Run `npm run etsy-auth` first.'));
            return;
        }
        if (!ETSY_API_KEY) {
            reject(new Error('ETSY_API_KEY not set in .env'));
            return;
        }

        const bodyStr = body ? JSON.stringify(body) : null;
        const options = {
            hostname: BASE,
            path: `/v3/application${path}`,
            method,
            headers: {
                'x-api-key': ETSY_API_KEY,
                'Authorization': `Bearer ${ETSY_ACCESS_TOKEN}`,
                'Accept': 'application/json',
                ...(bodyStr ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyStr)
                } : {})
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(responseBody);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(`Etsy API ${res.statusCode}: ${json.error || responseBody}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}. Body: ${responseBody.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

/**
 * Upload an image file to an Etsy listing using multipart form
 */
function uploadImageMultipart(listingId, imagePath) {
    return new Promise((resolve, reject) => {
        if (!ETSY_ACCESS_TOKEN || !ETSY_API_KEY) {
            reject(new Error('Missing Etsy credentials'));
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const boundary = `----FormBoundary${Date.now()}`;
        const filename = path.basename(imagePath);

        const header = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, imageBuffer, footer]);

        const options = {
            hostname: BASE,
            path: `/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}/images`,
            method: 'POST',
            headers: {
                'x-api-key': ETSY_API_KEY,
                'Authorization': `Bearer ${ETSY_ACCESS_TOKEN}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(responseBody);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(`Image upload failed ${res.statusCode}: ${json.error || responseBody}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse upload response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * Create a draft listing in your Etsy shop
 * @param {object} idea - Design idea object with title, theme, style, etc.
 * @param {string} imagePath - Absolute local path to the generated image
 * @returns {object} { listingId, listingUrl, success }
 */
export async function createDraftListing(idea, imagePath) {
    if (!ETSY_SHOP_ID) {
        throw new Error('ETSY_SHOP_ID not set in .env');
    }

    console.log(`\n📦 Creating Etsy draft listing: "${idea.title}"...`);

    // Step 1: Create the listing shell
    const listingPayload = {
        quantity: 999, // Print-on-demand: no stock limit
        title: idea.title.substring(0, 140), // Etsy max 140 chars
        description: [
            idea.theme || '',
            '',
            `Style: ${idea.style || 'Graphic Design'}`,
            `Colors: ${idea.colorScheme || ''}`,
            '',
            idea.designElements ? `Design Elements: ${idea.designElements}` : '',
            '',
            '✅ High-quality print-on-demand t-shirt',
            '✅ Unisex sizing available',
            '✅ Ships worldwide'
        ].filter(Boolean).join('\n'),
        price: 24.99,    // Default price — edit in Etsy dashboard
        who_made: 'i_did',
        when_made: 'made_to_order',
        taxonomy_id: 1063,  // Clothing > Tops & Shirts > T-Shirts (standard Etsy taxonomy)
        tags: [
            'tshirt', 'graphic tee', 'ai art',
            (idea.style || 'design').toLowerCase().replace(/\s+/g, ' ').split(' ').slice(0, 2).join(' '),
            (idea.mood || 'unique').toLowerCase()
        ].slice(0, 13),     // Etsy max 13 tags
        materials: ['cotton'],
        shipping_profile_id: null,   // Will be set manually in Etsy dashboard
        return_policy_id: null,      // Will be set manually if needed
        is_draft: true               // Save as draft, not published yet
    };

    const listing = await etsyRequest('POST', `/shops/${ETSY_SHOP_ID}/listings`, listingPayload);
    const listingId = listing.listing_id;
    console.log(`   ✅ Draft listing created (ID: ${listingId})`);

    // Step 2: Upload the image
    if (imagePath && fs.existsSync(imagePath)) {
        try {
            await uploadImageMultipart(listingId, imagePath);
            console.log(`   🖼️ Image uploaded to listing`);
        } catch (imgErr) {
            console.error(`   ⚠️ Image upload failed: ${imgErr.message} (listing still created)`);
        }
    }

    const listingUrl = `https://www.etsy.com/listing/${listingId}`;
    console.log(`   🔗 View draft: ${listingUrl}`);

    return {
        success: true,
        listingId,
        listingUrl,
        title: listing.title
    };
}

export default { createDraftListing };
