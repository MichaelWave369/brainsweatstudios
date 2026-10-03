import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
import { courses } from '../../src/data/classes';

test.describe.configure({ mode: 'parallel' });
async function prepare(page: Page, locale: 'en' | 'es' = 'en') {
  const save = freshSave(); save.selectedDifficulty = true; save.settings.tutorials = false;
  save.settings.reducedMotion = true; save.settings.muted = true; save.settings.locale = locale;
  await page.addInitScript(value => { if (!localStorage.getItem('brain-sweat-studio:v1')) localStorage.setItem('brain-sweat-studio:v1', JSON.stringify(value)); }, save);
}
async function saved(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!)); }
function metric(page: Page, label: string) { return page.locator('.game-stat').filter({ has: page.getByText(label, { exact: true }) }).locator('strong'); }
async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) }))).toEqual([]);
}

test('academy: controller search improves trials, replays failures, and transfers its champion to the arena', async ({ page }) => {
  await prepare(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/academy?arena=outpost');
  await expect(metric(page, 'Draft training success')).toHaveText('0/8');
  await page.getByRole('button', { name: 'Evaluate champion', exact: true }).click();
  await expect(metric(page, 'Evaluation success')).toHaveText('0/8');
  await expect(page.getByText('Energy ran out. Prioritize rest before default movement.', { exact: true })).toBeVisible();
  await page.getByLabel('Controller replay tick', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect.poll(async () => Number(await page.getByLabel('Controller replay tick', { exact: true }).inputValue())).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause academy', exact: true }).click();
  const tick = await page.getByLabel('Controller replay tick', { exact: true }).inputValue();
  await page.waitForTimeout(300); await expect(page.getByLabel('Controller replay tick', { exact: true })).toHaveValue(tick);
  await page.getByRole('button', { name: 'Resume academy', exact: true }).click();
  await page.getByRole('button', { name: 'Train controller', exact: true }).click();
  await expect(metric(page, 'Search generations')).toHaveText('6');
  await expect(metric(page, 'Champion training success')).toHaveText('8/8');
  await page.getByRole('button', { name: 'Evaluate champion', exact: true }).click();
  await expect(metric(page, 'Evaluation success')).toHaveText('8/8');
  const policy = (await saved(page)).academy.controllers.outpost.champion;
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export champion', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('brain-sweat-outpost-policy.json');
  await page.getByRole('link', { name: 'Open arena', exact: true }).click();
  await page.getByRole('button', { name: 'Load academy champion', exact: true }).click();
  expect((await saved(page)).checkpoints['outpost/explorer/0'].state.model.rules).toEqual(policy);
  await page.getByRole('button', { name: 'Run full episode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit my trained agent', exact: true })).toBeEnabled();
  expect((await saved(page)).xp).toBe(0); expect(errors).toEqual([]);
});

test('academy: reward learning improves delivery, freezes evaluation, and restores stopped learning', async ({ page }) => {
  await prepare(page); await page.goto('/#/academy?tab=rover');
  await page.getByRole('button', { name: 'Evaluate learned rover', exact: true }).click();
  await expect(metric(page, 'Successful deliveries')).toHaveText('0/20');
  await page.getByRole('button', { name: 'Train 1,000 episodes', exact: true }).click();
  await expect.poll(async () => (await saved(page)).academy.rover.episodes).toBe(1000);
  await expect(page.getByRole('button', { name: 'Evaluate learned rover', exact: true })).toBeEnabled();
  const learned = (await saved(page)).academy.rover;
  await page.getByRole('button', { name: 'Evaluate learned rover', exact: true }).click();
  expect(Number((await metric(page, 'Successful deliveries').innerText()).split('/')[0])).toBeGreaterThanOrEqual(18);
  expect((await saved(page)).academy.rover).toEqual(learned);
  await page.getByLabel('Inspect rover cell', { exact: true }).selectOption('43');
  await page.getByRole('button', { name: 'Return to base', exact: true }).click();
  expect(await page.locator('.q-values dd').allTextContents()).not.toEqual(['0.00', '0.00', '0.00', '0.00']);
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect.poll(async () => Number(await page.getByLabel('Rover replay tick', { exact: true }).inputValue())).toBeGreaterThan(1);
  await page.reload(); await expect(metric(page, 'Learning episodes')).toHaveText('1000');
  await expect(page.getByRole('button', { name: 'Stop rover training', exact: true })).toHaveCount(0);
  expect((await saved(page)).academy.rover).toEqual(learned); expect((await saved(page)).xp).toBe(0);
  await page.getByRole('button', { name: 'Train 1,000 episodes', exact: true }).click();
  await page.getByRole('button', { name: 'Pause academy', exact: true }).click();
  const stopped = (await saved(page)).academy.rover.episodes;
  await page.waitForTimeout(250); expect((await saved(page)).academy.rover.episodes).toBe(stopped);
  await page.getByRole('button', { name: 'Stop rover training', exact: true }).click();
  await page.getByRole('button', { name: 'Resume academy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Train 1,000 episodes', exact: true })).toBeEnabled();
});

test('academy: profile isolation and strict backups preserve learning without player rewards', async ({ page }) => {
  await prepare(page); await page.goto('/#/academy');
  await page.getByRole('button', { name: 'Train controller', exact: true }).click();
  await expect(metric(page, 'Search generations')).toHaveText('6');
  const academy = (await saved(page)).academy;
  await page.getByLabel('Import academy', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, academy: { ...academy, extra: true } })) });
  await expect(page.getByText('Invalid academy save.', { exact: true })).toBeVisible();
  expect((await saved(page)).academy).toEqual(academy);
  await page.goto('/#/settings'); const original = await page.getByLabel('Active profile', { exact: true }).inputValue();
  await page.getByLabel('Profile nickname', { exact: true }).fill('Agent learner');
  await page.getByRole('button', { name: 'Add local profile', exact: true }).click();
  expect((await saved(page)).academy.controllers).toEqual({});
  await page.goto('/#/academy');
  await page.getByLabel('Import academy', { exact: true }).setInputFiles({ name: 'academy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, academy })) });
  await expect(page.getByText('Academy imported. Training and replays resume stopped.', { exact: true })).toBeVisible();
  expect((await saved(page)).academy).toEqual(academy); expect((await saved(page)).xp).toBe(0);
  await page.goto('/#/settings'); await page.getByLabel('Active profile', { exact: true }).selectOption(original);
  expect((await saved(page)).academy).toEqual(academy);
});

test('academy: Spanish learning classes, populated reports, keyboard tabs, and narrow layouts stay accessible', async ({ page }) => {
  test.setTimeout(90000); await prepare(page, 'es'); await page.goto('/#/class/agent-rewards');
  await expect(page.getByRole('heading', { name: 'Agentes: aprender valores de acciones con recompensas', exact: true })).toBeVisible();
  const course = courses.find(c => c.id === 'agent-rewards')!;
  for (let i = 0; i < 3; i++) await page.locator('.knowledge-check').nth(i).locator('input').nth(course.questions[i].correct).check();
  await page.getByRole('button', { name: 'Comprobar lo aprendido', exact: true }).click();
  await page.getByRole('link', { name: 'Probar en la academia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Academia de agentes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Entrenar controlador', exact: true }).click();
  await expect(metric(page, 'Generaciones de búsqueda')).toHaveText('6');
  await page.getByRole('button', { name: 'Evaluar campeón', exact: true }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth, overflow: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map(e => ({ element: e.tagName, class: e.className, text: e.textContent?.slice(0, 80) })) }));
    expect(layout.width, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(layout.viewport);
  }
  await audit(page);
  const controllerTab = page.getByRole('tab', { name: 'Laboratorio de controladores', exact: true });
  await controllerTab.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Rover de aprendizaje', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Evaluar rover aprendido', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await audit(page);
  await page.getByRole('tab', { name: 'Rover de aprendizaje', exact: true }).focus(); await page.keyboard.press('Home');
  await expect(controllerTab).toBeFocused();
  expect((await saved(page)).classes['agent-rewards'].best).toBe(100); expect((await saved(page)).xp).toBe(0);
});

test('academy: real shadow rendering and stereo audio work, mute, and release graphics resources', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'GPU and audio instrumentation is measured in Chromium; other engines verify learning and fallback.');
  await prepare(page);
  await page.addInitScript(() => {
    const gpu = { shadows: 0, draws: 0, errors: [] as number[], colors: 0, textures: 0, freedTextures: 0, programs: 0, freedPrograms: 0 };
    const proto = WebGL2RenderingContext.prototype, draw = proto.drawArrays;
    proto.drawArrays = function (...args) {
      draw.apply(this, args); if (this.getParameter(this.FRAMEBUFFER_BINDING)) gpu.shadows++;
      else { gpu.draws++; if (!gpu.colors) { const pixels = new Uint8Array(8 * 8 * 4); this.readPixels(Math.floor(this.canvas.width / 2), Math.floor(this.canvas.height / 2), 8, 8, this.RGBA, this.UNSIGNED_BYTE, pixels); gpu.colors = new Set(Array.from({ length: 64 }, (_, i) => pixels.slice(i * 4, i * 4 + 3).join(','))).size; } }
      const error = this.getError(); if (error) gpu.errors.push(error);
    };
    const texture = proto.createTexture, removeTexture = proto.deleteTexture, program = proto.createProgram, removeProgram = proto.deleteProgram;
    proto.createTexture = function () { gpu.textures++; return texture.call(this); };
    proto.deleteTexture = function (value) { gpu.freedTextures++; removeTexture.call(this, value); };
    proto.createProgram = function () { gpu.programs++; return program.call(this); };
    proto.deleteProgram = function (value) { gpu.freedPrograms++; removeProgram.call(this, value); };
    const audio = { gains: [] as GainNode[], starts: 0, pans: [] as StereoPannerNode[], analyzer: undefined as AnalyserNode | undefined };
    const ap = AudioContext.prototype, gain = ap.createGain, panner = ap.createStereoPanner, compressor = ap.createDynamicsCompressor, start = OscillatorNode.prototype.start;
    ap.createGain = function () { const node = gain.call(this); audio.gains.push(node); return node; };
    ap.createStereoPanner = function () { const node = panner.call(this); audio.pans.push(node); return node; };
    OscillatorNode.prototype.start = function (...args) { audio.starts++; start.apply(this, args); };
    ap.createDynamicsCompressor = function () {
      const node = compressor.call(this), analyzer = this.createAnalyser(), connect = node.connect.bind(node); audio.analyzer = analyzer;
      node.connect = ((target: AudioNode) => { connect(analyzer); analyzer.connect(target); return target; }) as typeof node.connect;
      return node;
    };
    Object.assign(window, { __academyGPU: gpu, __academyAudio: audio });
  });
  await page.goto('/#/academy');
  await expect(page.locator('canvas[data-renderer=webgl2]')).toBeVisible();
  const gpu = () => page.evaluate(() => (window as unknown as { __academyGPU: { shadows: number; draws: number; colors: number; errors: number[]; textures: number; freedTextures: number; programs: number; freedPrograms: number } }).__academyGPU);
  await expect.poll(async () => (await gpu()).shadows).toBeGreaterThan(0);
  expect((await gpu()).draws).toBeGreaterThan(0); expect((await gpu()).colors).toBeGreaterThan(1); expect((await gpu()).errors).toEqual([]);
  await page.goto('/#/settings'); await page.getByRole('switch', { name: /^Mute all/ }).uncheck();
  await page.getByRole('slider', { name: /^Music/ }).fill('0.4');
  await page.goto('/#/academy'); await page.getByLabel('Simulation sound', { exact: true }).check();
  const level = () => page.evaluate(() => { const a = (window as unknown as { __academyAudio: { analyzer?: AnalyserNode; starts: number; pans: StereoPannerNode[]; gains: GainNode[] } }).__academyAudio; const bytes = new Uint8Array(2048); a.analyzer?.getByteTimeDomainData(bytes); return { peak: Math.max(...Array.from(bytes, n => Math.abs(n - 128))), starts: a.starts, pans: a.pans.map(n => n.pan.value), master: a.gains[0].gain.value }; });
  await expect.poll(async () => (await level()).peak).toBeGreaterThan(1);
  expect((await level()).starts).toBeGreaterThan(3); await expect.poll(async () => (await level()).pans.some(n => n !== 0)).toBe(true);
  await page.goto('/#/settings'); await page.getByRole('switch', { name: /^Mute all/ }).check();
  await expect.poll(async () => (await level()).master).toBeLessThan(0.001);
  await expect.poll(async () => (await level()).peak).toBeLessThanOrEqual(1);
  expect((await gpu()).freedTextures).toBe((await gpu()).textures); expect((await gpu()).freedPrograms).toBe((await gpu()).programs);
});

test('academy: vector fallback still trains and evaluates when WebGL is unavailable', async ({ page }) => {
  await prepare(page); await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...args) { if (args[0] === 'webgl2') return null; return original.apply(this, args as Parameters<typeof original>); } as typeof original; });
  await page.goto('/#/academy?tab=rover'); await expect(page.getByText('VECTOR VIEW', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Train 1,000 episodes', exact: true }).click();
  await expect(metric(page, 'Learning episodes')).toHaveText('1000');
  await page.getByRole('button', { name: 'Evaluate learned rover', exact: true }).click();
  expect(Number((await metric(page, 'Successful deliveries').innerText()).split('/')[0])).toBeGreaterThanOrEqual(18);
});
