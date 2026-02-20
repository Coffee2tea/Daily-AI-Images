/**
 * Trend Ideas Scraper (AI Builder Space Search API + AI Summarization)
 * Searches web for the LATEST global popular design trends (not limited to t-shirts),
 * then uses AI to analyze and synthesize the raw results into structured trend ideas.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

const DATA_DIR = path.join(rootDir, 'data');
const API_BASE_URL = "https://space.ai-builders.com";
const API_TOKEN = process.env.AI_BUILDER_TOKEN;

// ── Broad trend queries: not limited to t-shirts ──────────────────────────────
const TREND_QUERIES = [
    'trending design aesthetics popular culture 2025',
    'viral graphic design trends social media 2025',
    'popular fashion streetwear aesthetics trend 2025',
    'top creative design movements art style 2025',
    'what design styles are trending right now 2025',
    'popular print design patterns artwork trend 2026',
    'emerging visual art trends color palette 2025',
    'most popular graphic styles creators use 2025'
];

// ── Fallback data ──────────────────────────────────────────────────────────────
function getFallbackTrends() {
    return [
        { id: 1, title: 'Dark Academia', content: 'Rich earthy tones, vintage textures, and literary motifs. Combines Gothic and classical influences for an intellectual, moody aesthetic.', url: '#', source: 'fallback', aiSummary: true },
        { id: 2, title: 'Y2K Revival', content: 'Nostalgic 2000s-era design: chrome effects, butterfly motifs, low-rise silhouettes, and bubbly fonts in metallics and baby pink.', url: '#', source: 'fallback', aiSummary: true },
        { id: 3, title: 'Maximalist Bold Graphics', content: 'Anti-minimalism: loud color clashes, oversized typography, mixed patterns, and chaotic collage-style compositions.', url: '#', source: 'fallback', aiSummary: true },
        { id: 4, title: 'Aura / Blurry Gradient', content: 'Soft, glowing gradient orbs and aurora-like color transitions. Ethereal and calming, dominant in digital art and apparel.', url: '#', source: 'fallback', aiSummary: true },
        { id: 5, title: 'Cottagecore & Nature Folk', content: 'Botanical illustrations, folk-art florals, hand-drawn textures, and pastoral scenes in warm natural palettes.', url: '#', source: 'fallback', aiSummary: true }
    ];
}

// ── Step 1: Search the web for trend articles (with 1 retry) ──────────────────
async function searchTrendsApi(query, attempt = 1) {
    if (!API_TOKEN) throw new Error("AI_BUILDER_TOKEN missing");
    try {
        return await searchTrendsApiOnce(query);
    } catch (e) {
        // Retry once on timeout or network error (not on auth/API key errors)
        const isRetryable = e.message.includes('timeout') || e.message.includes('ECONNRESET') || e.message.includes('ETIMEDOUT');
        if (attempt === 1 && isRetryable) {
            console.log(`   ♻️ Search API timeout/error — retrying in 3s... (${e.message})`);
            await new Promise(r => setTimeout(r, 3000));
            return searchTrendsApi(query, 2);
        }
        throw e;
    }
}

async function searchTrendsApiOnce(query) {

    console.log(`   📡 Sending search query: "${query}"`);

    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            keywords: [query],
            max_results: 10,
            include_images: false,       // TEXT ONLY — no images
            include_raw_content: false,
            search_depth: "advanced"     // Deeper = richer results
        });

        const url = new URL(`${API_BASE_URL}/backend/v1/search/`);
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
                        const searchResult = json.results?.[0] || json.queries?.[0];
                        const resp = searchResult?.response;
                        resolve(resp?.results || []);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${body.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(); reject(new Error('Search API timeout')); });
        req.write(data);
        req.end();
    });
}

// ── Step 2: Use AI to analyze and summarize raw search results ─────────────────
async function aiSummarizeTrends(rawResults, query) {
    if (!API_TOKEN) throw new Error("AI_BUILDER_TOKEN missing");
    if (!rawResults || rawResults.length === 0) throw new Error("No raw results to analyze");

    // Build context from raw search snippets
    const rawContext = rawResults.slice(0, 10).map((r, i) =>
        `[${i + 1}] ${r.title}\n${r.content || r.snippet || '(no snippet)'}\nURL: ${r.url || '#'}`
    ).join('\n\n');

    console.log(`   🧠 AI is analyzing ${rawResults.length} search results...`);

    const data = JSON.stringify({
        model: "gpt-5",
        messages: [
            {
                role: "system",
                content: `You are a trend analyst and creative director specializing in visual culture, fashion, and design movements.
Your task: extract the most meaningful, actionable design trend insights from raw web search snippets.
Output ONLY valid JSON — no markdown, no explanation.`
            },
            {
                role: "user",
                content: `I searched for: "${query}"

Here are the raw web search results:
${rawContext}

Analyze these snippets and extract 5-8 distinct TRENDING DESIGN IDEAS/AESTHETICS.
These should reflect what's actually popular right now in global culture — not limited to t-shirts.
Include styles from: streetwear, graphic art, digital art, pop culture, social media trends, etc.

For each trend, provide:
- title: Short catchy name (2-4 words)
- content: Rich description covering visual style, colors, textures, mood, cultural context (3-4 sentences)
- relevance: Why this is popular right now (1-2 sentences)
- tags: Array of 3-5 keywords

Output this exact JSON structure:
{
  "trends": [
    {
      "title": "...",
      "content": "...",
      "relevance": "...",
      "tags": ["...", "..."]
    }
  ]
}`
            }
        ],
        temperature: 0.6,
        max_tokens: 3000,
        response_format: { type: "json_object" }
    });

    return new Promise((resolve, reject) => {
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
                        if (!content) throw new Error("No content in AI response");
                        const parsed = JSON.parse(content);
                        const trends = parsed.trends || parsed.ideas || parsed.results || [];
                        resolve(trends);
                    } catch (e) {
                        reject(new Error(`AI summarization parse failed: ${e.message}`));
                    }
                } else {
                    reject(new Error(`AI API Error ${res.statusCode}: ${body.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('AI summarization timeout')); });
        req.write(data);
        req.end();
    });
}

// ── Main Export ────────────────────────────────────────────────────────────────
export async function scrapeDesignTrends() {
    // Pick 2 diverse queries for richer coverage
    const shuffled = [...TREND_QUERIES].sort(() => Math.random() - 0.5);
    const queries = shuffled.slice(0, 2);

    console.log('\n🔍 Starting Trend Ideas Search (AI Builder Tavily API)...');
    console.log(`   Queries: [1] "${queries[0]}" | [2] "${queries[1]}"`);

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    let results = [];

    try {
        // ── Step 1: Search both queries in parallel ────────────────────────────
        const [raw1, raw2] = await Promise.all([
            searchTrendsApi(queries[0]).catch(e => { console.log(`   ⚠️ Query 1 failed: ${e.message}`); return []; }),
            searchTrendsApi(queries[1]).catch(e => { console.log(`   ⚠️ Query 2 failed: ${e.message}`); return []; })
        ]);

        const allRaw = [...raw1, ...raw2];
        console.log(`   📝 Retrieved ${allRaw.length} raw search results.`);

        if (allRaw.length === 0) throw new Error('No search results returned from both queries.');

        // ── Step 2: AI analyzes and summarizes ────────────────────────────────
        console.log(`   🤖 Sending to AI for analysis and synthesis...`);
        const aiTrends = await aiSummarizeTrends(allRaw, queries.join(' + '));

        if (!aiTrends || aiTrends.length === 0) throw new Error('AI returned no trend ideas.');

        console.log(`   ✨ AI extracted ${aiTrends.length} trend ideas.`);

        // ── Format results ─────────────────────────────────────────────────────
        results = aiTrends.map((t, i) => ({
            id: i + 1,
            title: t.title || `Trend #${i + 1}`,
            content: [t.content, t.relevance].filter(Boolean).join(' '),
            tags: t.tags || [],
            url: '#',
            source: 'ai-analyzed',
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.log(`   ⚠️ Search/AI pipeline issue: ${error.message}`);
        console.log('   📦 Using curated fallback trend data...');
        results = getFallbackTrends();
    }

    // Save to trends.json
    const trendsPath = path.join(DATA_DIR, 'trends.json');
    fs.writeFileSync(trendsPath, JSON.stringify(results, null, 2));

    console.log(`\n✅ Trend search complete! Saved ${results.length} AI-analyzed trend ideas.`);
    return results;
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    scrapeDesignTrends().catch(console.error);
}

export default scrapeDesignTrends;
