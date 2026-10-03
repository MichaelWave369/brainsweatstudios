import { readCatalogue } from './studio-catalogue.mjs';
const studio = await readCatalogue();
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.LIVE_SITE_URL || 'https://larrinamsalva.github.io/brainsweatstudios/';
await mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { timeout: 30000 }); await page.locator('.world-card').last().waitFor(); assert.equal(await page.locator('.world-card').count(), studio.worlds);
  await page.getByText(`NEW IN VERSION ${studio.major}`, { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Assistant & council', exact: true }).click(); await page.getByRole('heading', { name: 'Your personal assistant', exact: true }).waitFor();
  for (const role of ['Mentor', 'Benefactor', 'Strategist']) await page.getByRole('heading', { name: role, exact: true }).waitFor();
  await page.getByLabel('Ask your assistant', { exact: true }).fill('Help me plan a garden'); await page.getByRole('button', { name: 'Send to assistant', exact: true }).click(); await page.getByRole('link', { name: 'Botany Garden · Mission 1', exact: false }).waitFor();
  for (const world of ['music', 'frequency', 'botany','calculus','engine','robot','vm','trail','water','kitchen','creator','driving','cdl','trade','lines','electric','fire','swim','sports','outpost','scenario','space']) { await page.goto(`${base}#/game/${world}`); await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/ }).click(); await page.locator('.game-controls').waitFor(); }
  await page.goto(`${base}#/game/music`); await page.getByRole('button', { name: 'Resume checkpoint', exact: true }).click(); await page.getByRole('button', { name: 'Load a starting pattern', exact: true }).click(); await page.getByRole('button', { name: 'Perform my phrase', exact: true }).click(); await page.getByLabel('Pitch step 16', { exact: true }).selectOption('2'); await page.reload(); await page.getByRole('button', { name: 'Resume checkpoint', exact: true }).click(); assert.equal(await page.getByLabel('Pitch step 16', { exact: true }).inputValue(), '2'); await page.getByRole('button', { name: 'Perform my phrase', exact: true }).click(); await page.getByRole('button', { name: 'Save my composition', exact: true }).click(); await page.getByText('EXPERIMENT COMPLETE', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Bot lab', exact: true }).click(); await page.getByLabel('Bot world', { exact: true }).selectOption('frequency'); await page.getByLabel('Bot mission', { exact: true }).selectOption('1'); await page.getByRole('button', { name: 'Start bot practice', exact: true }).click(); await page.getByLabel('Bot speed', { exact: true }).selectOption('120'); await page.getByText('Bot practice complete', { exact: true }).waitFor();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1'))); assert.equal(save.version, 2); assert.equal(save.records['music/explorer/0'].score, 100); assert.equal(save.records['frequency/explorer/1'], undefined); assert.equal(save.xp, 100);
  await page.getByLabel('Language', { exact: true }).selectOption('es'); await page.getByRole('heading', { name: 'Laboratorio de Frecuencias', exact: true }).waitFor(); await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'es'); await page.getByLabel('Idioma', { exact: true }).selectOption('en'); await page.getByRole('link', { name: 'Play', exact: true }).click(); await page.locator('.world-card').last().waitFor();
  await page.goto(`${base}#/classes`); await page.locator('.class-card').last().waitFor(); assert.equal(await page.locator('.class-card').count(),studio.classes);
  await page.goto(`${base}#/academy`); await page.getByRole('button',{name:'Train controller',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.controllers.sports.history.length===6);
  await page.getByRole('button',{name:'Evaluate champion',exact:true}).click();
  assert.equal(await page.locator('.game-stat').filter({has:page.getByText('Evaluation success',{exact:true})}).locator('strong').innerText(),'8/8');
  await page.goto(`${base}#/academy?tab=rover`); await page.getByRole('button',{name:'Train 1,000 episodes',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.rover.episodes===1000);
  await page.getByRole('button',{name:'Evaluate learned rover',exact:true}).click();
  assert.ok(Number((await page.locator('.game-stat').filter({has:page.getByText('Successful deliveries',{exact:true})}).locator('strong').innerText()).split('/')[0])>=18);
  await page.reload(); assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')))).academy.rover.episodes,1000);
  await page.goto(`${base}#/academy?tab=lab`); await page.getByRole('button',{name:'Run experiment',exact:true}).click();
  await page.getByRole('heading',{name:'Experiment results',exact:true}).waitFor(); await page.getByRole('button',{name:'Verify replay',exact:true}).click();
  await page.getByText('Replay verified. Every transition and result matches.',{exact:true}).waitFor(); await page.reload(); await page.getByRole('heading',{name:'Verified trace inspector',exact:true}).waitFor();
  await page.goto(`${base}#/class/derivatives`); await page.getByLabel('Point x',{exact:true}).fill('6'); await page.reload(); assert.equal(await page.getByLabel('Point x',{exact:true}).inputValue(),'6');
  await page.goto(`${base}#/lab/engine`); await page.getByRole('button',{name:'Resume checkpoint',exact:true}).click(); await page.locator('.crt-screen .game-controls').waitFor();
  await page.goto(base); await page.locator('.world-card').last().waitFor();
  await page.screenshot({ path: `docs/screenshots/live-v${studio.major}.png` }); assert.deepEqual(errors, []);
  console.log('Live v6 verified: 37 worlds, 48 classes, controller optimization, learned rover, frozen evaluation, academy refresh, council, retro lab, player rewards, bot isolation, Spanish refresh, and zero page errors.'); await context.close();
} finally { await browser.close(); }
