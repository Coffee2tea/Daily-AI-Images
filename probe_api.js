import { request } from 'playwright';

async function probe() {
    const candidates = [
        'https://space.ai-builders.com/api/backend/v1/health',
        'https://space.ai-builders.com/api/v1/health',
        'https://space.ai-builders.com/backend/v1/health',
        'https://space.ai-builders.com/api/health', // Common Next.js API route
        'https://space.ai-builders.com/health'
    ];

    console.log('Probing API endpoints...');

    for (const url of candidates) {
        try {
            const context = await request.newContext({ ignoreHTTPSErrors: true });
            const start = Date.now();
            const response = await context.get(url);

            console.log(`[${response.status()}] ${url} -> ${response.url()}`);
            if (response.status() === 200) {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    console.log('!!! FOUND JSON API MATCH !!!');
                    console.log(await response.text());
                } else {
                    console.log(`(Status 200 but Content-Type is ${contentType})`);
                }
            }
            await context.dispose();
        } catch (e) {
            console.log(`[ERR] ${url}: ${e.message}`);
        }
    }
}

probe();
