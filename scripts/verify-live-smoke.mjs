import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { readCatalogue } from './studio-catalogue.mjs';

const studio = await readCatalogue();
const base = process.env.LIVE_SITE_URL || 'https://michaelwave369.github.io/brainsweatstudios/';

await mkdir('docs/screenshots', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.world-card').last().waitFor({ timeout: 30000 });

  assert.equal(await page.locator('.world-card').count(), studio.worlds);
  await page.getByText(`NEW IN VERSION ${studio.major}`, { exact: true }).waitFor();
  await page.getByText('FORK-THIRTY EXPERIMENTAL LINE', { exact: true }).waitFor();

  const openSource = page.getByRole('link', { name: 'Open source · MIT', exact: true });
  assert.equal(await openSource.getAttribute('href'), 'https://github.com/MichaelWave369/brainsweatstudios');

  assert.equal(
    await page.locator('meta[property="og:url"]').getAttribute('content'),
    'https://michaelwave369.github.io/brainsweatstudios/',
  );

  await page.goto(`${base}#/academy?tab=circuit`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Circuit Paddock', exact: true }).waitFor({ timeout: 30000 });

  await page.goto(`${base}#/academy?tab=locker`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Agent Locker', exact: true }).waitFor({ timeout: 30000 });

  assert.deepEqual(errors, []);
  await page.screenshot({ path: `docs/screenshots/live-smoke-v${studio.major}.png`, fullPage: true });

  console.log(
    `Live smoke passed: v${studio.major}, ${studio.worlds} worlds, Fork-Thirty marker, repo metadata, Circuit and Locker routes.`,
  );
} finally {
  await browser.close();
}
