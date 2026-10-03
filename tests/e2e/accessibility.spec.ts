import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { games } from '../../src/data/games';

test.describe.configure({ mode: 'parallel' });
const routes = ['/', '/progress', '/challenges', '/achievements', '/skills', '/settings', '/classes', '/class/derivatives', '/lab', '/lab/engine', '/assistant', '/bots', '/privacy', '/adults'];
for (const locale of ['en', 'es'] as const) {
  test(`accessible studio pages and all mission controls: ${locale}`, async ({ page }) => {
    test.setTimeout(300000);
    const save = freshSave(); save.settings.locale = locale; save.settings.tutorials = false; save.settings.reducedMotion = true; save.selectedDifficulty = true;
    await page.addInitScript(value => localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)), save);
    for (const route of [...routes, ...games.map(g => g.route)]) {
      await page.goto(`/?audit=${encodeURIComponent(route)}#${route}`); await expect(page.locator('main h1')).toBeVisible();
      if (route.startsWith('/game/')) await expect(page.locator('.game-controls')).toBeVisible();
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), route).toEqual([]);
    }
  });
}
test('skip link, keyboard mission controls, reading fallback, and narrow layouts', async ({ page }) => {
  test.setTimeout(180000);
  const save = freshSave(); save.settings.tutorials = false; save.selectedDifficulty = true; save.settings.reducedMotion = true;
  await page.addInitScript(value => localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)), save);
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {}, cancel: () => {} } }));
  await page.goto('/'); await expect(page.locator('main h1')).toBeVisible(); await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused(); await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused(); await expect(page.locator('.world-card')).toHaveCount(26);
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect(page.getByText('No local voice is available for this language on this device.').filter({ visible: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [...routes, ...games.map(g => g.route)]) {
      await page.goto(`/?audit=${encodeURIComponent(route)}#${route}`); await expect(page.locator('main h1')).toBeVisible();
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth, overflow: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map(e => ({ element: e.tagName, class: e.className, text: e.textContent?.slice(0, 80) })) }));
      expect(layout.width, `${route}, ${width}px: ${JSON.stringify(layout.overflow)}`).toBeLessThanOrEqual(layout.viewport);
      if (route.startsWith('/lab/')) {
        const clipped = await page.locator('.crt-screen .mission-tabs').evaluate(el => { const bounds = el.getBoundingClientRect(); return [...el.querySelectorAll('button')].filter(button => { const rect = button.getBoundingClientRect(); return rect.left < bounds.left - 1 || rect.right > bounds.right + 1; }).map(button => button.textContent); });
        expect(clipped, `Every retro mission tab fits at ${width}px`).toEqual([]);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/game/code'); await expect(page.locator('.game-controls')).toBeVisible();
  await page.getByRole('button', { name: 'Add right command', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.command-queue button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); await expect(page.getByRole('button', { name: 'Add up command', exact: true })).toBeDisabled();
});
