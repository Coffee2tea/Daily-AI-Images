
import https from 'https';

const API_BASE_URL = "https://space.ai-builders.com";
const API_TOKEN = "sk_e954e069_055cfe5e1e0e13a0e5cd1aaa141412afb110"; // Hardcoded for test script only

async function callImageApi(prompt) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            prompt: prompt,
            n: 1,
            size: "1024x1024"
        });

        const url = new URL(`${API_BASE_URL}/backend/v1/images/generations`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Length': data.length
            },
            rejectUnauthorized: false
        };

        console.log(`Sending request for prompt: "${prompt}"...`);
        const startTime = Date.now();

        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const duration = (Date.now() - startTime) / 1000;
                console.log(`Response received in ${duration.toFixed(2)}s`);

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(body);
                        console.log("Success:", JSON.stringify(json).substring(0, 100) + "...");
                        resolve(json);
                    } catch (e) {
                        reject(new Error(`Failed to parse API response: ${e.message}`));
                    }
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

(async () => {
    console.log("🚀 Testing Image Generation Latency...");
    try {
        await callImageApi("A cute robot t-shirt design");
        console.log("✅ Test Complete");
    } catch (e) {
        console.error("❌ Test Failed:", e.message);
    }
})();
