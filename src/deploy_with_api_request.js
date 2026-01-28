import { request } from 'playwright';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

async function deploy() {
    console.log('Starting deployment via Playwright APIRequest...');

    // Configuration
    const token = process.env.AI_BUILDER_TOKEN;
    // Using the user-specified domain
    const deployUrl = 'https://space.ai-builders.com/backend/v1/deployments';

    // Read config
    let config;
    try {
        const configFile = await fs.readFile('deploy-config.json', 'utf-8');
        config = JSON.parse(configFile);
        console.log('Loaded deploy-config.json');
    } catch (e) {
        console.error('Failed to read deploy-config.json:', e);
        process.exit(1);
    }

    // Inject GEMINI_API_KEY from environment to ensure it's valid
    if (process.env.GEMINI_API_KEY) {
        if (!config.env_vars) config.env_vars = {};
        config.env_vars.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        console.log('✅ Injected GEMINI_API_KEY from local environment');
    } else {
        console.warn('⚠️ GEMINI_API_KEY not found in local environment!');
    }

    // Create API Context with SSL verification disabled
    const apiContext = await request.newContext({
        ignoreHTTPSErrors: true,
        baseURL: 'https://space.ai-builders.com',
        extraHTTPHeaders: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    try {
        console.log(`Sending POST request to ${deployUrl}...`);

        // Attempt 1: /backend/v1/deployments (Standard OpenAPI path)
        // 5 Minute timeout
        let response = await apiContext.post('/backend/v1/deployments', {
            data: config,
            timeout: 300000
        });

        if (response.status() === 404) {
            console.log('404 on /backend/v1/deployments. Trying /api/v1/deployments...');
            // Attempt 2: /api/v1/deployments
            response = await apiContext.post('/api/v1/deployments', {
                data: config,
                timeout: 300000
            });
        }

        console.log(`Status: ${response.status()} ${response.statusText()}`);
        const text = await response.text();
        console.log('Body:', text);

        const result = {
            status: response.status(),
            statusText: response.statusText(),
            body: text,
            url: response.url()
        };

        await fs.writeFile('deploy_result_api.json', JSON.stringify(result, null, 2));
        console.log('Saved response to deploy_result_api.json');

    } catch (error) {
        console.error('An error occurred during deployment:', error);
    } finally {
        await apiContext.dispose();
    }
}

deploy();
