import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = path.resolve('dist'); const prefix = '/brainsweatstudios/';
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (!url.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Unknown path'); return; }
  const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html'; const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}/`)) { response.writeHead(404); response.end(); return; }
  try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); response.end(bytes); }
  catch { response.writeHead(404); response.end('Unknown file'); }
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext(); const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const base = `http://127.0.0.1:4173${prefix}`;
  await page.goto(base); await page.locator('.world-card').last().waitFor({ state: 'visible' }); assert.equal(await page.locator('.world-card').count(), 15);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.reload(); await page.locator('.world-card').last().waitFor({ state: 'visible' }); assert.equal(await page.locator('.world-card').count(), 15);
  for (const world of ['money', 'hustle', 'scam', 'media', 'fix', 'code', 'career', 'food', 'admin', 'talk', 'power', 'rescue', 'music', 'frequency', 'botany']) {
    await page.goto(`${base}#/game/${world}`); await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/, exact: true }).click(); await page.locator('.game-controls').waitFor({ state: 'visible' }); assert.equal(await page.locator('canvas[data-renderer=webgl2]').count(), 1);
  }
  await page.goto(`${base}#/assistant`); await page.getByRole('heading', { name: 'Your personal assistant', exact: true }).waitFor();
  await page.goto(`${base}#/bots`); await page.getByRole('heading', { name: 'Bot lab', exact: true }).waitFor();
  await page.getByLabel('Language', { exact: true }).selectOption('es'); await page.getByRole('heading', { name: 'Laboratorio de bots', exact: true }).waitFor(); await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'es'); await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  await page.goto(`${base}#/game/money`); await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/ }).click(); await page.getByRole('button', { name: 'Start the month' }).click(); for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Find another way/ }).click(); await page.getByText('EXPERIMENT COMPLETE', { exact: true }).waitFor({ state: 'visible' });
  await page.reload(); await page.getByRole('link', { name: 'My progress', exact: true }).click(); await page.getByText('1/360', { exact: true }).waitFor({ state: 'visible' }); assert.deepEqual(errors, []);
  console.log('Production check passed: Pages prefix, all 15 lazy game routes, offline reload, offline gameplay, refresh saving, and no page errors.');
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
