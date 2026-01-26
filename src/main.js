/**
 * Main Workflow Orchestrator
 * Runs the complete T-shirt design automation pipeline
 */

import dotenv from 'dotenv';
import open from 'open';
import scrapeGoogleImages from './scraper/googleScraper.js';
import { analyzeAndGenerateIdeas } from './analyzer/imageAnalyzer.js';
import generateImages from './generator/imageGenerator.js';
import { sendIdeasEmail, sendConfirmationEmail } from './emailer/emailService.js';
import { startServer } from './server/server.js';

dotenv.config();

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  🤖 YOUR AI EMPLOYEE - T-SHIRT DESIGN');
    console.log('='.repeat(60));
    console.log(`  Started: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    try {
        // Step 1: Scrape Google Images for popular designs
        console.log('\n📌 STEP 1: Scraping Google Images for T-shirt designs...');
        const scrapedImages = await scrapeGoogleImages();
        console.log(`   Found ${scrapedImages.length} designs`);

        // Step 2: Analyze images and generate ideas
        console.log('\n📌 STEP 2: Analyzing images and generating ideas...');
        const ideas = await analyzeAndGenerateIdeas();
        console.log(`   Generated ${ideas.length} unique design ideas`);

        // Step 3: Generate images first
        console.log('\n📌 STEP 3: Generating images...');
        const generatedImages = await generateImages();
        console.log(`   🖼️ Generated: ${generatedImages.length} images`);

        // Step 4: Send ideas email with the generated images
        console.log('\n📌 STEP 4: Sending ideas email...');
        const emailResult = await sendIdeasEmail(ideas);
        console.log(`   📧 Ideas email: ${emailResult.success ? 'Sent' : 'Skipped'}`);

        // Step 5: Start server and send confirmation email
        console.log('\n📌 STEP 5: Starting server and sending confirmation...');
        await startServer();
        await sendConfirmationEmail();

        // Open browser to confirmation page
        const confirmUrl = `http://localhost:${process.env.PORT || 3000}/confirm`;
        console.log(`\n${'='.repeat(60)}`);
        console.log('  ✅ WORKFLOW COMPLETE!');
        console.log('='.repeat(60));
        console.log(`  🌐 Confirmation page: ${confirmUrl}`);
        console.log(`  🖼️ Gallery page: http://localhost:${process.env.PORT || 3000}/gallery`);
        console.log('='.repeat(60) + '\n');

        // Auto-open browser
        await open(confirmUrl);

    } catch (error) {
        console.error('\n❌ Workflow error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
