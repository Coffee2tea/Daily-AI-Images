
import https from 'https';

const API_KEY = "sk_e954e069_055cfe5e1e0e13a0e5cd1aaa141412afb110";

console.log("Probing Search API...");

const data = JSON.stringify({
    keywords: ["creative t-shirt design trends 2024"],
    max_results: 5
});

const options = {
    hostname: 'space.ai-builders.com',
    port: 443,
    path: '/backend/v1/search/',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': data.length
    },
    rejectUnauthorized: false // Ignore cert errors
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (d) => {
        body += d;
    });
    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log("Raw body:", body);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
