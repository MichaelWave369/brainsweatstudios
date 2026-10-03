import { readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = ['index.html', 'favicon.svg', ...(await readdir('dist/assets')).map(name => `assets/${name}`)];
const hash = createHash('sha256'); for (const file of files) hash.update(await readFile(`dist/${file}`));
const cacheName = `brain-sweat-${hash.digest('hex').slice(0, 12)}`;
const source = `/* Original Brain Sweat Studio offline worker. MIT licensed. */
const CACHE = ${JSON.stringify(cacheName)};
const FILES = ${JSON.stringify(files.map(file => `./${file}`))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const old = (await caches.keys()).filter(key => key.startsWith('brain-sweat-') && key !== CACHE);
  // Keep one previous build's lazy assets usable in tabs awaiting a refresh.
  await Promise.all(old.slice(0, -1).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'STUDIO_CHECK_VERSION' || typeof event.data.script !== 'string') return;
  event.source?.postMessage({ type: 'STUDIO_UPDATE_STATUS', current: FILES.some(file => new URL(file, self.location.href).href === event.data.script) });
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(event.request, { cache: 'no-store', signal: controller.signal });
        if (response.ok) { try { await cache.put('./index.html', response.clone()); } catch { /* Full storage must not block online play. */ } return response; }
        return await cache.match('./index.html') || response;
      } catch { return await cache.match('./index.html') || Response.error(); }
      finally { clearTimeout(timer); }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request); if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) { try { const cache = await caches.open(CACHE); await cache.put(event.request, response.clone()); } catch { /* Keep the network response if storage is full. */ } }
    return response;
  })());
});
`;
await writeFile('dist/sw.js', source);
await copyFile('dist/index.html', 'dist/404.html');
console.log(`Offline shell and ${files.length} static assets prepared.`);
