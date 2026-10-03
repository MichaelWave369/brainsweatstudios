import { test, expect } from '@playwright/test';

test('simulated low-power display caps resolution and stops drawing with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  const page = await context.newPage(); const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const stats = { frames: 0 }; Object.assign(window, { __drawing: stats });
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) { stats.frames++; return draw.apply(this, args); };
  });
  for (const world of ['music', 'frequency', 'botany', 'engine', 'robot', 'vm', 'calculus']) {
    await page.goto(`/#/game/${world}`); await page.getByRole('button', { name: /Start mission 1|Resume checkpoint/ }).click();
    await expect(page.locator('.game-controls')).toBeVisible();
    const size = await page.locator('canvas').evaluate((node: HTMLCanvasElement) => ({ pixels: node.width, css: node.clientWidth })); expect(size.pixels).toBeLessThanOrEqual(Math.round(size.css * 1.5));
    await page.waitForTimeout(100); const before = await page.evaluate(() => (window as unknown as { __drawing: { frames: number } }).__drawing.frames);
    await page.waitForTimeout(250); expect(await page.evaluate(() => (window as unknown as { __drawing: { frames: number } }).__drawing.frames)).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await context.close();
});
