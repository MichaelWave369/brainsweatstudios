import { readCatalogue } from './studio-catalogue.mjs';
const studio = await readCatalogue();
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
  await page.goto(base); await page.locator('.world-card').last().waitFor({ state: 'visible' }); assert.equal(await page.locator('.world-card').count(), studio.worlds);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.reload(); await page.locator('.world-card').last().waitFor({ state: 'visible' }); assert.equal(await page.locator('.world-card').count(), studio.worlds);
  for (const world of ['money', 'hustle', 'scam', 'media', 'fix', 'code', 'career', 'food', 'admin', 'talk', 'power', 'rescue', 'music', 'frequency', 'botany','math','geometry','calculus','physics','engine','robot','vm','trail','water','kitchen','creator','driving','cdl','trade','lines','electric','fire','swim','sports','outpost','scenario','space']) {
    await page.goto(`${base}#/game/${world}`); await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/, exact: true }).click(); await page.locator('.game-controls').waitFor({ state: 'visible' }); assert.equal(await page.locator('canvas[data-renderer=webgl2]').count(), 1);
  }
  await page.goto(`${base}#/classes`); await page.locator('.class-card').last().waitFor(); assert.equal(await page.locator('.class-card').count(),studio.classes);
  await page.goto(`${base}#/academy?tab=rover`); await page.getByRole('button',{name:'Train 1,000 episodes',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.rover.episodes===1000);
  await page.getByRole('button',{name:'Evaluate learned rover',exact:true}).click();
  assert.ok(Number((await page.locator('.game-stat').filter({has:page.getByText('Successful deliveries',{exact:true})}).locator('strong').innerText()).split('/')[0])>=18);
  await page.reload(); assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')))).academy.rover.episodes,1000);
  await page.goto(`${base}#/academy?tab=lab`);
  await page.getByRole('button',{name:'Run experiment',exact:true}).click();
  await page.getByRole('heading',{name:'Experiment results',exact:true}).waitFor();
  await page.getByRole('button',{name:'Verify replay',exact:true}).click();
  await page.getByText('Replay verified. Every transition and result matches.',{exact:true}).waitFor();
  const lab=await page.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.lab);
  await page.reload(); assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.lab),lab);
  await page.getByRole('heading',{name:'Verified trace inspector',exact:true}).waitFor();
  await page.goto(`${base}#/class/derivatives`); await page.getByLabel('Point x',{exact:true}).fill('5');
  await page.goto(`${base}#/lab/engine`); await page.getByRole('button',{name:/Start mission 1|Resume checkpoint/}).click(); await page.locator('.crt-screen .game-controls').waitFor();
  await page.goto(`${base}#/assistant`); await page.getByRole('heading', { name: 'Your personal assistant', exact: true }).waitFor();
  await page.goto(`${base}#/bots`); await page.getByRole('heading', { name: 'Bot lab', exact: true }).waitFor();
  await page.getByLabel('Language', { exact: true }).selectOption('es'); await page.getByRole('heading', { name: 'Laboratorio de bots', exact: true }).waitFor(); await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'es'); await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  await page.goto(`${base}#/game/money`); await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/ }).click(); await page.getByRole('button', { name: 'Start the month' }).click(); for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Find another way/ }).click(); await page.getByText('EXPERIMENT COMPLETE', { exact: true }).waitFor({ state: 'visible' });
  await page.reload(); await page.getByRole('link', { name: 'My progress', exact: true }).click(); await page.getByText(`1/${studio.slots}`, { exact: true }).waitFor({ state: 'visible' }); assert.deepEqual(errors, []);
  console.log('Production check passed: Pages prefix, all offline game routes and classes, offline academy learning/evaluation/restoration, refresh saving, and no page errors.');
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
