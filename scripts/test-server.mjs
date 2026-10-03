import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Serve the production assets at both the Pages prefix and the test entry path.
const root = path.resolve('dist'); const prefix = '/brainsweatstudios/';
createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  const relative = decodeURIComponent(url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname.slice(1)) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}/`)) { response.writeHead(404); response.end(); return; }
  try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); response.end(bytes); }
  catch { response.writeHead(404); response.end('Unknown file'); }
}).listen(5173, '127.0.0.1', () => console.log('Production test server ready on 127.0.0.1:5173'));
