import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createOnlineHandler } from '../src/online/server.ts';
import { MemoryOnlineStore } from '../src/online/store.ts';
const testOnline = process.env.ONLINE_TEST_SERVER === '1' ? createOnlineHandler(new MemoryOnlineStore(), { origins: ['http://127.0.0.1:5173'], pepper: 'local-browser-test-only' }) : null;

// Serve the production assets at both the Pages prefix and the test entry path.
const root = path.resolve('dist'); const prefix = '/brainsweatstudios/';
createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (testOnline && url.pathname === '/__online-test') {
    const chunks=[];let bytes=0;
    for await (const chunk of request) { bytes+=chunk.length;if(bytes>16000){response.writeHead(413);response.end();return;}chunks.push(chunk); }
    const result=await testOnline(new Request(url,{method:request.method,headers:request.headers,body:request.method==='POST'?Buffer.concat(chunks):undefined}));
    response.writeHead(result.status,Object.fromEntries(result.headers));response.end(await result.text());return;
  }
  const relative = decodeURIComponent(url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname.slice(1)) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}/`)) { response.writeHead(404); response.end(); return; }
  try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); response.end(bytes); }
  catch { response.writeHead(404); response.end('Unknown file'); }
}).listen(5173, '127.0.0.1', () => console.log('Production test server ready on 127.0.0.1:5173'));
