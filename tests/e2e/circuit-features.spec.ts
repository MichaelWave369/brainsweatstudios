import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { validateCircuit } from '../../src/circuit/evidence';
import { decodeCircuitStorage } from '../../src/circuit/storage';
import { standings } from '../../src/circuit/scoring';
import { makeSeason } from '../../src/circuit/specs';
import { validateCircuitBatch, runCircuitSeason } from '../../src/circuit/cli';
import { addCircuitSeason, starterCircuit } from '../../src/circuit/operations';
import { freshCircuit } from '../../src/circuit/evidence';
import { productionOrigin } from './productionOrigin';
test.describe.configure({ mode: 'parallel' }); test.use({ screenshot: 'only-on-failure' });
async function prepare(page: Page, locale: 'en' | 'es' = 'en') { const save = freshSave(); save.selectedDifficulty = true; save.settings.tutorials = false; save.settings.muted = true; save.settings.reducedMotion = true; save.settings.locale = locale; await page.addInitScript(v => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(v)); }, save); }
async function saved(page: Page) { const raw = await page.evaluate(() => { const bundle = JSON.parse(localStorage.getItem('brain-sweat-studio:profiles:v2')!); return bundle.profiles.find((p: { id: string }) => p.id === bundle.active).save.academy.circuit; }); return raw.schema === 'circuit-storage@1' ? decodeCircuitStorage(raw) : validateCircuit(raw); }
async function start(page: Page) { await page.getByRole('button', { name: 'Create two starter teams', exact: true }).click(); await page.getByRole('button', { name: 'Freeze new season', exact: true }).click(); }
async function event(page: Page) { await page.getByRole('button', { name: 'Run next event', exact: true }).click(); await expect(page.getByTestId('circuit-status')).toHaveText(/READY_FOR_NEXT|SEASON_COMPLETE/, { timeout: 45000 }); }
test('circuit: two crews run six events, carry native artifacts, export and reload official standings', async ({ page, browserName }) => {
    test.setTimeout(180000); await prepare(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/#/academy?tab=circuit'); await start(page);
    for (let i = 0; i < 6; i++) await event(page);
    const archive = await saved(page); expect(archive.events).toHaveLength(6); expect(archive.events.every(e => e.parts.every(p => p.native.result.success))).toBe(true);
    expect(archive.events[3].parts[0].shifts).toHaveLength(24); expect(archive.events[5].parts[1].admissions[0].assets.map(a => a.type)).toEqual(expect.arrayContaining(['music-score', 'research-dossier', 'performance-plan']));
    await expect(page.getByRole('heading', { name: 'Season complete', exact: true })).toBeVisible(); await expect(page.getByRole('table', { name: 'Team Circuit standings' })).toContainText(standings(archive.seasons[0], archive.events)[0].points.toFixed(2));
    const file = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Circuit', exact: true }).click(); const download = await file; const stream = await download.createReadStream(); if (!stream) throw new Error('Missing export.'); let text = ''; for await (const chunk of stream) text += chunk.toString(); expect(validateCircuit(JSON.parse(text)).events.at(-1)?.digest).toBe(archive.events.at(-1)?.digest);
    await page.getByLabel('Archived event', { exact: true }).selectOption(archive.events[1].id); await page.getByLabel('Native replay part', { exact: true }).selectOption('part-3'); await page.getByLabel('Replay frame', { exact: true }).fill(String(archive.events[1].parts[2].native.records.length)); await expect(page.getByRole('table', { name: 'Fictional vehicle telemetry' })).toBeVisible();
    const scan = await new AxeBuilder({ page }).include('.circuit-paddock').analyze(); expect(scan.violations).toEqual([]); if (browserName === 'chromium') await page.locator('.circuit-theater').screenshot({ path: 'test-results/circuit-review/race-theater.png' });
    await page.reload(); await expect(page.getByTestId('circuit-status')).toHaveText('SEASON_COMPLETE'); expect((await saved(page)).events.map(e => e.digest)).toEqual(archive.events.map(e => e.digest)); expect(errors).toEqual([]);
});
test('circuit: stopped native restoration survives a hidden tab and an actual offline origin outage', async ({ page }) => {
    test.setTimeout(90000); await prepare(page); const origin = await productionOrigin(); try {
        await page.goto(`${origin.url}#/academy?tab=circuit`); await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await start(page);
        await page.getByRole('button', { name: 'One logical turn', exact: true }).click(); await expect(page.getByTestId('circuit-status')).toHaveText('READY');
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }); await expect(page.getByTestId('circuit-status')).toHaveText('PAUSED'); const before = await saved(page); await page.waitForTimeout(250); expect((await saved(page)).events[0].digest).toBe(before.events[0].digest);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); }); await origin.close(); const response = await page.reload(); expect(response?.status()).toBe(200); expect(response?.fromServiceWorker()).toBe(true); await expect(page.getByTestId('circuit-status')).toHaveText('STOPPED'); expect((await saved(page)).events[0].digest).toBe(before.events[0].digest); await event(page); expect((await saved(page)).events[0].ending).toBe('COMPLETE');
    } finally { await origin.close(); }
});
test('circuit: Spanish Paddock and original performance work at 320/390 with keyboard and accessible controls', async ({ page, browserName }) => {
    await prepare(page, 'es'); await page.goto('/#/academy?tab=circuit'); await expect(page.getByRole('heading', { name: 'Paddock del circuito', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Crear dos equipos iniciales', exact: true }).focus(); await page.keyboard.press('Enter'); await page.getByRole('button', { name: 'Fijar nueva temporada', exact: true }).click(); await page.getByRole('button', { name: 'Ejecutar próximo evento', exact: true }).click(); await expect(page.getByTestId('circuit-status')).toHaveText('READY_FOR_NEXT');
    for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); const scan = await new AxeBuilder({ page }).include('.circuit-paddock').analyze(); expect(scan.violations).toEqual([]); }
    await expect(page.getByRole('heading', { name: 'Clasificación multidimensional', exact: true })).toBeVisible(); if (browserName === 'chromium') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: 'test-results/circuit-review/spanish-phone.png' }); }
});
test('circuit: freezing a second season keeps the current season active until the operator switches', async ({ page }) => {
    await prepare(page); await page.goto('/#/academy?tab=circuit'); await start(page);
    await expect(page.getByLabel('Active season', { exact: true })).toHaveValue('season-1');
    await page.getByRole('button', { name: 'Freeze new season', exact: true }).click();
    await expect(page.getByLabel('Active season', { exact: true })).toHaveValue('season-1');
    await expect(page.getByRole('status').filter({ hasText: 'Active season remains season-1' })).toBeVisible();
    await page.getByLabel('Active season', { exact: true }).selectOption('season-2');
    await expect(page.getByLabel('Active season', { exact: true })).toHaveValue('season-2');
});
test('circuit: Fork-Thirty residents require explicit local connection before local-model binding', async ({ page }) => {
    await prepare(page); await page.goto('/#/academy?tab=circuit');
    await page.getByLabel('Fork-Thirty resident', { exact: true }).selectOption('sal');
    await page.getByRole('button', { name: 'Add Fork-Thirty resident', exact: true }).click();
    await expect(page.getByLabel('Passport controller sal', { exact: true })).toHaveValue('baseline');
    await expect(page.getByText('Fork-Thirty resident · strategic-planner', { exact: true })).toBeVisible();
    await page.getByLabel('Passport controller sal', { exact: true }).selectOption('local');
    await expect(page.getByRole('status').filter({ hasText: 'Connect the local bridge and select an installed model first.' })).toBeVisible();
    expect((await saved(page)).agents.find(agent => agent.id === 'sal')?.controller.world.family).toBe('baseline');
    await page.getByLabel('Passport controller sal', { exact: true }).selectOption('mock');
    await expect.poll(async () => (await saved(page)).agents.find(agent => agent.id === 'sal')?.controller.world.provider).toBe('mock');
});
test('circuit: Society Board persists quorum-approved coordination without granting authority', async ({ page }) => {
    await prepare(page); await page.goto('/#/academy?tab=circuit');
    const brainBefore = await page.evaluate(() => localStorage.getItem('brain-sweat-studio:profiles:v2') ?? localStorage.getItem('brain-sweat-studio:v1'));
    const board = page.getByRole('region', { name: 'Fork-Thirty Society Board' });
    await board.getByRole('button', { name: 'Create starter society', exact: true }).click();
    await expect(board.getByRole('heading', { name: 'Society Board', exact: true })).toBeVisible();
    await expect(board.getByLabel('Society institution', { exact: true })).toHaveValue('mission-council');
    await board.getByLabel('Society acting resident', { exact: true }).selectOption('sal');
    const sal = board.locator('.society-service').filter({ hasText: 'SAL' });
    await sal.getByRole('button', { name: 'Start', exact: true }).click();
    await sal.getByRole('button', { name: 'Mark ready', exact: true }).click();
    await board.getByLabel('Society proposal summary', { exact: true }).fill('Run a same-seed controller comparison.');
    await board.getByLabel('Society task reference', { exact: true }).fill('circuit:season-1:round-1');
    await board.getByRole('button', { name: 'Submit proposal', exact: true }).click();
    await expect(board.getByText(/OPEN · endorsements 1\/2 · authority granted:/)).toBeVisible();
    await board.getByLabel('Society acting resident', { exact: true }).selectOption('al');
    await board.getByRole('button', { name: 'Endorse', exact: true }).click();
    await board.getByRole('button', { name: 'Operator approve', exact: true }).click();
    await expect(board.getByText(/OPERATOR_APPROVED · endorsements 2\/2 · authority granted:/)).toBeVisible();
    await expect(board.getByText('false', { exact: true })).toBeVisible();
    await expect(board.getByText('PROPOSED', { exact: true })).toBeVisible();
    await expect(board.getByText('ENDORSED', { exact: true })).toBeVisible();
    await expect(board.getByText('OPERATOR_APPROVED', { exact: true })).toBeVisible();
    await board.getByRole('button', { name: 'Run society red-team', exact: true }).click();
    await expect(board.getByTestId('society-redteam-status')).toHaveText('9/9 attacks blocked · PASS');
    const bridgePreflight = board.locator('p').filter({ hasText: 'Bridge contract readiness:' });
    await expect(bridgePreflight).toContainText('PASS');
    await expect(bridgePreflight).toContainText('Activation: BLOCKED');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fork-thirty-society:v1')!).proposals[0].authorityGranted)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('brain-sweat-studio:profiles:v2') ?? localStorage.getItem('brain-sweat-studio:v1'))).toBe(brainBefore);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Fork-Thirty Society Board' }).getByText(/OPERATOR_APPROVED/)).toBeVisible();
});
test('circuit: imports are atomic and human role actions retain native controller attribution', async ({ page }) => {
    await prepare(page); await page.goto('/#/academy?tab=circuit'); await page.getByRole('button', { name: 'Create two starter teams', exact: true }).click(); await page.getByLabel('Passport controller comet-one', { exact: true }).selectOption('human'); await page.getByRole('button', { name: 'Freeze new season', exact: true }).click(); await page.getByRole('button', { name: 'One logical turn', exact: true }).click(); await expect(page.getByTestId('circuit-status')).toHaveText('READY');
    const actions = page.getByLabel(/^Human action /); expect(await actions.count()).toBeGreaterThan(0); for (const select of await actions.all()) await select.selectOption({ index: 1 }); await page.getByRole('button', { name: 'Advance human turn', exact: true }).click(); const before = await saved(page); expect(before.events[0].parts[0].native.records).toHaveLength(1);
    await page.getByLabel('Import Circuit', { exact: true }).setInputFiles({ name: 'hostile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...before, executable: 'run' })) }); await expect(page.getByRole('status').filter({ hasText: 'Invalid bounded Circuit archive' })).toBeVisible(); expect((await saved(page)).events[0].digest).toBe(before.events[0].digest);
    await page.getByLabel('Import Circuit', { exact: true }).setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) }); await expect(page.getByTestId('circuit-status')).toHaveText('STOPPED'); expect((await saved(page)).events[0].digest).toBe(before.events[0].digest);
});
test('circuit: frozen worker batch exports replayable disjoint TRAIN HOLDOUT TRANSFER comparisons', async ({ page }) => {
    test.setTimeout(150000); await prepare(page); await page.goto('/#/academy?tab=circuit'); await page.getByRole('button', { name: 'Create two starter teams', exact: true }).click();
    const spec = makeSeason(['comet'], 6, 'GAUNTLET'); await page.getByLabel('Import SeasonSpec', { exact: true }).setInputFiles({ name: 'gauntlet.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(spec)) }); await expect(page.getByLabel('Evaluation partition')).toHaveValue('TRAIN'); await page.getByRole('button', { name: 'Run frozen batch', exact: true }).click(); await expect(page.getByRole('button', { name: 'Export batch evidence', exact: true })).toBeVisible({ timeout: 90000 });
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export batch evidence', exact: true }).click(); const download = await pending, stream = await download.createReadStream(); if (!stream) throw new Error('Missing batch export.'); let text = ''; for await (const chunk of stream) text += chunk.toString(); const batch = validateCircuitBatch(JSON.parse(text)); expect(batch.trials).toHaveLength(18); expect(batch.trials.every(e => e.parts.every(p => p.admissions.every(a => !a.notes.length && !a.assets.length)))).toBe(true); await expect(page.getByRole('table', { name: 'Observed generalization', exact: true })).toContainText('TRANSFER');
});
test('circuit: twelve-event evidence imports, persists without quota loss and restores after reload', async ({ page }) => {
    test.setTimeout(180000); const source = addCircuitSeason(starterCircuit(freshCircuit()), makeSeason(['comet', 'aurora'], 12)), archive = await runCircuitSeason(source, 'first-circuit');
    await prepare(page); await page.goto('/#/academy?tab=circuit'); await page.getByLabel('Import Circuit', { exact: true }).setInputFiles({ name: 'twelve.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) }); await expect(page.getByRole('heading', { name: 'Season complete', exact: true })).toBeVisible({ timeout: 45000 });
    expect((await saved(page)).events).toHaveLength(12); await expect(page.getByRole('alert').filter({ hasText: 'cannot keep a local save' })).toHaveCount(0); await page.reload(); await expect(page.getByTestId('circuit-status')).toHaveText('SEASON_COMPLETE'); expect((await saved(page)).events.at(-1)?.digest).toBe(archive.events.at(-1)?.digest);
    await expect(page.getByRole('heading', { name: 'Season complete', exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Team Circuit standings' })).toContainText(standings(archive.seasons[0], archive.events)[0].points.toFixed(2));
});
