/**
 * Simplified Workflow - Etsy Scrape + AI Image Generation
 * No email functionality
 */

import dotenv from 'dotenv';
import open from 'open';
import scrapeEtsy from './scraper/etsyScraper.js';
import { analyzeAndGenerateIdeas } from './analyzer/imageAnalyzer.js';
import generateImages from './generator/imageGenerator.js';
import { startServer } from './server/server.js';

dotenv.config();

async function runSimplified() {
    console.log('\n' + '='.repeat(50));
    console.log('  🎨 T-SHIRT DESIGN WORKFLOW (Simplified)');
    console.log('='.repeat(50));

    try {
        // Step 1: Scrape Etsy
        console.log('\n📌 STEP 1: Scraping Etsy...');
        await scrapeEtsy();

        // Step 2: Generate Ideas
        console.log('\n📌 STEP 2: Generating design ideas...');
        await analyzeAndGenerateIdeas();

        // Step 3: Generate Images
        console.log('\n📌 STEP 3: Generating AI images...');
        await generateImages();

        // Step 4: Start server
        console.log('\n📌 STEP 4: Starting web server...');
        await startServer();

        console.log('\n' + '='.repeat(50));
        console.log('  ✅ COMPLETE! Opening gallery...');
        console.log('='.repeat(50));

        await open('http://localhost:3000/gallery');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runSimplified();
