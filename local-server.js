const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 5175);
const storageRoot = path.join(root, 'storage', 'clients');
fs.mkdirSync(storageRoot, { recursive: true });
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function safePart(value, fallback = '') {
  const part = String(value || '').trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/.test(part) ? part : fallback;
}

function handleLocalStorage(req, res, requestPath, query) {
  const remoteAddress = req.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)) {
    sendJson(res, 403, { error: 'Local file test is available only on this computer' });
    return true;
  }
  if (requestPath === '/api/local-storage/upload' && req.method === 'POST') {
    let body = ''; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size <= 25 * 1024 * 1024) body += chunk; });
    req.on('end', () => {
      if (size > 25 * 1024 * 1024) return sendJson(res, 413, { error: 'File too large (25 MB max for local test)' });
      try {
        const input = JSON.parse(body);
        const clientId = safePart(input.clientId);
        const folder = ['received', 'working', 'ca-review', 'final'].includes(input.folder) ? input.folder : '';
        const fileName = path.basename(String(input.fileName || '')).replace(/[^a-zA-Z0-9._ -]/g, '_');
        if (!clientId || !folder || !fileName || !input.dataBase64) return sendJson(res, 400, { error: 'clientId, folder, fileName and dataBase64 are required' });
        const targetDir = path.join(storageRoot, clientId, folder); fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, fileName), Buffer.from(input.dataBase64, 'base64'));
        return sendJson(res, 201, { ok: true, clientId, folder, fileName });
      } catch (error) { return sendJson(res, 400, { error: 'Invalid upload payload' }); }
    });
    return true;
  }
  if (requestPath === '/api/local-storage/list' && req.method === 'GET') {
    const clientId = safePart(query.get('clientId')); if (!clientId) return sendJson(res, 400, { error: 'clientId required' });
    const clientDir = path.join(storageRoot, clientId); const files = [];
    for (const folder of ['received', 'working', 'ca-review', 'final']) { const dir = path.join(clientDir, folder); if (!fs.existsSync(dir)) continue; for (const file of fs.readdirSync(dir)) files.push({ folder, fileName: file }); }
    return sendJson(res, 200, { clientId, files });
  }
  if (requestPath === '/api/local-storage/download' && req.method === 'GET') {
    const clientId = safePart(query.get('clientId')); const folder = ['received', 'working', 'ca-review', 'final'].includes(query.get('folder')) ? query.get('folder') : ''; const fileName = path.basename(query.get('file') || '');
    if (!clientId || !folder || !fileName) return sendJson(res, 400, { error: 'clientId, folder and file required' });
    const filePath = path.join(storageRoot, clientId, folder, fileName); if (!filePath.startsWith(storageRoot + path.sep) || !fs.existsSync(filePath)) { res.writeHead(404); return res.end('File not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"` }); fs.createReadStream(filePath).pipe(res); return true;
  }
  return false;
}

http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const query = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).searchParams;
  if (handleLocalStorage(req, res, requestPath, query)) return;
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
