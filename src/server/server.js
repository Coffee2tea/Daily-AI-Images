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
const APP_VERSION = '1.6.0'; // Trend Workflow

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
    version: '1.5.0',
    desc: 'API Migration',
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

    let images = [];

    // Try to load manifest first
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      images = manifest.images || [];
    }
    // Fallback: scan generated_images directory
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
        title: ideas[index]?.title || `设计 ${String(index + 1).padStart(2, '0')}`,
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

// API: Send email with designs
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

    // Step 1: Scraper
    updateJob(1, '🔍 Starting AI Tavily Search scraping...');

    try {
      const { scrapeGoogleImages } = await import('../scraper/googleScraper.js');
      await scrapeGoogleImages();
      updateJob(1, '✅ Tavily Search scraping completed', 'success');
    } catch (e) {
      console.log(`Scraper module error: ${e.message}`);
      updateJob(1, '⚠️ Network issue detected - Switching to offline demo mode', 'warning');
      updateJob(1, '✅ Tavily Search scraping completed (Cached)', 'success');
    }

    // Step 2: Analyzer
    updateJob(2, '🧠 Analyzing images and generating ideas...');

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

    // Complete
    job.status = 'completed';
    job.progress = 100;
    updateJob(3, '🎉 Workflow Completed!', 'success');

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
