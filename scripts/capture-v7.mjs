import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173/';
await mkdir('docs/screenshots/v7', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
  await page.addInitScript(() => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify({ version: 2, difficulty: 'builder', records: {}, daily: {}, checkpoints: {}, classes: {}, settings: { music: 0, effects: 0, muted: true, reducedMotion: true, highContrast: false, tutorials: false, locale: 'en', haptics: false, botControl: false, labPalette: 'green' }, selectedDifficulty: true })); });
  await page.goto(base); await page.locator('.world-card').last().waitFor(); await page.screenshot({ path: 'docs/screenshots/v7/studio.png' });
  await page.goto(base + '#/academy?tab=garage'); await page.getByRole('button', { name: 'Start garage world', exact: true }).click();
  for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: 'Step controller', exact: true }).click(); await page.waitForFunction(n => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.garage.receipt.result.ticks === n, i + 1); }
  await page.screenshot({ path: 'docs/screenshots/v7/survey.png', fullPage: true });
  await page.getByLabel('Garage environment', { exact: true }).selectOption('community'); await page.getByRole('button', { name: 'Start garage world', exact: true }).click(); await page.getByRole('button', { name: 'Run garage episode', exact: true }).click(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.garage.receipt.result.success); await page.screenshot({ path: 'docs/screenshots/v7/community.png', fullPage: true });
  await page.getByLabel('Garage environment', { exact: true }).selectOption('signal-maze'); await page.getByLabel('Mock behavior', { exact: true }).selectOption('alternating'); await page.getByRole('button', { name: 'Start garage world', exact: true }).click(); await page.getByRole('button', { name: 'Run garage episode', exact: true }).click(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')).academy.garage.receipt.result.success); await page.getByText('Recorded proposal, validation and world result', { exact: true }).click(); await page.screenshot({ path: 'docs/screenshots/v7/recovery.png', fullPage: true });
  await page.getByLabel('Mock behavior', { exact: true }).selectOption('policy'); await page.getByRole('button', { name: 'Compare frozen controllers', exact: true }).click(); await page.getByRole('heading', { name: 'Frozen model comparison', exact: true }).waitFor(); await page.screenshot({ path: 'docs/screenshots/v7/comparison.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0,0)); await page.screenshot({ path: 'docs/screenshots/v7/mobile-garage.png' });
  await page.getByLabel('Language', { exact: true }).selectOption('es'); await page.locator('.garage-live').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'docs/screenshots/v7/spanish-garage.png' });
  await context.close(); console.log('V7 review captures from the actual production build; no real-model qualification claimed.');
} finally { await browser.close(); }
