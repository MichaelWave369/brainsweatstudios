import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { packageRules } from '../../src/runtime/packages';
import { workedPolicy } from '../../src/runtime/arenaRules';
import { createExperiment, runExperiment } from '../../src/runtime/experiments';

test.describe.configure({ mode: 'parallel' });
async function prepare(page: Page, locale: 'en' | 'es' = 'en') {
  const save = freshSave(); save.selectedDifficulty = true; save.settings.tutorials = false; save.settings.reducedMotion = true; save.settings.muted = true; save.settings.locale = locale;
  await page.addInitScript(value => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)); }, save);
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!));
async function waitForExperimentSave(page: Page) {
  // Rendering results precedes Academy's passive save effect. Read the
  // persisted notebook only once that effect has committed the experiment.
  await expect.poll(async () => (await saved(page)).academy.lab.experiments.length, {
    message: 'The completed experiment must be persisted to the local profile',
  }).toBe(1);
}
const upload = (name: string, value: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
async function audit(page: Page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]); }

test('runtime: all five environments record, inspect, verify and restore data-only receipts', async ({ page }) => {
  await prepare(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/#/academy?tab=lab');
  for (const environment of ['sports', 'outpost', 'scenario', 'space', 'rover']) {
    await page.getByLabel('Experiment environment', { exact: true }).selectOption(environment);
    await page.getByRole('button', { name: 'Record one episode', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Verified trace inspector', exact: true })).toBeVisible();
    await expect.poll(async () => (await saved(page)).academy.lab.receipt?.config.environment).toBe(environment);
    await page.getByRole('button', { name: 'Next tick', exact: true }).click(); await expect(page.getByLabel('Trace inspection tick', { exact: true })).toHaveValue('1');
    await page.getByRole('button', { name: 'Previous tick', exact: true }).click(); await expect(page.getByLabel('Trace inspection tick', { exact: true })).toHaveValue('0');
    const before = JSON.stringify((await saved(page)).academy.lab.receipt);
    await page.getByRole('button', { name: 'Verify replay', exact: true }).click(); await expect(page.getByText('Replay verified. Every transition and result matches.', { exact: true })).toBeVisible();
    expect(JSON.stringify((await saved(page)).academy.lab.receipt)).toBe(before);
  }
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export episode receipt', exact: true }).click(); expect((await download).suggestedFilename()).toBe('brain-sweat-receipt.json');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Verified trace inspector', exact: true })).toBeVisible(); expect((await saved(page)).xp).toBe(0); expect(errors).toEqual([]);
});

test('runtime: experiments separate splits, pause, verify reruns and restore the local notebook', async ({ page }) => {
  await prepare(page); await page.goto('/#/academy?tab=lab'); await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
  await page.getByRole('button', { name: 'Pause academy', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Experiment paused', exact: true })).toBeVisible();
  const progress = await page.getByLabel('Runtime experiment progress').getAttribute('value'); await page.waitForTimeout(200); expect(await page.getByLabel('Runtime experiment progress').getAttribute('value')).toBe(progress);
  await page.getByRole('button', { name: 'Resume academy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Experiment results', exact: true })).toBeVisible();
  await waitForExperimentSave(page);
  const manifest = (await saved(page)).academy.lab.experiments[0]; expect(manifest.traceHashes).toHaveLength(32); expect(manifest.result.groups.map((g: { split: string }) => g.split)).toEqual(['TRAIN', 'VALIDATION', 'HOLDOUT', 'HOLDOUT']);
  await page.getByRole('button', { name: 'Rerun and verify experiment', exact: true }).click(); await expect(page.getByText('Manifest rerun verified. Results and trace hashes match.', { exact: true })).toBeVisible();
  expect((await saved(page)).academy.lab.experiments[0]).toEqual(manifest); await page.reload(); await expect(page.getByRole('heading', { name: 'Experiment results', exact: true })).toBeVisible(); await audit(page);
});

test('runtime: legacy policy imports train through the boundary; malformed packages and receipts preserve saved data', async ({ page }) => {
  test.setTimeout(90000); await prepare(page); await page.goto('/#/academy?tab=lab'); await page.getByLabel('Experiment environment', { exact: true }).selectOption('outpost');
  await page.getByLabel('Import controller package', { exact: true }).setInputFiles(upload('legacy.json', { version: 1, kind: 'outpost', rules: [{ when: 'always', action: 'approach' }] }));
  await expect(page.getByText('Controller imported. Inspect it before running.', { exact: true })).toBeVisible(); await page.getByLabel('Experiment method', { exact: true }).selectOption('rule-search'); await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Experiment results', exact: true })).toBeVisible({ timeout: 60000 });
  await waitForExperimentSave(page);
  const good = (await saved(page)).academy.lab; expect(good.experiments[0].result.groups[2].successes).toBe(8);
  await page.getByLabel('Import controller package', { exact: true }).setInputFiles(upload('evil.json', { ...good.controller, script: 'throw 1' })); await expect(page.getByText('Invalid or incompatible controller package.', { exact: true })).toBeVisible();
  await page.getByLabel('Import and verify receipt', { exact: true }).setInputFiles(upload('bad-trace.json', { ...good.receipt, finalHash: '0'.repeat(64) })); await expect(page.getByText('Receipt integrity hash differs.', { exact: true })).toBeVisible(); expect((await saved(page)).academy.lab).toEqual(good);
});

test('runtime: manifest imports rerun locally and frozen Q transfer exposes its actual values', async ({ page }) => {
  test.setTimeout(90000); await prepare(page); await page.goto('/#/academy?tab=lab');
  const manifest = runExperiment(createExperiment('sports', packageRules('sports', workedPolicy('sports')))).manifest;
  await page.getByLabel('Import and rerun manifest', { exact: true }).setInputFiles(upload('experiment.json', manifest)); await expect(page.getByText('Manifest rerun verified. Results and trace hashes match.', { exact: true })).toBeVisible();
  await waitForExperimentSave(page); expect((await saved(page)).academy.lab.experiments[0]).toEqual(manifest);
  await page.getByLabel('Experiment environment', { exact: true }).selectOption('rover'); await page.getByLabel('Experiment method', { exact: true }).selectOption('q-learning'); await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
  await expect.poll(async () => (await saved(page)).academy.lab.controller.parameters.trainingEpisodes, { timeout: 60000 }).toBe(1000);
  expect((await saved(page)).academy.rover.episodes).toBe(0); await page.getByRole('button', { name: 'Next tick', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Values used for this action', exact: true })).toBeVisible();
  const q = JSON.stringify((await saved(page)).academy.lab.controller.parameters.q); await page.getByRole('button', { name: 'Verify replay', exact: true }).click(); expect(JSON.stringify((await saved(page)).academy.lab.controller.parameters.q)).toBe(q); expect((await saved(page)).xp).toBe(0);
});

test('runtime: English and Spanish, reduced motion, narrow layouts and keyboard tabs remain accessible', async ({ page }) => {
  await prepare(page, 'es'); await page.goto('/#/academy?tab=lab'); await expect(page.getByRole('heading', { name: 'Laboratorio de experimentos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar un episodio', exact: true }).click(); await page.getByRole('button', { name: 'Siguiente paso', exact: true }).click();
  await page.getByText('Estado cambiado y hash', { exact: true }).click();
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); }
  await audit(page); const tab = page.getByRole('tab', { name: 'Laboratorio de experimentos', exact: true }); await tab.focus(); await page.keyboard.press('Home'); await expect(page.getByRole('tab', { name: 'Laboratorio de controladores', exact: true })).toBeFocused(); await page.keyboard.press('End'); await expect(tab).toBeFocused();
  await page.getByLabel('Idioma', { exact: true }).selectOption('en'); await expect(page.getByRole('heading', { name: 'Experiment lab', exact: true })).toBeVisible(); await audit(page);
});

test('runtime: vector fallback survives repeated inspection and controller imports never require network', async ({ page }) => {
  await prepare(page); await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
  await page.goto('/#/academy?tab=lab'); await page.getByRole('button', { name: 'Record one episode', exact: true }).click(); await expect(page.locator('.runtime-inspector .scene-status')).toContainText('VECTOR VIEW');
  for (let i = 0; i < 12; i++) { await page.getByRole('button', { name: 'Next tick', exact: true }).click(); await page.getByRole('button', { name: 'Previous tick', exact: true }).click(); }
  const requests: string[] = []; page.on('request', r => { if (/https?:/.test(r.url())) requests.push(r.url()); });
  await page.getByLabel('Import controller package', { exact: true }).setInputFiles(upload('policy.json', packageRules('sports', workedPolicy('sports')))); await page.getByRole('button', { name: 'Verify replay', exact: true }).click(); expect(requests).toEqual([]); await audit(page);
});
