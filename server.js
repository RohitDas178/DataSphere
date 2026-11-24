const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8080;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const safeHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(reqPath);
  } catch (_) {
    res.writeHead(400, { ...safeHeaders, 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  const relativePath = decodedPath.replace(/^[/\\]+/, '');
  const filePath = path.resolve(__dirname, relativePath);
  if (filePath !== __dirname && !filePath.startsWith(`${__dirname}${path.sep}`)) {
    res.writeHead(403, { ...safeHeaders, 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }


  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { ...safeHeaders, 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { ...safeHeaders, 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { ...safeHeaders, 'Content-Type': contentType });
      res.end(content);
    }
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}/index.html`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = server.address() ? server.address().port + 1 : DEFAULT_PORT + 1;
    console.log(`Port ${DEFAULT_PORT} is already in use. Automatically switching to http://localhost:${nextPort}/index.html...`);
    setTimeout(() => {
      startServer(nextPort);
    }, 200);
  } else {
    console.error('Server error:', err);
  }
});

startServer(DEFAULT_PORT);
