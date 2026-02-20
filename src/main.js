/**
 * Main Workflow Orchestrator
 * Runs the complete T-shirt design automation pipeline
 */

import dotenv from 'dotenv';
import open from 'open';
import scrapeDesignTrends from './scraper/googleScraper.js';
import { analyzeAndGenerateIdeas } from './analyzer/imageAnalyzer.js';
import generateImages from './generator/imageGenerator.js';
import { sendIdeasEmail, sendConfirmationEmail } from './emailer/emailService.js';
import { createDraftListing } from './etsy/etsyUploader.js';
import { startServer } from './server/server.js';

dotenv.config();

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  🤖 YOUR AI EMPLOYEE - TREND & DESIGN AUTOMATION');
    console.log('='.repeat(60));
    console.log(`  Started: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    try {
        // Clear previous run data
        const fs = await import('fs');
        const path = await import('path');
        const rootDir = process.cwd();
        const manifestPath = path.join(rootDir, 'data', 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                fs.unlinkSync(manifestPath);
                console.log('   🧹 Cleared previous run manifest.');
            } catch (e) {
                console.log('   ⚠️ Failed to clear manifest:', e.message);
            }
        }

        // Step 1: Search for Design Trends
        console.log('\n📌 STEP 1: Searching for Fashion & Design Trends...');
        const trends = await scrapeDesignTrends();
        console.log(`   Found ${trends.length} trend insights`);

        // Step 2: Analyze images and generate ideas
        console.log('\n📌 STEP 2: Analyzing images and generating ideas...');
        const ideas = await analyzeAndGenerateIdeas();
        console.log(`   Generated ${ideas.length} unique design ideas`);

        // Step 3: Generate images first
        console.log('\n📌 STEP 3: Generating images...');
        const generatedImages = await generateImages();
        console.log(`   🖼️ Generated: ${generatedImages.length} images`);

        // Step 4: Auto-upload to Etsy as draft listings
        console.log('\n📌 STEP 4: Uploading designs to Etsy...');
        if (process.env.ETSY_ACCESS_TOKEN && process.env.ETSY_SHOP_ID) {
            const fs2 = await import('fs');
            const path2 = await import('path');
            const historyPath = path2.join(process.cwd(), 'data', 'history.json');

            let imagesToUpload = ideas; // default: pair ideas with generated images
            let uploaded = 0;
            for (let i = 0; i < ideas.length; i++) {
                const idea = ideas[i];
                const imgFile = path2.join(process.cwd(), 'generated_images', `design_${String(i + 1).padStart(2, '0')}.png`);
                try {
                    await createDraftListing(idea, imgFile);
                    uploaded++;
                } catch (e) {
                    console.log(`   ⚠️ Etsy upload failed for design ${i + 1}: ${e.message}`);
                }
            }
            console.log(`   🛍️ Uploaded ${uploaded}/${ideas.length} designs to Etsy as draft listings`);
        } else {
            // Fallback to email if Etsy not configured
            console.log('   ℹ️ Etsy not configured — falling back to email');
            const emailResult = await sendIdeasEmail(ideas);
            console.log(`   📧 Ideas email: ${emailResult.success ? 'Sent' : 'Skipped'}`);
        }

        // Step 5: Start server
        console.log('\n📌 STEP 5: Starting server...');
        await startServer();
        if (!process.env.ETSY_ACCESS_TOKEN) {
            await sendConfirmationEmail();
        }

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
