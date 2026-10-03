import { test, expect, type Page } from '@playwright/test';
import { freshSave } from '../../src/systems/progress';

test.describe.configure({ mode: 'parallel' });
async function prepare(page: Page, bots = false) {
  const save = freshSave(); save.settings.tutorials = false; save.settings.botControl = bots; save.selectedDifficulty = true;
  await page.addInitScript(value => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)); }, save);
}
async function saved(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!)); }

test('unfinished budget and robot program survive refresh and switch between isolated profiles', async ({ page }) => {
  await prepare(page); await page.goto('/#/game/code');
  for (let n = 0; n < 3; n++) await page.getByRole('button', { name: 'Add right command', exact: true }).click();
  await page.reload(); await expect(page.locator('.command-queue button')).toHaveCount(3);
  await page.goto('/#/game/money'); await page.getByRole('button', { name: 'Start the month' }).click(); await page.getByRole('button', { name: /Find another way/ }).click();
  const prior = await saved(page); expect(prior.checkpoints['money/explorer/0'].state.week).toBe(1);
  await page.reload(); expect((await saved(page)).checkpoints['money/explorer/0'].state.week).toBe(1);
  await expect(page.getByRole('button', { name: /Find another way/ })).toBeVisible();
  await page.goto('/#/settings'); const originalId = await page.getByLabel('Active profile', { exact: true }).inputValue();
  await page.getByLabel('Profile nickname', { exact: true }).fill('Orchid'); await page.getByRole('button', { name: 'Add local profile', exact: true }).click();
  expect((await saved(page)).checkpoints).toEqual({}); expect((await saved(page)).xp).toBe(0);
  await page.getByLabel('Active profile', { exact: true }).selectOption(originalId);
  expect((await saved(page)).checkpoints).toEqual(prior.checkpoints);
  await page.goto('/#/game/code'); await expect(page.locator('.command-queue button')).toHaveCount(3);
});

test('creative science missions award earned play, checkpoint melody, and work silently', async ({ page }) => {
  await prepare(page); await page.goto('/#/game/music');
  await page.getByRole('button', { name: 'Load a starting pattern', exact: true }).click(); await page.getByRole('button', { name: 'Perform my phrase', exact: true }).click();
  await page.getByLabel('Pitch step 16', { exact: true }).selectOption('2'); await page.reload();
  await expect(page.getByLabel('Pitch step 16', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Perform my phrase', exact: true }).click(); await page.getByRole('button', { name: 'Save my composition', exact: true }).click();
  await expect(page.getByText('EXPERIMENT COMPLETE', { exact: true })).toBeVisible(); expect((await saved(page)).records['music/explorer/0'].completed).toBe(true); expect((await saved(page)).checkpoints['music/explorer/0']).toBeUndefined();
  await page.goto('/#/game/frequency'); await page.getByLabel('Waveform', { exact: true }).selectOption('triangle'); const before = await page.locator('.wave-display path').last().getAttribute('d'); await page.getByLabel('Waveform', { exact: true }).selectOption('sine'); expect(await page.locator('.wave-display path').last().getAttribute('d')).not.toEqual(before);
  for (const target of [220, 440, 220]) { const input = page.getByLabel('Frequency hertz', { exact: true }); await input.fill(String(target)); await page.getByRole('button', { name: 'Test my signal', exact: true }).click(); }
  await expect(page.getByText('EXPERIMENT COMPLETE', { exact: true })).toBeVisible(); expect((await saved(page)).records['frequency/explorer/0'].score).toBe(100);
});

test('bot final move never receives XP, and earned checkpoints are protected in Bot lab', async ({ page }) => {
  await prepare(page, true); await page.goto('/#/game/money'); await page.getByRole('button', { name: 'Start the month', exact: true }).click();
  for (let n = 0; n < 3; n++) await page.getByRole('button', { name: /Find another way/ }).click();
  await page.goto('/#/bots'); await page.getByRole('button', { name: 'Start bot practice', exact: true }).click(); await expect(page.getByText(/An earned-play checkpoint is saved here/)).toBeVisible();
  await page.goto('/#/game/money');
  // A demonstration marks even its finishing move as practice before React rerenders.
  for (let n = 0; n < 4; n++) await page.getByRole('button', { name: 'Demonstrate next move', exact: true }).click();
  await page.getByRole('button', { name: /Find another way/ }).click();
  await expect(page.getByText('Bot practice complete', { exact: true })).toBeVisible(); expect((await saved(page)).xp).toBe(0); expect((await saved(page)).records).toEqual({});
});

test('assistant and trio council select a relevant unfinished mission', async ({ page }) => {
  await prepare(page); await page.goto('/#/assistant');
  await expect(page.getByRole('heading', { name: 'Mentor', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Benefactor', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Strategist', exact: true })).toBeVisible();
  await page.getByLabel('Ask your assistant', { exact: true }).fill('I want to learn about plants and botany'); await page.getByRole('button', { name: 'Send to assistant', exact: true }).click();
  await page.getByRole('link', { name: /Botany Garden · Mission 1/ }).click(); await expect(page.locator('main h1')).toHaveText('Botany Garden');
});

test('reading chooses only a local voice and stops on mute and route changes', async ({ page }) => {
  await page.addInitScript(() => {
    const activity = { voices: [] as string[], cancels: 0 }; Object.assign(window, { __reading: activity });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { text: string; constructor(text: string) { this.text = text; } } });
    const voices = [{ name: 'Local English', lang: 'en-US', localService: true }, { name: 'Remote English', lang: 'en-US', localService: false }];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => voices, addEventListener: () => {}, removeEventListener: () => {}, cancel: () => { activity.cancels++; }, speak: (u: SpeechSynthesisUtterance) => { activity.voices.push(u.voice?.name || 'default'); } } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Read aloud', exact: true }).click(); await expect(page.getByRole('button', { name: 'Stop reading', exact: true })).toBeVisible();
  await page.goto('/#/settings'); await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click(); await page.getByRole('switch', { name: /Mute all/ }).check(); await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeDisabled();
  const activity = await page.evaluate(() => (window as unknown as { __reading: { voices: string[]; cancels: number } }).__reading); expect(activity.voices).toEqual(['Local English', 'Local English']); expect(activity.cancels).toBeGreaterThan(2);
});

test('Spanish preserves a chosen profile nickname verbatim', async ({ page }) => {
  await prepare(page); await page.goto('/#/settings'); await page.getByLabel('Profile nickname', { exact: true }).fill('Music'); await page.getByRole('button', { name: 'Rename this profile', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('es');
  await expect(page.locator('select').filter({ has: page.getByRole('option', { name: 'Music', exact: true }) })).toBeVisible();
  await page.goto('/#/assistant'); await expect(page.locator('.assistant-intro span[translate=no]')).toHaveText('Music');
});
