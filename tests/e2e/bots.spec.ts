import { test, expect } from '@playwright/test';
import { games } from '../../src/data/games';
import { freshSave } from '../../src/systems/progress';

test.describe.configure({ mode: 'parallel' });
const all = process.env.BOT_FULL_SWEEP === '1';
const selectedWorlds = process.env.BOT_WORLDS?.split(',');
for (const mode of (process.env.BOT_MODES?.split(',') || ['explorer', 'builder', 'master'])) {
  for (const world of games.filter(g => !selectedWorlds || selectedWorlds.includes(g.id))) {
    for (const mission of (all ? Array.from({ length: 8 }, (_, i) => i) : [0, 5, 7])) {
      test(`agent: ${world.id}, ${mode}, mission ${mission + 1}`, async ({ page }) => {
        const save = freshSave(); save.difficulty = mode as typeof save.difficulty; save.selectedDifficulty = true; save.settings.botControl = true; save.settings.tutorials = false; save.settings.muted = true; save.settings.reducedMotion = true;
        await page.addInitScript(value => { localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)); }, save);
        const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`/#/game/${world.id}?mission=${mission + 1}&bot=1`);
        await page.getByLabel('Bot speed', { exact: true }).selectOption('120');
        await expect(page.getByText('Bot practice complete', { exact: true })).toBeVisible({ timeout: 30000 });
        const score = Number((await page.locator('.result-stats>div').first().innerText()).split('/')[0]);
        expect(score).toBeGreaterThanOrEqual(60);
        expect(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!); return { xp: s.xp, records: Object.keys(s.records).length, badges: s.badges.length, checkpoints: Object.keys(s.checkpoints).length }; })).toEqual({ xp: 0, records: 0, badges: 0, checkpoints: 0 });
        expect(errors).toEqual([]);
      });
    }
  }
}
