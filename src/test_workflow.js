
import scrapeGoogleImages from './scraper/googleScraper.js';
import { analyzeAndGenerateIdeas } from './analyzer/imageAnalyzer.js';
import generateImages from './generator/imageGenerator.js';

async function runTest() {
    console.log("=== TEST START ===");

    try {
        console.log("\n1. Testing Scraper (Expect Clean Preset Return)...");
        const scraped = await scrapeGoogleImages();
        console.log(`   Result: ${scraped.length} items`);

        console.log("\n2. Testing Analyzer...");
        const ideas = await analyzeAndGenerateIdeas();
        console.log(`   Result: ${ideas.length} ideas (Expected 10)`);

        console.log("\n3. Testing Generator (Gemini 2.5 Flash Image)...");
        const images = await generateImages();
        console.log(`   Result: ${images.length} images (Expected 10)`);

        console.log("\n=== TEST COMPLETE ===");
    } catch (e) {
        console.error("TEST FAILED:", e);
    }
}

runTest();
