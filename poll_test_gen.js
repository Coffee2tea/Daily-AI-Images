import { request } from 'playwright';

async function checkTestGen() {
    const url = 'https://mprof.ai-builders.space/api/debug/test-gen';
    console.log(`Polling ${url}...`);

    while (true) {
        try {
            const context = await request.newContext({ ignoreHTTPSErrors: true });
            const response = await context.get(url);

            if (response.ok()) {
                const data = await response.json();

                if (data.success === true && data.models) {
                    console.log('✅ Endpoint updated! Found models list.');
                    console.log(`Found ${data.models.models?.length || 0} models.`);
                    // Print first few models to console for debugging
                    if (data.models.models) {
                        data.models.models.forEach(m => {
                            if (m.name.includes('gemini') || m.name.includes('imagen')) {
                                console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
                            }
                        });
                    }
                    break;
                } else {
                    console.log('⏳ Still old endpoint logic (Error: ' + data.error + ')');
                }
            } else {
                console.log(`Received status ${response.status()}`);
            }
            await context.dispose();
        } catch (e) {
            console.log(`Error checking endpoint: ${e.message}`);
        }

        // Wait 30 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 30000));
    }
}

checkTestGen();
