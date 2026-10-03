import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { referenceAction } from '../../src/agents/reference';
import { verifyAgentReceipt } from '../../src/agents/receipts';
import type { ModelObservation } from '../../src/agents/contracts';

test.describe.configure({ mode: 'parallel' });
async function prepare(page: Page, locale: 'en' | 'es' = 'en') { const save = freshSave(); save.selectedDifficulty = true; save.settings.tutorials = false; save.settings.reducedMotion = true; save.settings.muted = true; save.settings.locale = locale; await page.addInitScript(v => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(v)); }, save); }
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!));
const upload = (name: string, value: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
async function complete(page: Page, world = 'survey') { await page.getByLabel('Garage environment', { exact: true }).selectOption(world); await page.getByRole('button', { name: 'Start garage world', exact: true }).click(); await page.getByRole('button', { name: 'Run garage episode', exact: true }).click(); await expect.poll(async () => { const r = (await saved(page)).academy.garage.receipt; return r?.config.world === world && r.result.success; }, { timeout: 20000 }).toBe(true); }
async function audit(page: Page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]); }

test('garage: all eight worlds run through validated actions and restore verified receipts without XP', async ({ page }) => {
  test.setTimeout(90000); await prepare(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/#/academy?tab=garage');
  for (const world of ['survey','community','signal-maze','sports','outpost','scenario','space','rover']) { await complete(page, world); const receipt = (await saved(page)).academy.garage.receipt; expect(verifyAgentReceipt(receipt).result.success).toBe(true); }
  await page.getByRole('button', { name: 'Verify model world replay', exact: true }).click(); await expect(page.getByText('World replay verified from recorded actions. Model regeneration was not requested.', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Model receipt inspector', exact: true })).toBeVisible(); expect((await saved(page)).xp).toBe(0); expect(errors).toEqual([]);
});

test('garage: pause, resume, manual takeover and handoffs preserve the live world', async ({ page }) => {
  await prepare(page); await page.goto('/#/academy?tab=garage'); await page.getByRole('button', { name: 'Start garage world', exact: true }).click(); await page.getByRole('button', { name: 'Run garage episode', exact: true }).click(); await page.getByRole('button', { name: 'Pause garage', exact: true }).click();
  await expect(page.locator('.garage-status strong')).toHaveText('PAUSED'); const tick = (await saved(page)).academy.garage.receipt.result.ticks; await page.waitForTimeout(150); expect((await saved(page)).academy.garage.receipt.result.ticks).toBe(tick);
  await page.getByRole('button', { name: 'Resume garage', exact: true }).click(); await page.getByRole('button', { name: 'Take manual control', exact: true }).click(); await expect(page.getByRole('group', { name: 'Manual legal actions', exact: true })).toBeVisible();
  const before = (await saved(page)).academy.garage.receipt.result.ticks; await page.getByRole('group', { name: 'Manual legal actions', exact: true }).getByRole('button', { name: 'scan', exact: true }).click(); await expect.poll(async () => (await saved(page)).academy.garage.receipt.result.ticks).toBe(before + 1);
  await page.getByRole('button', { name: 'Hand off to reference', exact: true }).click(); await page.getByRole('button', { name: 'Step controller', exact: true }).click(); await page.getByRole('button', { name: 'Hand off to model', exact: true }).click(); await page.getByRole('button', { name: 'Step controller', exact: true }).click(); await page.getByRole('button', { name: 'Stop garage episode', exact: true }).click();
  await expect.poll(async () => (await saved(page)).academy.garage.receipt.ending).toBe('stopped'); const receipt = (await saved(page)).academy.garage.receipt; expect(receipt.handoffs.map((h: { to: { family: string } }) => h.to.family)).toEqual(['human','reference','model']); expect(verifyAgentReceipt(receipt).result.ticks).toBeGreaterThan(before);
});

test('garage: illegal proposals retry safely; timeout errors allow manual recovery', async ({ page }) => {
  await prepare(page); await page.goto('/#/academy?tab=garage'); await page.getByLabel('Mock behavior', { exact: true }).selectOption('alternating'); await complete(page, 'signal-maze');
  const receipt = (await saved(page)).academy.garage.receipt; expect(receipt.records.every((r: { attempts: { code: string }[] }) => r.attempts[0].code === 'ILLEGAL_ACTION' && r.attempts.length === 2)).toBe(true);
  await page.getByLabel('Mock behavior', { exact: true }).selectOption('timeout'); await page.getByText('Operator budgets', { exact: true }).click(); await page.getByLabel('Request timeout in milliseconds', { exact: true }).fill('40'); await page.getByLabel('Garage environment', { exact: true }).selectOption('survey'); await page.getByRole('button', { name: 'Start garage world', exact: true }).click(); await page.getByRole('button', { name: 'Step controller', exact: true }).click();
  await expect(page.locator('.garage-status strong')).toHaveText('ERROR'); await expect.poll(async () => (await saved(page)).academy.garage.receipt.records.length).toBe(1); expect((await saved(page)).academy.garage.receipt.result.ticks).toBe(0);
  await page.getByRole('button', { name: 'Hand off to reference', exact: true }).click(); await page.getByRole('button', { name: 'Run garage episode', exact: true }).click(); await expect.poll(async () => (await saved(page)).academy.garage.receipt.result.success, { timeout: 20000 }).toBe(true); expect(verifyAgentReceipt((await saved(page)).academy.garage.receipt).result.success).toBe(true);
});

test('garage: frozen comparisons pause, preserve split isolation, rerun and reject corrupt imports', async ({ page }) => {
  test.setTimeout(90000); await prepare(page); await page.goto('/#/academy?tab=garage'); await page.getByRole('button', { name: 'Compare frozen controllers', exact: true }).click(); await page.getByRole('button', { name: 'Pause academy', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Frozen comparison paused', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Resume academy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Frozen model comparison', exact: true })).toBeVisible(); await expect.poll(async () => (await saved(page)).academy.garage.experiments.length).toBe(1); const manifest = (await saved(page)).academy.garage.experiments[0]; expect(manifest.report.trials).toHaveLength(16); expect(manifest.seeds.TRAIN.every((s: number) => !manifest.seeds.HOLDOUT.includes(s))).toBe(true);
  await page.getByLabel('Import model manifest', { exact: true }).setInputFiles(upload('model-experiment.json', manifest)); await expect(page.getByText('Recorded proposals and world traces match. World replay is verified separately.', { exact: true })).toBeVisible();
  const good = (await saved(page)).academy.garage; await page.getByLabel('Import model receipt', { exact: true }).setInputFiles(upload('bad.json', { ...good.receipt, finalHash: '0'.repeat(64) })); await expect(page.getByText('Model receipt integrity differs.', { exact: true })).toBeVisible(); expect((await saved(page)).academy.garage).toEqual(good);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export model manifest', exact: true }).click(); expect((await download).suggestedFilename()).toBe('brain-sweat-model-experiment.json'); await page.reload(); await expect(page.getByRole('heading', { name: 'Frozen model comparison', exact: true })).toBeVisible();
});

test('garage: Spanish, keyboard tabs, 320/390 layouts and reduced-motion graphics stay accessible', async ({ page }) => {
  await prepare(page, 'es'); await page.goto('/#/academy?tab=garage'); await expect(page.getByRole('heading', { name: 'Garaje de agentes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar mundo del garaje', exact: true }).click(); await page.getByRole('button', { name: 'Avanzar controlador', exact: true }).click(); await page.getByText('Cuaderno del agente · notas públicas de la tarea', { exact: true }).click();
  for (const width of [320,390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); } await audit(page);
  await page.getByRole('tab', { name: 'Garaje de agentes', exact: true }).focus(); await page.keyboard.press('Home'); await expect(page.getByRole('tab', { name: 'Laboratorio de controladores', exact: true })).toBeFocused(); await page.keyboard.press('End'); await expect(page.getByRole('tab', { name: 'Garaje de agentes', exact: true })).toBeFocused();
  await page.getByLabel('Idioma', { exact: true }).selectOption('en'); await expect(page.getByRole('heading', { name: 'Agent garage', exact: true })).toBeVisible(); await audit(page);
});

test('garage: explicit local bridge connection discovers a selected model and executes validated proposals', async ({ page }) => {
  await prepare(page); const calls: string[] = []; await page.route('http://127.0.0.1:11435/**', async route => {
    const url = route.request().url(); calls.push(url); if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Brain-Sweat-Bridge', 'Access-Control-Allow-Private-Network': 'true' } }); return; } let body: unknown;
    if (url.endsWith('/health')) body = { schema: 'agent-bridge@1', sessionToken: 'a'.repeat(64) };
    else if (url.endsWith('/models')) body = { models: [{ id: 'test-local:latest', sizeBytes: 123456, contextLength: null, capabilities: [], digest: null, local: true }] };
    else if (url.endsWith('/metadata')) body = { model: { id: 'test-local:latest', sizeBytes: 123456, contextLength: 8192, capabilities: ['completion'], digest: null, local: true } };
    else { const request = route.request().postDataJSON() as { observation: ModelObservation }; body = { text: JSON.stringify({ action: referenceAction(request.observation), note: 'Test transport only.' }), model: 'test-local:latest', usage: { inputTokens: 10, outputTokens: 4 } }; }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  });
  await page.goto('/#/academy?tab=garage'); expect(calls).toEqual([]); await page.getByLabel('Model provider', { exact: true }).selectOption('ollama'); expect(calls).toEqual([]); await page.getByRole('button', { name: 'Connect local bridge', exact: true }).click(); await expect(page.getByText('Bridge connected. Choose an installed model explicitly.', { exact: true })).toBeVisible(); expect(calls.some(c => c.endsWith('/inference'))).toBe(false);
  await page.getByLabel('Installed local model', { exact: true }).selectOption('test-local:latest'); await complete(page); const receipt = verifyAgentReceipt((await saved(page)).academy.garage.receipt); expect(receipt.initialControllers.pilot.provider).toBe('ollama'); expect(receipt.records[0].attempts[0].usage.inputTokens).toBe(10); await page.getByRole('button', { name: 'Disconnect provider', exact: true }).click(); await expect(page.getByText('Provider disconnected. Pending responses were cancelled.', { exact: true })).toBeVisible();
});

test('garage: offline mock, data exchange and world replay never require a provider request', async ({ page }) => {
  await prepare(page); await page.goto('/#/academy?tab=garage'); await expect(page.getByRole('heading', { name: 'Agent garage', exact: true })).toBeVisible(); await expect(page.getByLabel('Garage environment', { exact: true })).toBeEnabled(); const studioOrigin = new URL(page.url()).origin, requests: string[] = []; page.on('request', r => { if (r.method() === 'POST' || new URL(r.url()).origin !== studioOrigin) requests.push(r.url()); }); await page.context().setOffline(true); await complete(page, 'community'); await page.getByRole('button', { name: 'Verify model world replay', exact: true }).click(); expect(requests).toEqual([]); await page.context().setOffline(false); await audit(page);
});
