import { request } from 'playwright';

async function checkVersion() {
    const url = 'https://mprof.ai-builders.space/version';
    console.log(`Checking version at ${url}...`);

    while (true) {
        try {
            const context = await request.newContext({ ignoreHTTPSErrors: true });
            const response = await context.get(url);

            if (response.ok()) {
                const data = await response.json();
                console.log(`Current Version: ${data.version}`);

                if (data.version === '1.4.4') {
                    console.log('✅ Deployment verified! Version 1.4.4 is live.');
                    break;
                } else {
                    console.log('⏳ Still on old version...');
                }
            } else {
                console.log(`Received status ${response.status()}`);
            }
            await context.dispose();
        } catch (e) {
            console.log(`Error checking version: ${e.message}`);
        }

        // Wait 30 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 30000));
    }
}

checkVersion();
