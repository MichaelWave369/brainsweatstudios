import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { games } from '../../src/data/games';

test.describe.configure({ mode: 'parallel' });
const routes = ['/', '/progress', '/challenges', '/achievements', '/skills', '/settings', '/assistant', '/bots', '/privacy', '/adults'];
for (const locale of ['en', 'es'] as const) {
  test(`accessible studio pages and all mission controls: ${locale}`, async ({ page }) => {
    test.setTimeout(180000);
    const save = freshSave(); save.settings.locale = locale; save.settings.tutorials = false; save.settings.reducedMotion = true; save.selectedDifficulty = true;
    await page.addInitScript(value => localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)), save);
    for (const route of [...routes, ...games.map(g => g.route)]) {
      await page.goto(`/#${route}`); await expect(page.locator('main h1')).toBeVisible();
      if (route.startsWith('/game/')) await expect(page.locator('.game-controls')).toBeVisible();
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), route).toEqual([]);
    }
  });
}
test('skip link, keyboard mission controls, reading fallback, and narrow layouts', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {}, cancel: () => {} } }));
  await page.goto('/'); await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused(); await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused(); await expect(page.locator('.world-card')).toHaveCount(15);
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect(page.getByText('No local voice is available for this language on this device.').filter({ visible: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [...routes, ...games.map(g => g.route)]) { await page.goto(`/#${route}`); await expect(page.locator('main h1')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route}, ${width}px`).toBe(true); }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/game/code'); await page.getByRole('button', { name: /Start mission|Resume checkpoint/ }).click();
  await page.getByRole('button', { name: 'Add right command', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.command-queue button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); await expect(page.getByRole('button', { name: 'Add up command', exact: true })).toBeDisabled();
});
