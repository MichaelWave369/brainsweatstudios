import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
const server = process.env.TEST_BASE_URL ? undefined : await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
if (server) await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir('docs/screenshots', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
for (const [name, route] of [['studio', '/'], ['money', '/game/money'], ['scam', '/game/scam'], ['code', '/game/code'], ['power', '/game/power'], ['skills', '/skills'], ['assistant', '/assistant'], ['music', '/game/music'], ['frequency', '/game/frequency'], ['botany', '/game/botany']]) {
  await page.goto(`${base}#${route}`); if (!route.startsWith('/game')) await page.getByRole('heading', { name: route === '/assistant' ? 'Your personal assistant' : route === '/skills' ? 'See your skills connect.' : 'Your next great idea starts here.', exact: true }).waitFor({ state: 'visible' }); if (route.startsWith('/game')) { await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/, exact: true }).click(); await page.locator('.game-controls').waitFor({state:'visible'}); await page.locator('canvas[data-renderer=webgl2]').waitFor({state:'visible'}); }
  await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: false });
}
await page.goto(`${base}#/assistant`); await page.getByLabel('Language', { exact: true }).selectOption('es'); await page.getByRole('heading', { name: 'Tu asistente personal', exact: true }).waitFor(); await page.screenshot({ path: 'docs/screenshots/spanish.png', fullPage: false }); await page.getByLabel('Idioma', { exact: true }).selectOption('en');
await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${base}#/`); await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: false });
await browser.close(); if (server) await server.close(); console.log('Twelve screenshots captured.');
