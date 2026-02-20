/**
 * Etsy OAuth2 Authorization Helper
 * Run once: `npm run etsy-auth`
 * Opens a browser for Etsy authorization, captures the token via local callback,
 * and saves it to .env automatically.
 */

import http from 'http';
import https from 'https';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');
const envPath = path.join(rootDir, '.env');

const ETSY_API_KEY = process.env.ETSY_API_KEY;
const PORT = 3000;
const CALLBACK_URL = `http://localhost:${PORT}/auth/etsy/callback`;
const SCOPES = 'listings_r listings_w listings_d shops_r';

if (!ETSY_API_KEY) {
    console.error('\n❌ ETSY_API_KEY not found in .env');
    console.error('  1. Register your app at https://www.etsy.com/developers/register');
    console.error('  2. Add ETSY_API_KEY=your_key to .env');
    process.exit(1);
}

// Generate PKCE code verifier and challenge
function generateCodeVerifier() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let verifier = '';
    for (let i = 0; i < 64; i++) {
        verifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return verifier;
}

async function sha256Base64url(str) {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(str).digest('base64url');
}

async function exchangeCodeForToken(code, codeVerifier) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: ETSY_API_KEY,
            redirect_uri: CALLBACK_URL,
            code,
            code_verifier: codeVerifier
        }).toString();

        const options = {
            hostname: 'api.etsy.com',
            path: '/v3/public/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse token response: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function updateEnvFile(accessToken, refreshToken) {
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    // Update or append ETSY_ACCESS_TOKEN
    if (envContent.includes('ETSY_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/ETSY_ACCESS_TOKEN=.*/g, `ETSY_ACCESS_TOKEN=${accessToken}`);
    } else {
        envContent += `\nETSY_ACCESS_TOKEN=${accessToken}`;
    }

    // Update or append ETSY_REFRESH_TOKEN
    if (envContent.includes('ETSY_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/ETSY_REFRESH_TOKEN=.*/g, `ETSY_REFRESH_TOKEN=${refreshToken}`);
    } else {
        envContent += `\nETSY_REFRESH_TOKEN=${refreshToken}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Tokens saved to .env');
}

async function main() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await sha256Base64url(codeVerifier);
    const state = Math.random().toString(36).substring(2);

    const authUrl = new URL('https://www.etsy.com/oauth/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', CALLBACK_URL);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('client_id', ETSY_API_KEY);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('\n🔐 Etsy OAuth2 Authorization');
    console.log('='.repeat(50));
    console.log('\nOpening browser for Etsy authorization...');
    console.log(`\nIf browser doesn't open, visit:\n${authUrl.toString()}\n`);

    // Start local callback server
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://localhost:${PORT}`);

        if (url.pathname !== '/auth/etsy/callback') {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<h2>❌ Authorization denied: ${error}</h2><p>You can close this tab.</p>`);
            server.close();
            process.exit(1);
        }

        if (!code || returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h2>❌ Invalid callback</h2>');
            server.close();
            return;
        }

        try {
            console.log('✅ Authorization code received! Exchanging for tokens...');
            const tokens = await exchangeCodeForToken(code, codeVerifier);

            if (!tokens.access_token) {
                throw new Error(`No access token in response: ${JSON.stringify(tokens)}`);
            }

            updateEnvFile(tokens.access_token, tokens.refresh_token || '');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html><body style="font-family:sans-serif;text-align:center;padding:50px">
                <h1>✅ Etsy Connected!</h1>
                <p>Your access token has been saved to <code>.env</code>.</p>
                <p>You can close this tab and return to the terminal.</p>
                </body></html>
            `);

            console.log('\n🎉 Etsy authorization complete!');
            console.log('   Access token saved to .env');
            console.log('   You can now upload designs to your Etsy shop.\n');

            setTimeout(() => { server.close(); process.exit(0); }, 1000);
        } catch (err) {
            console.error('\n❌ Token exchange failed:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h2>❌ Error: ${err.message}</h2>`);
            server.close();
            process.exit(1);
        }
    });

    server.listen(PORT, 'localhost', () => {
        // Open in browser (Windows)
        const url = authUrl.toString();
        exec(`start "" "${url}"`, (err) => {
            if (err) console.log(`\nPlease open this URL manually:\n${url}\n`);
        });
    });

    console.log(`\n⏳ Waiting for authorization on http://localhost:${PORT}/auth/etsy/callback`);
    console.log('   (Press Ctrl+C to cancel)\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
