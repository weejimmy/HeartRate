const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

// Check if preprocessed data exists; if not, run preprocessor
if (!fs.existsSync(path.join(DATA_DIR, 'summary.json'))) {
  console.log('Preprocessed data not found. Running preprocessor...');
  try {
    execSync('node scripts/preprocess.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('Error running preprocessor:', err);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // Normalize path
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  // API shortcuts
  if (reqPath.startsWith('/api/summary')) {
    reqPath = '/data/summary.json';
  } else if (reqPath.startsWith('/api/day/')) {
    const date = reqPath.replace('/api/day/', '').replace(/[^0-9\-]/g, '');
    reqPath = `/data/days/${date}.json`;
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Cache control
    const isData = reqPath.startsWith('/data/');
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': isData ? 'public, max-age=3600' : 'no-cache',
      'Access-Control-Allow-Origin': '*'
    };

    // Compress JSON, HTML, CSS, JS if supported
    if (/\bgzip\b/.test(acceptEncoding) && /text|javascript|json/.test(contentType) && stats.size > 1024) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      const rawStream = fs.createReadStream(filePath);
      rawStream.pipe(zlib.createGzip()).pipe(res);
    } else {
      headers['Content-Length'] = stats.size;
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ❤️  Heart Rate Dashboard Server is running!`);
  console.log(`  🔗  URL: http://localhost:${PORT}`);
  console.log(`  📂  Serving: ${PUBLIC_DIR}`);
  console.log(`======================================================\n`);
});
