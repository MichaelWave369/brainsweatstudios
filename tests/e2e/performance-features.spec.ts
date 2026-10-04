import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { freshSave } from '../../src/systems/progress';
import { validateBundle } from '../../src/performance/specs';
import { validateCareer } from '../../src/career/validation';
import { productionOrigin } from './productionOrigin';

test.describe.configure({ mode: 'parallel' });
async function prepare(page: Page, locale: 'en' | 'es' = 'en', muted = true) {
  const save = freshSave(); save.selectedDifficulty = true; save.settings.tutorials = false; save.settings.muted = muted; save.settings.reducedMotion = true; save.settings.locale = locale;
  await page.addInitScript(value => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)); }, save);
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!).academy.career);
async function choir(page: Page) {
  await page.getByRole('button', { name: 'Create passport', exact: true }).click();
  await page.getByRole('button', { name: 'Enable circuit families', exact: true }).click();
  await page.getByLabel('Destination world', { exact: true }).selectOption('ensemble-lab');
  await page.getByRole('button', { name: 'Create original score', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click();
  await page.getByRole('button', { name: 'Run episode', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Execution status' })).toContainText('COMPLETE');
}
async function render(page: Page) {
  await page.getByRole('button', { name: 'Render local audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export WAV', exact: true })).toBeEnabled();
}
test('performance: original choir exports actual local WAV/MIDI, voice settings and replay bundle; review survives stopped reload', async ({ page, browserName }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const external: string[] = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url()); });
  await prepare(page); await page.goto('/#/academy?tab=locker'); await choir(page); await render(page);
  await expect(page.getByRole('button', { name: 'Play recorded performance', exact: true })).toBeDisabled();
  for (const [name, signature] of [['Export WAV', 'RIFF'], ['Export MIDI', 'MThd']] as const) {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
    const download = await pending, bytes = await readFile((await download.path())!); expect(bytes.subarray(0, 4).toString()).toBe(signature);
  }
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export performance bundle', exact: true }).click();
  const download = await pending, bytes = await readFile((await download.path())!); const bundle = validateBundle(JSON.parse(bytes.toString()));
  expect(bundle.voices).toHaveLength(4); expect(bundle.performance.config.schema).toBe('family-config@2');
  await page.getByLabel('Human listening review').fill('Clear vowel voices, gentle stereo spacing.'); await page.getByRole('button', { name: 'Save listening review', exact: true }).click();
  expect(validateCareer(await saved(page)).notes['studio-agent'].at(-1)?.text).toContain('Clear vowel voices');
  await page.reload(); await expect(page.getByRole('button', { name: 'Export WAV', exact: true })).toBeDisabled();
  await page.getByLabel('Import performance bundle', { exact: true }).setInputFiles({ name: 'performance.json', mimeType: 'application/json', buffer: bytes }); await render(page);
  expect(await page.evaluate(() => document.querySelector('audio')?.paused)).toBe(true); expect(errors).toEqual([]); expect(external).toEqual([]);
  if (browserName === 'chromium') await page.locator('.performance-panel').screenshot({ path: 'test-results/performance-review/choir.png' });
});
test('performance: failed bundle import is atomic; real playback stops on a hidden page and voice edits clear stale exports', async ({ page }) => {
  await prepare(page, 'en', false); await page.goto('/#/academy?tab=locker'); await choir(page); await render(page);
  const before = await saved(page);
  await page.getByLabel('Import performance bundle', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"performance-bundle@1","execute":"open-network"}') });
  await expect(page.locator('.performance-panel [role="status"]')).toContainText('Invalid'); expect(await saved(page)).toEqual(before); await expect(page.getByRole('button', { name: 'Export WAV', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Play recorded performance', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')?.paused)).toBe(false);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')?.paused)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByText('Synthetic voice profiles', { exact: true }).click(); await page.getByLabel('Brightness', { exact: true }).first().focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Export WAV', exact: true })).toBeDisabled();
});
test('performance: Spanish keyboard workshop and listening room fit 320/390 widths with accessible voice controls', async ({ page, browserName }) => {
  await prepare(page, 'es'); await page.goto('/#/academy?tab=locker');
  await page.getByRole('button', { name: 'Crear pasaporte', exact: true }).click(); await page.getByRole('button', { name: 'Activar familias del circuito', exact: true }).click();
  await page.getByLabel('Mundo de destino', { exact: true }).selectOption('ensemble-lab'); await page.getByLabel('Modo de interpretación').selectOption('call-response');
  await page.getByRole('button', { name: 'Crear partitura original', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Preparar traspaso', exact: true }).click(); await page.getByRole('button', { name: 'Ejecutar episodio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sala de escucha de interpretaciones', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Renderizar audio local', exact: true }).click(); await expect(page.getByRole('button', { name: 'Exportar WAV', exact: true })).toBeEnabled();
  await page.getByText('Perfiles de voz sintética', { exact: true }).click();
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); }
  expect((await new AxeBuilder({ page }).include('.performance-panel').include('.performance-composer').analyze()).violations).toEqual([]);
  if (browserName === 'chromium') await page.locator('.performance-panel').screenshot({ path: 'test-results/performance-review/spanish-phone.png' });
});
test('performance: worker, score and stopped recordings remain available after the real origin goes away', async ({ page }) => {
  await prepare(page); const origin = await productionOrigin();
  try {
    await page.goto(`${origin.url}#/academy?tab=locker`); await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await choir(page);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true); await origin.close();
    const response = await page.reload(); expect(response?.fromServiceWorker()).toBe(true); await render(page); validateCareer(await saved(page));
    await expect(page.getByRole('status').filter({ hasText: 'Execution status' })).toContainText('STOPPED');
  } finally { await origin.close(); }
});
