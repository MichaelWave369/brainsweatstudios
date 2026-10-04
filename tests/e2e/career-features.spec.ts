import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { validateCareer } from '../../src/career/validation';
import { productionOrigin } from './productionOrigin';
test.describe.configure({ mode: 'parallel' });
test.use({ screenshot: 'only-on-failure' });
async function prepare(page: Page, locale: 'en' | 'es' = 'en') {
    const save = freshSave();
    save.selectedDifficulty = true;
    save.settings.tutorials = false;
    save.settings.muted = true;
    save.settings.reducedMotion = true;
    save.settings.locale = locale;
    await page.addInitScript(v => {
        if (!localStorage.getItem('brain-sweat-studio:v1'))
            localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(v));
    }, save);
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!).academy.career);
async function agent(page: Page) { await page.getByRole('button', { name: 'Create passport', exact: true }).click(); await expect(page.getByLabel('Selected agent', { exact: true })).toHaveValue('studio-agent'); }
async function episode(page: Page) { await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click(); await page.getByRole('button', { name: 'Run episode', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Execution status' })).toContainText('COMPLETE'); }
test('career: one passport uses baseline and mock families; receipts restore stopped and preserve game rewards', async ({ page }) => {
    await prepare(page);
    await page.goto('/#/academy?tab=locker');
    await agent(page);
    await episode(page);
    await page.getByLabel('Controller selection', { exact: true }).selectOption('mock');
    await expect.poll(async () => (await saved(page)).agents[0].controller.garage.family).toBe('model');
    await page.getByLabel('Destination world', { exact: true }).selectOption('survey');
    await episode(page);
    const data = validateCareer(await saved(page));
    expect(data.agents[0].id).toBe('studio-agent');
    expect(data.runs.map(r => r.controller.family)).toEqual(['baseline', 'model']);
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Execution status' })).toContainText('STOPPED');
    expect((await saved(page)).runs).toHaveLength(2);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!).points)).toBe(0);
});
test('career: scoped notes, verified plan handoffs, fresh holdout and invalid imports are explicit and atomic', async ({ page }) => {
    await prepare(page);
    await page.goto('/#/academy?tab=locker');
    await agent(page);
    await page.getByLabel('Public note', { exact: true }).fill('Preserve a public reserve.');
    await page.getByRole('button', { name: 'Save public note', exact: true }).click();
    await page.getByRole('button', { name: 'Edit note', exact: true }).click();
    await page.getByLabel('Public note', { exact: true }).fill('Preserve a declared public reserve.');
    await page.getByRole('button', { name: 'Save public note', exact: true }).click();
    expect((await saved(page)).notes['studio-agent']).toHaveLength(1);
    await page.getByLabel('Memory condition', { exact: true }).selectOption('PRIOR');
    await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click();
    await page.getByRole('button', { name: 'Advance one tick', exact: true }).click();
    await page.getByRole('button', { name: 'Record public plan', exact: true }).click();
    await page.getByRole('button', { name: 'Retain verified plan', exact: true }).click();
    expect((await saved(page)).artifacts).toHaveLength(1);
    await page.getByLabel('Destination world', { exact: true }).selectOption('town-zero');
    await page.getByLabel('Evaluation partition', { exact: true }).selectOption('HOLDOUT');
    await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click();
    await page.getByRole('button', { name: 'Advance one tick', exact: true }).click();
    const before = await saved(page);
    const last = before.runs.at(-1);
    expect(last.evaluation.condition).toBe('FRESH');
    expect(last.evaluation.notes).toEqual([]);
    expect(last.evaluation.artifacts).toEqual([]);
    await page.getByLabel('Import Locker', { exact: true }).setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...before, agents: [{ ...before.agents[0], iq: 180 }] })) });
    await expect(page.getByRole('alert')).toContainText('passport');
    expect(await saved(page)).toEqual(before);
});
test('career: hidden and paused episodes stop; offline cached Locker imports and replay require no provider', async ({ page }) => {
    await prepare(page);
    const origin = await productionOrigin();
    try {
        await page.goto(`${origin.url}#/academy?tab=locker`);
        await page.evaluate(async () => { await navigator.serviceWorker.ready; });
        await page.reload();
        await agent(page);
        await page.getByLabel('Destination world', { exact: true }).selectOption('town-zero');
        await page.getByRole('button', { name: 'Prepare handoff', exact: true }).click();
        await page.getByRole('button', { name: 'Run episode', exact: true }).click();
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        await expect(page.getByRole('status').filter({ hasText: 'Execution status' })).toContainText('PAUSED');
        const before = await saved(page);
        await page.waitForTimeout(250);
        expect(await saved(page)).toEqual(before);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
        await origin.close();
        const response = await page.reload();
        expect(response?.status()).toBe(200);
        expect(response?.fromServiceWorker()).toBe(true);
        await expect(page.getByRole('heading', { name: 'Agent Locker', exact: true })).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Execution status' })).toContainText('STOPPED');
        validateCareer(await saved(page));
    }
    finally {
        await origin.close();
    }
});
test('career: Spanish keyboard and 320/390 layouts remain accessible', async ({ page }) => {
    await prepare(page, 'es');
    await page.goto('/#/academy?tab=locker');
    await expect(page.getByRole('heading', { name: 'Casillero de agentes', exact: true })).toBeVisible();
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const bounds = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, overflow: Array.from(document.querySelectorAll('.career *')).filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent?.slice(0, 60), right: Math.round(e.getBoundingClientRect().right) })).slice(0, 12) }));
        expect(bounds.scroll, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.width);
    }
    await page.getByLabel('Identificador operativo', { exact: true }).fill('iris');
    await page.getByLabel('Nombre visible', { exact: true }).fill('Iris');
    await page.getByRole('button', { name: 'Crear pasaporte', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Agente seleccionado', { exact: true })).toHaveValue('iris');
    const scan = await new AxeBuilder({ page }).include('.career').analyze();
    expect(scan.violations).toEqual([]);
});
