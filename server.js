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

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
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
