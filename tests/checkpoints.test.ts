import { machineStart, robotStart, trailStart, waterStart, isAdvanced } from '../src/games/advanced/models';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Difficulty, GameId, Json } from '../src/data/types';
import { freshSave, recordResult, SAVE_KEY, validateSave } from '../src/systems/progress';
import { parseSessionKey, validJson, validSlot, validateCheckpoints } from '../src/systems/checkpointValidation';
import { powerTurn } from '../src/games/PowerGrid';

const files: Record<GameId, string> = { money: 'MoneyMission', hustle: 'SideHustle', scam: 'ScamShield', media: 'MediaDetective', fix: 'FixItLab', code: 'CodeQuest', career: 'CareerForge', food: 'FoodFuel', admin: 'LifeAdmin', talk: 'TalkItOut', power: 'PowerGrid', rescue: 'RealWorldRescue', music: 'MusicMaker', frequency: 'FrequencyLab', botany: 'BotanyGarden', math:'advanced/STEMWorlds', geometry:'advanced/STEMWorlds', calculus:'advanced/STEMWorlds', physics:'advanced/STEMWorlds', engine:'advanced/Builders', robot:'advanced/Builders', vm:'advanced/Builders', trail:'advanced/LifeWorlds', water:'advanced/LifeWorlds', kitchen:'advanced/LifeWorlds', creator:'advanced/CreatorStudio' };
const modes: Difficulty[] = ['explorer', 'builder', 'master'];
const date = '2026-10-03T03:00:00.000Z';
const power = powerTurn({ solar: 2, wind: 1, sun: 0.8, breeze: 0.4, demand: 8, stored: 2, capacity: 4, useBattery: true, gridEnabled: true, cash: 38, efficiency: false });
function states(difficulty: Difficulty): Record<GameId, Record<string, Json>> {
  const d = modes.indexOf(difficulty);
  const stem={answer:'4',parameter:3,tested:1,correct:true,feedback:'Matched.'};
  return {
    math:{model:stem},geometry:{model:stem},calculus:{model:stem},physics:{model:stem},
    engine:{model:{config:{type:'piston',cylinders:4,throttle:65,gear:3,cooling:4,load:20},parts:['Power source'],runs:1,tested:true,history:[1000]}},
    robot:{model:JSON.parse(JSON.stringify({config:{motor:2,battery:50,sensor:1,wheels:'grip'},parts:['Chassis'],program:['F'],robot:robotStart(50),tests:1}))},
    vm:{model:JSON.parse(JSON.stringify({config:{ram:4,disk:4,clock:1},parts:['CPU'],program:'SET 2\nOUT\nHALT',machine:machineStart({ram:4,disk:4,clock:1}),boots:1}))},
    trail:{model:JSON.parse(JSON.stringify(trailStart(d)))},
    water:{model:JSON.parse(JSON.stringify({config:{filter:true,treatment:true,sealed:true,chemical:false,leak:10,inflow:20},network:waterStart(),notice:''}))},
    kitchen:{model:{ingredients:['Vegetables'],servings:4,heat:100,stir:true,fridge:3,pot:{temperature:70.35,minutes:10,stirred:10,burned:false},measured:true}},
    creator:{model:{scenes:['Opening title'],captions:true,privacy:false,moderation:false,voice:-10,music:-24,bitrate:6,fps:30,rehearsals:1}},
    money: { budget: { rent: 460, food: 180, phone: 30, transport: 70, utilities: 65, savings: 160, fun: 70 }, phase: 'month', week: 1, cash: 430, bank: 160, debt: 24, funLeft: 70, log: ['Week 1: compared alternatives.'] },
    hustle: { tradeIndex: 5, started: true, day: 3, cash: 194.5, price: 38, capacity: 3, equipment: 1, satisfaction: 94, totalRevenue: 228, totalExpenses: 112, taxes: 16, served: 6, log: ['Day 1: opened.', 'Day 2: adjusted.', 'Day 3: tried again.'] },
    scam: { index: 3, selected: ['Asks for a password', 'Unexpected request'], review: { bucket: 'suspicious', points: 73.33333333333333 }, total: 273.3333333333333, correct: 3, evidenceFound: 5 },
    media: { tokens: 1, opened: [0, 1, 2], pinned: [0, 2], active: 2, notice: '' },
    fix: { stage: 3, mistakes: 1, notice: 'The tool matches the task.', measurement: 230, adjustment: 55, tool: 'Model weather strip' },
    code: { queue: [{ name: '→', moves: ['right'] }, { name: '→ ×3', moves: ['right', 'right', 'right'] }, { name: 'if clear ↑', moves: ['up'], conditional: true }, { name: 'route()', moves: ['up', 'right', 'up'] }], repeat: 2 + d, robot: { x: 2, y: 4 + d }, running: true, cursor: 2, moves: 2, collisions: 0, runs: 2, notice: 'Program running. Watch the robot test your plan.' },
    career: { stage: 2, selected: ['Helped organize a club supply shelf.', 'Arrived on time for a volunteer event.', 'Explained a game calmly to a new player.'], booked: [0, 2, 4], conversation: 1, interviewScore: 100, feedback: 'A clear example.', waiting: true },
    food: { stage: 2, cart: { grain: 1, beans: 1, veg: 1, fruit: 1, yogurt: 0 }, plan: [0, 0, 0], storage: { grain: 'pantry', beans: 'pantry', veg: 'freezer', fruit: 'pantry' } },
    admin: { planning: false, schedule: { statement: 1, rent: 3, trial: 4, food: 4, phone: 5, appointment: 6, receipt: 7 }, auto: ['rent', 'phone'], day: 5, cash: -4, used: 1, done: { statement: 1, rent: 3, food: 4 }, log: ['Statement checked.', 'Rent paid.', 'The unused trial renewed.'], notice: 'Keep room for obligations.' },
    talk: { goal: 'A clear boundary', step: 2, calm: 85, trust: 91, respect: 300, listened: true, reaction: 'A boundary can be clear.', waiting: true, history: ['I can explain my view.', 'Let’s pause.', 'Here is my next step.'] },
    power: { turn: 2, cash: 65.25, solar: 2, wind: 1, batteries: 1, stored: power.stored, efficiency: false, gridEnabled: true, useBattery: true, coverage: power.coverage, history: [power, power], log: ['Turn 1: weather tested.', 'Turn 2: funding received.'] },
    rescue: { position: 5, visited: [0, 1, 2, 3, 7, 10, 9, 5], bag: ['Borrowed phone', 'Route map'], handled: [2, 10, 9], encounter: 5, points: 300, decisions: 3, risks: 1, notice: 'Map desk is on your route.', feedback: '', answered: false },
    music: { beats: Array.from({ length: 16 }, (_, i) => i % 4 === 0 ? 1 : i % 4 === 2 ? 2 : 0), notes: [0, -1, 2, -1, 4, -1, 3, -1, 0, -1, 1, -1, 5, -1, 4, -1], tempo: 120, listened: 2, edits: 3, notice: 'A phrase is ready.' },
    frequency: { round: 1, hz: 440, wave: 'triangle', points: 99.1, experiments: 3, notice: 'Target matched.' },
    botany: { plants: [{ type: 0, moisture: 58.25, health: 84.5, growth: 24.5, light: 6 }, { type: 1, moisture: 52.75, health: 82.25, growth: 20, light: 3 }, { type: 2, moisture: 55, health: 83, growth: 22, light: 7 }], cash: 1, day: 4, started: true, water: [1, 0, 2], reservoir: 18, drainage: true, mulch: true, observed: true, observations: 4, notice: 'Soil observed.' },
  };
}
const field: Record<string, Json> = { baseOutcome: { score: 94, summary: 'The base experiment is complete.', lesson: 'Use a realistic plan.', metrics: { 'Base observations': 3, 'Needs covered': '100%' } }, extensionStep: 1, fieldResources: 5, fieldTime: 3, fieldTrust: 5, fieldLearning: 4, extensionWaiting: true, extensionFeedback: 'A small test preserved resources.', extensionHistory: ['Start with a small reusable plan', 'Share resources and test a small step'] };
const checkpointEntry = (state: Record<string, Json>, botPractice = false) => ({ state, updatedAt: date, botPractice });
const saveWith = (key: string, state: Record<string, Json>) => ({ ...freshSave(), checkpoints: { [key]: checkpointEntry(state) } });
function memoryStorage() {
  const values = new Map<string, string>();
  let fail = false;
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (fail) throw new Error('Storage is full.'); values.set(key, value); }, removeItem: (key: string) => values.delete(key), clear: () => values.clear(), failWrites: () => { fail = true; } };
}
let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => { vi.resetModules(); storage = memoryStorage(); vi.stubGlobal('localStorage', storage); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('checkpoint schemas and migration', () => {
  it('covers every state field authored in all twenty-six worlds and field missions', () => {
    const fixtures = states('master');
    for (const [game, file] of Object.entries(files)) {
      const source = readFileSync(new URL(`../src/games/${file}.tsx`, import.meta.url), 'utf8');
      const names = [...source.matchAll(/useMissionState(?:<[\s\S]*?>)?\('([^']+)'/g)].map(match => match[1]);
      expect([...new Set(names)].sort(), `${game} fixture must cover all hook fields`).toEqual(Object.keys(fixtures[game as GameId]).sort());
    }
    const source = readFileSync(new URL('../src/games/FieldMission.tsx', import.meta.url), 'utf8');
    const names = [...source.matchAll(/useMissionState(?:<[\s\S]*?>)?\('([^']+)'/g)].map(match => match[1]);
    expect(names.sort()).toEqual(Object.keys(field).filter(k => k !== 'baseOutcome').sort());
  });
  it('roundtrips all 624 world/mode/mission checkpoint slots without losing fractional model state', () => {
    const save = freshSave();
    for (const difficulty of modes) for (const [game, state] of Object.entries(states(difficulty))) for (let mission = 0; mission < 8; mission++) {
      save.checkpoints[`${game}/${difficulty}/${mission}`] = checkpointEntry({ ...state, ...(mission >= 5 && !isAdvanced(game) && !['music', 'frequency', 'botany'].includes(game) ? field : {}) }, mission % 2 === 1);
    }
    expect(Object.keys(save.checkpoints)).toHaveLength(624);
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
    expect(validSlot('power', 'history', [power])).toBe(true);
    expect(Object.hasOwn(power, 'cash')).toBe(false);
  });
  it('migrates a version 1 save with its awards and accessibility settings intact', () => {
    let save = freshSave();
    for (const game of ['money', 'scam', 'code'] as const) save = recordResult(save, game, 'builder', 0, 100, '2026-10-02').save;
    save.settings.highContrast = true; save.settings.muted = true; save.selectedDifficulty = true;
    const legacySettings = { music: save.settings.music, effects: save.settings.effects, muted: save.settings.muted, reducedMotion: save.settings.reducedMotion, highContrast: save.settings.highContrast, tutorials: save.settings.tutorials };
    const migrated = validateSave({ ...save, version: 1, settings: legacySettings, checkpoints: undefined });
    expect(migrated).toEqual({ ...save, settings: { ...save.settings, locale: 'en', botControl: false, haptics: false }, checkpoints: {} });
  });
  it('rejects coerced versions, modes, record modes, and language enums from imported JSON', () => {
    const save = recordResult(freshSave(), 'money', 'explorer', 0, 80, '2026-10-02').save;
    expect(() => validateSave({ ...save, version: '2' })).toThrow();
    expect(() => validateSave({ ...save, difficulty: ['explorer'] })).toThrow();
    expect(() => validateSave({ ...save, records: { 'money/explorer/0': { ...save.records['money/explorer/0'], difficulty: ['explorer'] } } })).toThrow();
    expect(() => validateSave({ ...save, settings: { ...save.settings, locale: ['es'] } })).toThrow();
    expect(() => validateSave({ ...save, settings: { ...save.settings, labPalette: ['amber'] } })).toThrow();
  });
  it.each([
    ['money', 'budget', { rent: 460 }], ['money', 'phase', 'unexpected'], ['money', 'cash', {}],
    ['hustle', 'tradeIndex', 6], ['scam', 'review', 'safe'], ['scam', 'review', { bucket: 'safe' }], ['scam', 'index', 6],
    ['media', 'active', {}], ['media', 'active', 6], ['media', 'pinned', [99]], ['career', 'booked', [6]],
    ['food', 'plan', [99, 0, 0]], ['food', 'plan', []], ['food', 'cart', { unknown: 1 }], ['food', 'storage', { grain: 'outside' }],
    ['admin', 'day', 0], ['admin', 'schedule', { rent: 9 }], ['admin', 'done', { rent: 0 }], ['talk', 'step', 3],
    ['code', 'robot', { x: 5, y: 4 }], ['code', 'queue', [{ name: 'empty', moves: [] }]], ['code', 'queue', [{ name: 'bad', moves: ['teleport'] }]],
    ['power', 'history', [{ ...power, clean: undefined }]], ['rescue', 'encounter', 4], ['rescue', 'encounter', {}],
    ['music', 'notes', Array(16).fill(7)], ['music', 'beats', Array(16).fill(4)], ['music', 'beats', []],
    ['frequency', 'wave', 'invalid'], ['frequency', 'round', 3], ['botany', 'water', [1, 1]], ['botany', 'water', [3, 0, 0]],
    ['botany', 'plants', [{ type: 3, moisture: 50, health: 80, growth: 0, light: 6 }]], ['botany', 'plants', [{ type: 0, moisture: 101, health: 80, growth: 0, light: 6 }]], ['botany', 'day', 6],
  ])('rejects damaged %s/%s state before it can render', (game, key, value) => {
    expect(() => validateSave(saveWith(`${game}/explorer/0`, { [key]: value as Json }))).toThrow();
  });
  it('validates pending base outcomes, including their metrics, only for original-world field missions', () => {
    expect(() => validateSave(saveWith('money/explorer/5', { baseOutcome: field.baseOutcome }))).not.toThrow();
    for (const baseOutcome of [{ score: 101, summary: 'x', lesson: 'x' }, { score: 50, summary: 'x', lesson: 'x', metrics: { invalid: {} } }, { score: 50, summary: 'x' }]) expect(() => validateSave(saveWith('money/explorer/5', { baseOutcome: baseOutcome as unknown as Json }))).toThrow();
    expect(() => validateSave(saveWith('money/explorer/0', { baseOutcome: field.baseOutcome }))).toThrow();
    expect(() => validateSave(saveWith('botany/explorer/5', { baseOutcome: field.baseOutcome }))).toThrow();
  });
  it('rejects unsafe JSON, unknown fields, invalid identifiers, and invalid timestamps', () => {
    expect(validJson(NaN)).toBe(false); expect(validJson(Infinity)).toBe(false); expect(validJson(new Date())).toBe(false);
    expect(validJson(JSON.parse('{"__proto__":{"polluted":true}}'))).toBe(false);
    expect(validJson(Array(301).fill(0))).toBe(false);
    expect(validJson(Array(16))).toBe(false);
    expect(validSlot('money', 'unknown', 1)).toBe(false); expect(validSlot('__proto__', 'unknown', 1)).toBe(false);
    expect(parseSessionKey('money/explorer/8')).toBeNull(); expect(parseSessionKey('money/explorer/01')).toBeNull();
    expect(() => validateCheckpoints({ 'money/explorer/0': { ...checkpointEntry({ cash: 100 }), updatedAt: 'not a date' } })).toThrow();
  });
  it('copies imported checkpoint data so later edits to the input cannot change the live save', () => {
    const raw = saveWith('music/master/7', states('master').music);
    const imported = validateSave(raw);
    (raw.checkpoints['music/master/7'].state.notes as number[])[0] = 6;
    expect((imported.checkpoints['music/master/7'].state.notes as number[])[0]).toBe(0);
  });
  it('rejects empty in-progress garden and meal selections before a final average can become NaN', () => {
    expect(() => validateSave(saveWith('botany/explorer/0', { started: true, plants: [] }))).toThrow();
    expect(() => validateSave(saveWith('botany/explorer/0', { started: true }))).toThrow();
    expect(() => validateSave(saveWith('food/explorer/0', { stage: 2, cart: { grain: 0 } }))).toThrow();
    expect(() => validateSave(saveWith('food/explorer/0', { stage: 1 }))).toThrow();
    expect(() => validateSave(saveWith('botany/explorer/0', { started: false, plants: [] }))).not.toThrow();
    expect(() => validateSave(saveWith('food/explorer/0', { stage: 0, cart: {} }))).not.toThrow();
  });
});

describe('profile checkpoint storage', () => {
  it('loads an existing v1 active save and preserves it when a second profile is added', async () => {
    const old = recordResult(freshSave(), 'code', 'master', 3, 94, '2026-10-02').save;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...old, version: 1 }));
    const profiles = await import('../src/systems/profiles');
    const first = profiles.currentProfile();
    expect(first.save).toEqual(old);
    profiles.addProfile('New explorer');
    expect(profiles.getBundle().profiles.find(p => p.id === first.id)?.save).toEqual(old);
    expect(profiles.currentProfile().save.xp).toBe(0);
    expect(profiles.validateBundle(JSON.parse(storage.getItem(profiles.PROFILE_KEY)!))).toEqual(profiles.getBundle());
  });
  it('isolates profile checkpoints, ignores a previous profile’s queued write, and clears only the completed checkpoint', async () => {
    const p = await import('../src/systems/profiles');
    const firstId = p.currentProfile().id;
    p.writeCheckpoint('money/explorer/0', 'cash', 500, firstId); p.markBotPractice('money/explorer/0');
    expect(p.checkpoint('money/explorer/0')?.botPractice).toBe(true);
    p.addProfile('Second'); const secondId = p.currentProfile().id;
    p.writeCheckpoint('money/explorer/0', 'cash', 777, firstId);
    expect(p.checkpoint('money/explorer/0')).toBeUndefined();
    p.writeCheckpoint('money/explorer/0', 'cash', 300, secondId);
    expect(p.checkpoint('money/explorer/0', firstId)?.state.cash).toBe(500);
    p.switchProfile(firstId); const practice = p.finishMission('money', 'explorer', 0, 80);
    expect(practice.xpGain).toBe(0); expect(p.currentProfile().save.records).toEqual({}); expect(p.checkpoint('money/explorer/0')).toBeUndefined();
    p.writeCheckpoint('money/explorer/1', 'cash', 400); p.finishMission('money', 'explorer', 1, 80);
    expect(p.checkpoint('money/explorer/1')).toBeUndefined(); expect(p.currentProfile().save.xp).toBe(80);
    p.resetProfile(); p.switchProfile(secondId);
    expect(p.currentProfile().save.xp).toBe(0); expect(p.checkpoint('money/explorer/0')?.state.cash).toBe(300);
  });
  it('persists valid checkpoints without rerendering the whole app and rejects invalid writes', async () => {
    const p = await import('../src/systems/profiles'); const revision = p.getRevision();
    p.writeCheckpoint('power/builder/0', 'history', [power]);
    expect(p.getRevision()).toBe(revision);
    const persisted = validateSave(JSON.parse(storage.getItem(SAVE_KEY)!));
    expect(persisted.checkpoints['power/builder/0'].state.history).toEqual([power]);
    p.writeCheckpoint('money/explorer/9', 'cash', 100); p.markBotPractice('__proto__'); p.writeCheckpoint('food/master/0', 'plan', [99, 0, 0]);
    expect(Object.keys(p.currentProfile().save.checkpoints)).toEqual(['power/builder/0']);
    expect(p.checkpoint('__proto__')).toBeUndefined();
  });
  it('leaves current progress untouched when importing malformed checkpoints or an invalid profile bundle', async () => {
    const p = await import('../src/systems/profiles'); p.finishMission('code', 'master', 2, 90);
    const before = JSON.parse(JSON.stringify(p.getBundle()));
    expect(() => p.importSave(saveWith('media/explorer/0', { active: {} }))).toThrow();
    expect(p.getBundle()).toEqual(before);
    expect(() => p.validateBundle({ ...before, active: 'missing' })).toThrow();
    expect(() => p.validateBundle({ ...before, profiles: [before.profiles[0], before.profiles[0]] })).toThrow();
  });
  it('restores the active legacy backup after a damaged profile bundle, retaining the damaged text for recovery', async () => {
    const expected = recordResult(freshSave(), 'scam', 'builder', 1, 91, '2026-10-02').save;
    storage.setItem('brain-sweat-studio:profiles:v2', '{damaged'); storage.setItem(SAVE_KEY, JSON.stringify(expected));
    const p = await import('../src/systems/profiles');
    expect(p.currentProfile().save).toEqual(expected); expect(p.getWarning()).toMatch(/could not be read/);
    expect(storage.getItem(`${p.PROFILE_KEY}:recovery`)).toBe('{damaged');
    p.updateSettings({ locale: 'es' }); expect(validateSave(JSON.parse(storage.getItem(SAVE_KEY)!)).settings.locale).toBe('es');
  });
  it('keeps a usable in-memory save when storage becomes unavailable', async () => {
    const p = await import('../src/systems/profiles'); p.getBundle(); storage.failWrites();
    p.writeCheckpoint('music/explorer/0', 'tempo', 120);
    expect(p.currentProfile().save.checkpoints['music/explorer/0'].state.tempo).toBe(120);
    expect(p.getWarning()).toMatch(/cannot keep a local save/);
  });
  it('enforces six local slots while leaving existing profiles intact', async () => {
    const p = await import('../src/systems/profiles');
    for (let n = 2; n <= 6; n++) p.addProfile(`Explorer ${n}`);
    const before = JSON.parse(JSON.stringify(p.getBundle()));
    expect(() => p.addProfile('Seventh')).toThrow(); expect(p.getBundle()).toEqual(before);
  });
  it('restores robot state with automatic movement paused, and restores typed nullable states', async () => {
    const p = await import('../src/systems/profiles');
    const { MissionSession, useMissionState } = await import('../src/systems/MissionSession');
    p.importSave(saveWith('code/explorer/0', states('explorer').code));
    let captured: Record<string, unknown> = {};
    function RobotProbe() {
      const [queue] = useMissionState('queue', []);
      const [robot] = useMissionState('robot', { x: 0, y: 4 });
      const [running] = useMissionState('running', false);
      const [cursor] = useMissionState('cursor', 0);
      captured = { queue, robot, running, cursor }; return null;
    }
    renderToString(createElement(MissionSession, { sessionKey: 'code/explorer/0', children: createElement(RobotProbe) }));
    expect(captured).toEqual({ queue: states('explorer').code.queue, robot: { x: 2, y: 4 }, running: false, cursor: 2 });
    p.importSave(saveWith('scam/builder/0', states('builder').scam));
    let review: unknown;
    function ReviewProbe() { const [value] = useMissionState('review', null); review = value; return null; }
    renderToString(createElement(MissionSession, { sessionKey: 'scam/builder/0', children: createElement(ReviewProbe) }));
    expect(review).toEqual(states('builder').scam.review);
  });
});
