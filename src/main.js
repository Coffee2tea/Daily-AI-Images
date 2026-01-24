/**
 * Main Workflow Orchestrator
 * Runs the complete T-shirt design automation pipeline
 */

import dotenv from 'dotenv';
import open from 'open';
import scrapeEtsy from './scraper/etsyScraper.js';
import { analyzeAndGenerateIdeas } from './analyzer/imageAnalyzer.js';
import generateImages from './generator/imageGenerator.js';
import { sendIdeasEmail, sendConfirmationEmail } from './emailer/emailService.js';
import { startServer } from './server/server.js';

dotenv.config();

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  🎨 T-SHIRT DESIGN AUTOMATION WORKFLOW');
    console.log('='.repeat(60));
    console.log(`  Started: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    try {
        // Step 1: Scrape Etsy for popular designs
        console.log('\n📌 STEP 1: Scraping Etsy for T-shirt designs...');
        const scrapedImages = await scrapeEtsy();
        console.log(`   Found ${scrapedImages.length} designs`);

        // Step 2: Analyze images and generate ideas
        console.log('\n📌 STEP 2: Analyzing images and generating ideas...');
        const ideas = await analyzeAndGenerateIdeas();
        console.log(`   Generated ${ideas.length} unique design ideas`);

        // Step 3 & 4: Run in parallel - Send ideas email AND generate images
        console.log('\n📌 STEP 3 & 4: Sending emails and generating images (parallel)...');

        const [emailResult, generatedImages] = await Promise.all([
            sendIdeasEmail(ideas),
            generateImages()
        ]);

        console.log(`   📧 Ideas email: ${emailResult.success ? 'Sent' : 'Skipped'}`);
        console.log(`   🖼️ Generated: ${generatedImages.length} images`);

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
