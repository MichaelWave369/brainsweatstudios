import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173/';
await mkdir('docs/screenshots/v6', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
  await page.addInitScript(() => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify({ version: 2, difficulty: 'builder', records: {}, daily: {}, checkpoints: {}, classes: {}, settings: { music: 0, effects: 0, muted: true, reducedMotion: true, highContrast: false, tutorials: false, locale: 'en', haptics: false, botControl: false, labPalette: 'green' }, selectedDifficulty: true })); });
  await page.goto(base); await page.locator('.world-card').last().waitFor(); await page.screenshot({ path: 'docs/screenshots/v6/studio.png' });
  for (const [name, route] of [['experiments', '/academy?tab=lab'], ['controllers', '/academy?arena=outpost'], ['rover', '/academy?tab=rover'], ['sports', '/game/sports'], ['space', '/lab/space'], ['agent-class', '/class/agent-rewards']]) {
    await page.goto(base + '#' + route); await page.locator('main h1').waitFor();
    if (name === 'experiments') {
      await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
      await page.getByRole('heading', { name: 'Experiment results', exact: true }).waitFor();
      await page.getByLabel('Trace inspection tick', { exact: true }).fill('7');
      await page.getByText('Changed state and hash', { exact: true }).click();
    } else if (name === 'controllers') {
      await page.getByRole('button', { name: 'Train controller', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.controllers.outpost.history.length === 6);
      await page.getByRole('button', { name: 'Evaluate champion', exact: true }).click();
      await page.getByLabel('Controller replay tick', { exact: true }).fill('7');
    } else if (name === 'rover') {
      await page.getByRole('button', { name: 'Train 1,000 episodes', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.rover.episodes === 1000);
      await page.getByRole('button', { name: 'Evaluate learned rover', exact: true }).click();
      await page.getByLabel('Rover replay tick', { exact: true }).fill('7');
    } else if (name === 'sports' || name === 'space') {
      await page.locator('.game-controls').waitFor();
      await page.getByRole('button', { name: 'Load a worked controller', exact: true }).click();
      await page.getByRole('button', { name: 'Run full episode', exact: true }).click();
    }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `docs/screenshots/v6/${name}.png`, fullPage: ['experiments', 'controllers', 'rover'].includes(name) });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '#/academy?tab=lab');
  await page.getByRole('button', { name: 'Next tick', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/screenshots/v6/mobile-experiment.png' });
  await page.getByLabel('Language', { exact: true }).selectOption('es');
  await page.locator('.runtime-inspector').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'docs/screenshots/v6/spanish-inspector.png' });
  await context.close(); console.log('Version 6 screenshots captured from the running production app.');
} finally { await browser.close(); }
