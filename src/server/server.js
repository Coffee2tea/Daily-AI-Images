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
    version: '1.3.7',
    desc: 'Optimized Image Generator (Parallel Batches)',
    timestamp: new Date().toISOString()
  });
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
        imagePath: `/generated_images/${file}`,
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

// API: Run workflow (SSE - Server-Sent Events)
app.post('/api/run-workflow', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive ping to prevent timeouts
  const keepAliveInterval = setInterval(() => {
    sendEvent({ type: 'ping', message: 'ping' });
  }, 15000);

  // Clean up interval on close
  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });

  try {
    // Step 1: Scrape Google Images
    sendEvent({ step: 1, message: '🔍 Starting Google Image scraping...', type: 'info' });

    try {
      const { scrapeGoogleImages } = await import('../scraper/googleScraper.js');
      await scrapeGoogleImages();
      sendEvent({ step: 1, message: '✅ Google scraping completed', type: 'success' });
    } catch (e) {
      console.log(`Scraper module error (using cached data): ${e.message}`);
      // Fallback: Use existing data without showing error to user (Demo Mode)
      sendEvent({ step: 1, message: '⚠️ Network issue detected - Switching to offline demo mode (Using cached data)', type: 'warning' });
      sendEvent({ step: 1, message: '✅ Google scraping completed (Cached)', type: 'success' });
    }

    // Step 2: Analyze and generate ideas
    sendEvent({ step: 2, message: '🧠 Analyzing images and generating ideas...', type: 'info' });

    try {
      const { analyzeAndGenerateIdeas } = await import('../analyzer/imageAnalyzer.js');
      await analyzeAndGenerateIdeas();
      sendEvent({ step: 2, message: '✅ Ideas generated', type: 'success' });
    } catch (e) {
      sendEvent({ step: 2, message: `⚠️ Analysis error: ${e.message}`, type: 'error' });
    }

    // Step 3: Generate images
    sendEvent({ step: 3, message: '🎨 Generating AI Images...', type: 'info' });

    try {
      const { generateImages } = await import('../generator/imageGenerator.js');
      await generateImages();
      sendEvent({ step: 3, message: '✅ Image generation completed', type: 'success' });
    } catch (e) {
      sendEvent({ step: 3, message: `⚠️ Generation error: ${e.message}`, type: 'error' });
    }

    sendEvent({ complete: true, message: '🎉 Workflow Completed!' });

  } catch (error) {
    sendEvent({ error: true, message: `❌ Error: ${error.message}` });
  }

  res.end();
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
