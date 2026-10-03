import { readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = ['index.html', 'favicon.svg', ...(await readdir('dist/assets')).map(name => `assets/${name}`)];
const hash = createHash('sha256'); for (const file of files) hash.update(await readFile(`dist/${file}`));
const cacheName = `brain-sweat-${hash.digest('hex').slice(0, 12)}`;
const source = `/* Original Brain Sweat Studio offline worker. MIT licensed. */
const CACHE = ${JSON.stringify(cacheName)};
const FILES = ${JSON.stringify(files.map(file => `./${file}`))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('brain-sweat-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request); if (cached) return cached;
    if (event.request.mode === 'navigate' && new URL(event.request.url).pathname.startsWith(new URL(self.registration.scope).pathname)) return cache.match('./index.html');
    return fetch(event.request);
  }));
});
`;
await writeFile('dist/sw.js', source);
await copyFile('dist/index.html', 'dist/404.html');
console.log(`Offline shell and ${files.length} static assets prepared.`);
