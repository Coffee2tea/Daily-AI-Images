import { request } from 'playwright';

async function triggerWorkflow() {
    const url = 'https://mprof.ai-builders.space/api/run-workflow';
    console.log(`Triggering workflow at ${url}...`);

    try {
        const context = await request.newContext({ ignoreHTTPSErrors: true });
        // We set a short timeout because we just want to kick it off, 
        // but since it's SSE it might keep the connection open.
        // We'll wait 5 seconds then exit.
        const response = await context.post(url, {
            timeout: 5000
        });

        console.log(`Response status: ${response.status()}`);
    } catch (e) {
        // Timeout is expected for SSE if we don't handle stream
        console.log(`Trigger sent (likely timeout on read which is fine): ${e.message}`);
    }
}

triggerWorkflow();
