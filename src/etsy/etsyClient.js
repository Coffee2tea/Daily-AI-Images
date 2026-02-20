/**
 * Etsy Open API v3 Client
 * Read-only operations using API Key (no OAuth needed for public data)
 */

import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const ETSY_API_KEY = process.env.ETSY_API_KEY;
const BASE = 'openapi.etsy.com';

/**
 * Make a GET request to the Etsy Open API v3
 */
function etsyGet(path) {
    return new Promise((resolve, reject) => {
        if (!ETSY_API_KEY) {
            reject(new Error('ETSY_API_KEY not set in .env'));
            return;
        }

        const options = {
            hostname: BASE,
            path: `/v3/application${path}`,
            method: 'GET',
            headers: {
                'x-api-key': ETSY_API_KEY,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(`Etsy API ${res.statusCode}: ${json.error || body}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Etsy response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Etsy API request timed out'));
        });
        req.end();
    });
}

/**
 * Get shop information
 */
export async function getShopInfo(shopId) {
    return etsyGet(`/shops/${shopId}`);
}

/**
 * Get active listings from a shop
 */
export async function getActiveListings(shopId, limit = 10) {
    return etsyGet(`/shops/${shopId}/listings/active?limit=${limit}&includes[]=MainImage`);
}

/**
 * Search Etsy marketplace listings for trend research
 */
export async function searchListings(keywords, limit = 10) {
    const query = encodeURIComponent(keywords);
    return etsyGet(`/listings/active?keywords=${query}&limit=${limit}&includes[]=MainImage&sort_on=score`);
}

/**
 * Get trending listing titles/themes for AI analysis context
 * Returns an array of { title, description, price, url } objects
 */
export async function getTrendingDesignTitles(query = 'trending t-shirt graphic design 2025', limit = 10) {
    try {
        const data = await searchListings(query, limit);
        if (!data.results || data.results.length === 0) {
            return [];
        }
        return data.results.map(listing => ({
            title: listing.title,
            description: listing.description?.substring(0, 200) || '',
            price: listing.price ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}` : '',
            url: listing.url,
            tags: listing.tags || []
        }));
    } catch (e) {
        console.error('Etsy trend search failed:', e.message);
        return [];
    }
}

export default { getShopInfo, getActiveListings, searchListings, getTrendingDesignTitles };
