const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 5175);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.resolve(root, `.${relative}`);
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (statError, stat) => {
    const candidate = !statError && stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    fs.readFile(candidate, (error, data) => {
      if (error) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(candidate).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
}).listen(port, '::', () => {
  console.log(`Kiran K. Shinde & Co. running at http://localhost:${port}`);
});
