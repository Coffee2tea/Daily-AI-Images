/**
 * Express Web Server
 * Serves confirmation and gallery pages, handles API requests
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_VERSION = '2.0.0'; // Etsy Auto-Publish

// --- In-Memory Log Buffer for Debugging ---
const LOG_BUFFER_SIZE = 200;
const logBuffer = [];

function addToLogBuffer(type, args) {
  const msg = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  const entry = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${msg}`;
  logBuffer.push(entry);

  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

// Override console methods to capture logs
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  addToLogBuffer('info', args);
  originalLog.apply(console, args);
};

console.error = function (...args) {
  addToLogBuffer('error', args);
  originalError.apply(console, args);
};
// ------------------------------------------

// Middleware
app.use(express.json());
app.use(express.static(path.join(rootDir, 'public')));
app.use('/generated_images', express.static(path.join(rootDir, 'generated_images')));
app.use('/downloaded_images', express.static(path.join(rootDir, 'downloaded_images')));
app.use('/demo', express.static(path.join(rootDir, 'public', 'demo')));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Version check to verify deployment
app.get('/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    desc: 'Trend Search Workflow',
    timestamp: new Date().toISOString()
  });
});

// Debug: Get recent server logs
app.get('/api/debug/logs', (req, res) => {
  res.json({
    success: true,
    count: logBuffer.length,
    logs: logBuffer
  });
});

// Debug: Test Image Generation directly
app.get('/api/debug/test-gen', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ success: false, error: 'No GEMINI_API_KEY found in env' });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();

    res.json({
      success: true,
      models: data,
      message: 'Listing available models to find one that supports image generation'
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Routes
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'dashboard.html'));
});

app.get('/scraped', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'scraped.html'));
});

app.get('/ideas', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'ideas.html'));
});

app.get('/confirm', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'confirm.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'gallery.html'));
});

// API: Get generated images with metadata
app.get('/api/images', (req, res) => {
  try {
    const manifestPath = path.join(rootDir, 'data', 'manifest.json');
    const ideasPath = path.join(rootDir, 'data', 'ideas.json');
    const generatedDir = path.join(rootDir, 'generated_images');



    // Load History (Master List)
    const historyPath = path.join(rootDir, 'data', 'history.json');
    let images = [];

    let currentRunIds = new Set();

    // Get current run IDs to mark as "New"
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

        // Check if manifest is fresh (within last 10 minutes)
        const manifestTime = new Date(manifest.generatedAt).getTime();
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        if (now - manifestTime < tenMinutes && manifest.images) {
          manifest.images.forEach(img => currentRunIds.add(img.id));
        }
      } catch (e) {
        console.error('Error reading manifest:', e);
      }
    }

    if (fs.existsSync(historyPath)) {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      images = history.map(img => ({
        ...img,
        isNew: currentRunIds.has(img.id) // Flag for frontend
      }));
    } else if (fs.existsSync(manifestPath)) {
      // Fallback to just manifest if no history
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      images = (manifest.images || []).map(img => ({ ...img, isNew: true }));
    }
    // Fallback: scan generated_images directory (Legacy support)
    else if (fs.existsSync(generatedDir)) {
      const files = fs.readdirSync(generatedDir)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.svg'))
        .sort();

      // Try to load ideas for descriptions
      let ideas = [];
      if (fs.existsSync(ideasPath)) {
        ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
      }

      images = files.map((file, index) => ({
        id: index + 1,
        title: ideas[index]?.title || `Design ${String(index + 1).padStart(2, '0')}`,
        description: ideas[index]?.theme || 'AI Generated T-Shirt Design',
        imagePath: `/generated_images/${file}?v=${Date.now()}`,
        style: ideas[index]?.style || 'Modern',
        colors: ideas[index]?.colorScheme || 'Colorful'
      }));
    }

    res.json({ success: true, images });
  } catch (error) {
    console.error('Error loading images:', error);
    res.json({ success: false, images: [], error: error.message });
  }
});

// API: Get ideas
app.get('/api/ideas', (req, res) => {
  try {
    const ideasPath = path.join(rootDir, 'data', 'ideas.json');

    if (fs.existsSync(ideasPath)) {
      const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
      res.json({ success: true, ideas });
    } else {
      res.json({ success: false, ideas: [], error: 'Ideas not generated yet' });
    }
  } catch (error) {
    res.json({ success: false, ideas: [], error: error.message });
  }
});

// API: Get scraped images from Etsy
app.get('/api/scraped', (req, res) => {
  try {
    const metadataPath = path.join(rootDir, 'data', 'scraped_metadata.json');
    const downloadedDir = path.join(rootDir, 'downloaded_images');

    let images = [];

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      images = metadata.map((item, index) => ({
        id: index + 1,
        title: item.title || `Design ${index + 1}`,
        url: item.url || item.link || item.originalLink || '#',
        imageUrl: item.imageUrl || item.image,
        localPath: item.localPath ? `/downloaded_images/${path.basename(item.localPath)}` : null,
        price: item.price || '',
        shop: item.shop || item.seller || 'Web Source'
      }));
    }

    res.json({ success: true, images });
  } catch (error) {
    console.error('Error loading scraped images:', error);
    res.json({ success: false, images: [], error: error.message });
  }
});

// API: Get trend inspirations
app.get('/api/inspirations', (req, res) => {
  try {
    const trendsPath = path.join(rootDir, 'data', 'trends.json');
    let trends = [];

    if (fs.existsSync(trendsPath)) {
      trends = JSON.parse(fs.readFileSync(trendsPath, 'utf-8'));
    }

    res.json({ success: true, images: trends }); // Keep 'images' key for frontend compatibility if needed, or better change it
  } catch (error) {
    console.error('Error loading trends:', error);
    res.json({ success: false, images: [], error: error.message });
  }
});

// API: Send email with designs (kept for backward compat)
app.post('/api/send-email', async (req, res) => {
  try {
    const { recipient } = req.body;
    const { sendIdeasEmail } = await import('../emailer/emailService.js');
    const ideasPath = path.join(rootDir, 'data', 'ideas.json');

    if (!fs.existsSync(ideasPath)) {
      return res.json({ success: false, error: 'Design ideas not generated yet, please run workflow first' });
    }

    const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
    const result = await sendIdeasEmail(ideas, recipient);

    if (result.success) {
      res.json({ success: true, message: 'Email sent successfully' });
    } else {
      res.json({ success: false, error: result.error || result.reason || 'Failed to send email' });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    res.json({ success: false, error: error.message });
  }
});

// --- Cloud Etsy OAuth2 PKCE Routes ---
// Stores the PKCE code_verifier in memory between /start and /callback
const etsyOAuthState = new Map(); // state -> { codeVerifier, createdAt }

function generateCodeVerifier() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let v = '';
  for (let i = 0; i < 64; i++) v += chars.charAt(Math.floor(Math.random() * chars.length));
  return v;
}

async function sha256Base64url(str) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(str).digest('base64url');
}

async function exchangeEtsyCode(code, codeVerifier, redirectUri) {
  const https = await import('https');
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ETSY_API_KEY,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier
    }).toString();

    const req = https.default.request({
      hostname: 'api.etsy.com',
      path: '/v3/public/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Step 1: Redirect user to Etsy authorization page
app.get('/auth/etsy/start', async (req, res) => {
  if (!process.env.ETSY_API_KEY) {
    return res.status(400).send('<h2>❌ ETSY_API_KEY not set in environment variables.</h2>');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await sha256Base64url(codeVerifier);
  const state = Math.random().toString(36).substring(2) + Date.now();

  // Store verifier (expires after 10 min)
  etsyOAuthState.set(state, { codeVerifier, createdAt: Date.now() });
  // Cleanup old states
  for (const [k, v] of etsyOAuthState) {
    if (Date.now() - v.createdAt > 10 * 60 * 1000) etsyOAuthState.delete(k);
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const redirectUri = `${baseUrl}/auth/etsy/callback`;

  const authUrl = new URL('https://www.etsy.com/oauth/connect');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'listings_r listings_w listings_d shops_r');
  authUrl.searchParams.set('client_id', process.env.ETSY_API_KEY);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

// Step 2: Etsy redirects back here with the auth code
app.get('/auth/etsy/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`<h2>❌ Etsy denied authorization: ${error}</h2>`);
  }

  const stored = etsyOAuthState.get(state);
  if (!code || !stored) {
    return res.status(400).send('<h2>❌ Invalid or expired OAuth state. Please <a href="/auth/etsy/start">try again</a>.</h2>');
  }

  etsyOAuthState.delete(state);

  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const redirectUri = `${baseUrl}/auth/etsy/callback`;
    const tokens = await exchangeEtsyCode(code, stored.codeVerifier, redirectUri);

    if (!tokens.access_token) {
      throw new Error(`No access_token in response: ${JSON.stringify(tokens)}`);
    }

    console.log('✅ Etsy OAuth successful! Tokens obtained.');

    // Display tokens on screen — user copies them to deploy-config.json
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Etsy Connected!</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 60px auto; padding: 0 20px; }
    h1 { color: #f1641e; }
    .token-box { background: #1f2937; color: #86efac; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 12px 0; }
    .step { background: #f9fafb; border-left: 4px solid #f1641e; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
    button { background: #f1641e; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 6px; }
  </style>
</head>
<body>
  <h1>✅ Etsy Connected!</h1>
  <p>Copy these values into your <strong>deploy-config.json</strong> → <code>env_vars</code>, then redeploy.</p>

  <div class="step">
    <strong>ETSY_ACCESS_TOKEN</strong>
    <div class="token-box" id="at">${tokens.access_token}</div>
    <button onclick="navigator.clipboard.writeText('${tokens.access_token}')">Copy</button>
  </div>

  ${tokens.refresh_token ? `
  <div class="step">
    <strong>ETSY_REFRESH_TOKEN</strong>
    <div class="token-box" id="rt">${tokens.refresh_token}</div>
    <button onclick="navigator.clipboard.writeText('${tokens.refresh_token}')">Copy</button>
  </div>` : ''}

  <div class="step">
    <strong>Next steps:</strong>
    <ol>
      <li>Add <code>ETSY_ACCESS_TOKEN</code> (and optionally <code>ETSY_REFRESH_TOKEN</code>) to <code>deploy-config.json</code></li>
      <li>Run <code>python deploy_script.py</code> to redeploy</li>
      <li>The workflow will now auto-upload designs to your Etsy shop as draft listings</li>
    </ol>
  </div>
</body>
</html>`);

  } catch (err) {
    console.error('Etsy OAuth callback error:', err);
    res.status(500).send(`<h2>❌ Token exchange failed</h2><pre>${err.message}</pre><p><a href="/auth/etsy/start">Try again</a></p>`);
  }
});

// --- Etsy API Routes ---

// API: Get Etsy shop info
app.get('/api/etsy/shop', async (req, res) => {
  try {
    const shopId = process.env.ETSY_SHOP_ID;
    if (!shopId) return res.json({ success: false, error: 'ETSY_SHOP_ID not set in .env' });
    if (!process.env.ETSY_API_KEY) return res.json({ success: false, error: 'ETSY_API_KEY not set in .env' });
    const { getShopInfo } = await import('../etsy/etsyClient.js');
    const shop = await getShopInfo(shopId);
    res.json({ success: true, shop });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Get active Etsy listings
app.get('/api/etsy/listings', async (req, res) => {
  try {
    const shopId = process.env.ETSY_SHOP_ID;
    if (!shopId) return res.json({ success: false, error: 'ETSY_SHOP_ID not set in .env' });
    if (!process.env.ETSY_API_KEY) return res.json({ success: false, error: 'ETSY_API_KEY not set in .env' });
    const limit = parseInt(req.query.limit) || 10;
    const { getActiveListings } = await import('../etsy/etsyClient.js');
    const data = await getActiveListings(shopId, limit);
    res.json({ success: true, count: data.count, listings: data.results });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Upload a generated image as a draft Etsy listing
app.post('/api/etsy/upload', async (req, res) => {
  try {
    const { imageId, imagePath: relPath, title, theme, style, colorScheme, designElements, mood } = req.body;
    if (!process.env.ETSY_ACCESS_TOKEN) {
      return res.json({ success: false, error: 'Etsy not authorized. Add ETSY_ACCESS_TOKEN to .env first.' });
    }
    if (!process.env.ETSY_SHOP_ID) {
      return res.json({ success: false, error: 'ETSY_SHOP_ID not set in .env' });
    }

    // Resolve absolute path from relative `/generated_images/...`
    const absoluteImagePath = relPath
      ? path.join(rootDir, relPath.replace(/^\//, ''))
      : null;

    const idea = { title, theme, style, colorScheme, designElements, mood };

    const { createDraftListing } = await import('../etsy/etsyUploader.js');
    const result = await createDraftListing(idea, absoluteImagePath);

    res.json(result);
  } catch (error) {
    console.error('Etsy upload error:', error);
    res.json({ success: false, error: error.message });
  }
});

// --- Async Job Queue System ---
const jobs = new Map();

function generateJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Background Worker Function
async function runBackgroundWorkflow(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Helper to update job status
    const updateJob = (step, msg, type = 'info') => {
      job.currentStep = step;
      job.logs.push({
        timestamp: new Date().toISOString(),
        message: msg,
        type: type,
        step: step
      });
      job.updatedAt = Date.now();
    };

    // Step 1: Trend Search
    updateJob(1, '🔍 Searching for latest Design Trends...');

    try {
      const { scrapeDesignTrends } = await import('../scraper/googleScraper.js');
      await scrapeDesignTrends();
      updateJob(1, '✅ Trend Search completed', 'success');
    } catch (e) {
      console.log(`Scraper module error: ${e.message}`);
      updateJob(1, '⚠️ Trend API issue - Using fallback trends', 'warning');
      updateJob(1, '✅ Trend Search completed (Fallback)', 'success');
    }

    // Step 2: Analyzer
    updateJob(2, '🧠 Analyzing trends to generate ideas...');

    try {
      const { analyzeAndGenerateIdeas } = await import('../analyzer/imageAnalyzer.js');
      await analyzeAndGenerateIdeas();
      updateJob(2, '✅ Ideas generated', 'success');
    } catch (e) {
      throw new Error(`Analysis failed: ${e.message}`);
    }

    // Step 3: Generator
    updateJob(3, '🎨 Generating AI Images...');

    try {
      const { generateImages } = await import('../generator/imageGenerator.js');
      await generateImages();
      updateJob(3, '✅ Image generation completed', 'success');
    } catch (e) {
      throw new Error(`Generation failed: ${e.message}`);
    }

    // Step 4: Auto-upload to Etsy (if configured)
    if (process.env.ETSY_ACCESS_TOKEN && process.env.ETSY_SHOP_ID) {
      updateJob(4, '🛍️ Uploading designs to Etsy as draft listings...');
      try {
        const ideasPath = path.join(rootDir, 'data', 'ideas.json');
        const historyPath = path.join(rootDir, 'data', 'history.json');
        const { createDraftListing } = await import('../etsy/etsyUploader.js');

        let ideas = [];
        if (fs.existsSync(ideasPath)) {
          ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
        }
        let images = [];
        if (fs.existsSync(historyPath)) {
          const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
          // Only upload images from this run (marked as new via manifest)
          const manifestPath = path.join(rootDir, 'data', 'manifest.json');
          let newIds = new Set();
          if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            (manifest.images || []).forEach(img => newIds.add(img.id));
          }
          images = history.filter(img => newIds.size === 0 || newIds.has(img.id));
        }

        let uploaded = 0;
        // ✅ Parallel upload using Promise.allSettled for speed
        const uploadTasks = images.map(async (img, i) => {
          const idea = ideas[i] || { title: img.title || `Design ${i + 1}` };
          const absoluteImagePath = path.join(rootDir, img.imagePath ? img.imagePath.replace(/^\//, '').split('?')[0] : `generated_images/design_${String(i + 1).padStart(2, '0')}.png`);
          await createDraftListing(idea, absoluteImagePath);
        });
        const results = await Promise.allSettled(uploadTasks);
        uploaded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');
        failed.forEach((r, i) => console.error(`Etsy upload failed for image ${i + 1}: ${r.reason?.message}`));
        updateJob(4, `✅ Uploaded ${uploaded} draft listing(s) to Etsy`, 'success');
      } catch (e) {
        updateJob(4, `⚠️ Etsy upload skipped: ${e.message}`, 'warning');
      }
    } else {
      updateJob(4, '⏭️ Etsy upload skipped (ETSY_ACCESS_TOKEN not set)', 'info');
    }

    // Complete
    job.status = 'completed';
    job.progress = 100;
    updateJob(4, '🎉 Workflow Completed!', 'success');

  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.logs.push({
      timestamp: new Date().toISOString(),
      message: `❌ Error: ${error.message}`,
      type: 'error'
    });
  }
}

// API: Start Job
app.post('/api/jobs/start', (req, res) => {
  const jobId = generateJobId();

  // Initialize Job
  jobs.set(jobId, {
    id: jobId,
    status: 'running',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentStep: 0,
    progress: 0,
    logs: [],
    error: null
  });

  // Start processing in background (FIRE AND FORGET)
  runBackgroundWorkflow(jobId);

  // Cleanup: keep only the 20 most recent jobs to avoid memory leak
  if (jobs.size > 20) {
    const oldestKey = jobs.keys().next().value;
    jobs.delete(oldestKey);
  }

  res.json({ success: true, jobId, message: 'Workflow started in background' });
});

// API: Get Job Status
app.get('/api/jobs/:id', (req, res) => {
  const jobId = req.params.id;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  res.json({ success: true, job });
});

// Start server
export function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running at http://localhost:${PORT}`);
      console.log(`   🏠 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`   📷 Scraped: http://localhost:${PORT}/scraped`);
      console.log(`   📧 Confirm: http://localhost:${PORT}/confirm`);
      console.log(`   🖼️  Gallery: http://localhost:${PORT}/gallery`);
      resolve(server);
    });
  });
}

// Run directly if executed as main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export default app;
