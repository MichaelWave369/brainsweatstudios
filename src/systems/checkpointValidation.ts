import type { Checkpoint, Difficulty, GameId, Json } from '../data/types';

type Validator = (value: unknown) => boolean;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && [null, Object.prototype].includes(Object.getPrototypeOf(v));
const number = (min = 0, max = 1e7): Validator => v => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (min = 0, max = 1e7): Validator => v => number(min, max)(v) && Number.isInteger(v);
const text: Validator = v => typeof v === 'string' && v.length <= 12000;
const boolean: Validator = v => typeof v === 'boolean';
const oneOf = (values: readonly unknown[]): Validator => v => values.includes(v);
const array = (item: Validator, max = 300, length?: number, unique = false): Validator => v => Array.isArray(v) && v.length <= max && (length === undefined || v.length === length) && (!unique || new Set(v).size === v.length) && Array.from(v).every(item);
const shape = (fields: Record<string, Validator>, optional: string[] = []): Validator => v => object(v) && Object.keys(v).every(k => Object.hasOwn(fields, k)) && Object.entries(fields).every(([k, test]) => optional.includes(k) && v[k] === undefined || test(v[k]));
const map = (keys: string[], item: Validator, complete = false): Validator => v => object(v) && (!complete || Object.keys(v).length === keys.length) && Object.entries(v).every(([k, value]) => keys.includes(k) && item(value));
const nullable = (test: Validator): Validator => v => v === null || test(v);
const budgetKeys = ['rent', 'food', 'phone', 'transport', 'utilities', 'savings', 'fun'];
const foodKeys = ['grain', 'beans', 'veg', 'fruit', 'eggs', 'yogurt', 'treat'];
const taskKeys = ['statement', 'rent', 'trial', 'food', 'phone', 'appointment', 'receipt'];
const encounterIds = [2, 5, 8, 9, 10, 11];
const outcome = shape({ score: number(0, 100), summary: text, lesson: text, metrics: v => object(v) && Object.keys(v).length <= 32 && Object.values(v).every(value => text(value) || number(-1e7)(value)) }, ['metrics']);
const command = shape({ name: text, moves: v => array(oneOf(['up', 'right', 'down', 'left']), 100)(v) && (v as unknown[]).length > 0, conditional: boolean }, ['conditional']);
const plant = shape({ type: integer(0, 2), moisture: number(0, 100), health: number(0, 100), growth: number(0, 100), light: integer(1, 9) });
// A history item is the actual powerTurn result, rather than the surrounding cash balance.
const powerHistory = shape({ demand: number(), generated: number(), batteryUsed: number(), imported: number(), delivered: number(), stored: number(), cost: number(), coverage: number(0, 1), clean: number(0, 1), charge: number() });
const fieldSlots: Record<string, Validator> = {
  baseOutcome: outcome, extensionStep: integer(0, 2), fieldResources: integer(0, 8), fieldTime: integer(0, 6), fieldTrust: integer(0, 8), fieldLearning: integer(0, 7), extensionWaiting: boolean, extensionFeedback: text, extensionHistory: array(text, 3),
};
const slots: Record<GameId, Record<string, Validator>> = {
  money: { budget: map(budgetKeys, number(0, 100000), true), phase: oneOf(['budget', 'month']), week: integer(0, 3), cash: number(), bank: number(), debt: number(), funLeft: number(), log: array(text, 4) },
  hustle: { tradeIndex: integer(0, 5), started: boolean, day: integer(0, 4), cash: number(-1e7), price: integer(10, 90), capacity: integer(1, 6), equipment: integer(0, 1), satisfaction: number(0, 100), totalRevenue: number(), totalExpenses: number(), taxes: number(), served: integer(), log: array(text, 5) },
  scam: { index: integer(0, 7), selected: array(text, 11, undefined, true), review: nullable(shape({ bucket: oneOf(['safe', 'suspicious', 'verify']), points: number(0, 100) })), total: number(0, 800), correct: integer(0, 8), evidenceFound: integer(0, 88) },
  media: { tokens: integer(0, 6), opened: array(integer(0, 5), 6, undefined, true), pinned: array(integer(0, 5), 6, undefined, true), active: nullable(integer(0, 5)), notice: text },
  fix: { stage: integer(0, 3), mistakes: integer(), notice: text, measurement: number(-1e7), adjustment: integer(0, 100), tool: text },
  code: { queue: v => array(command, 28)(v) && (v as { moves: unknown[] }[]).reduce((n, item) => n + item.moves.length, 0) <= 300, repeat: integer(2, 7), robot: shape({ x: integer(0, 6), y: integer(0, 6) }), running: boolean, cursor: integer(0, 300), moves: integer(0, 300), collisions: integer(), runs: integer(), notice: text },
  career: { stage: integer(0, 2), selected: array(text, 3, undefined, true), booked: array(integer(0, 5), 6, undefined, true), conversation: integer(0, 1), interviewScore: number(0, 200), feedback: text, waiting: boolean },
  food: { stage: integer(0, 2), cart: map(foodKeys, integer(0, 5)), plan: array(integer(-1, 2), 3, 3), storage: map(foodKeys, oneOf(['pantry', 'fridge', 'freezer'])) },
  admin: { planning: boolean, schedule: map(taskKeys, integer(0, 8)), auto: array(oneOf(['rent', 'phone']), 2, undefined, true), day: integer(1, 8), cash: number(-1e7), used: integer(0, 3), done: map(taskKeys, integer(1, 8)), log: array(text, 12), notice: text },
  talk: { goal: text, step: integer(0, 2), calm: number(0, 100), trust: number(0, 100), respect: number(0, 300), listened: boolean, reaction: text, waiting: boolean, history: array(text, 3) },
  power: { turn: integer(0, 5), cash: number(), solar: integer(0, 10), wind: integer(0, 10), batteries: integer(0, 8), stored: number(0, 32 + 1e-8), efficiency: boolean, gridEnabled: boolean, useBattery: boolean, coverage: number(0, 1), history: array(powerHistory, 6), log: array(text, 6) },
  rescue: { position: integer(0, 11), visited: array(integer(0, 11), 12, undefined, true), bag: array(oneOf(['Borrowed phone', 'Water bottle', 'Route map', 'Repair note']), 4, undefined, true), handled: array(oneOf(encounterIds), 6, undefined, true), encounter: nullable(oneOf(encounterIds)), points: number(0, 600), decisions: integer(0, 6), risks: integer(), notice: text, feedback: text, answered: boolean },
  music: { beats: array(integer(0, 3), 16, 16), notes: array(integer(-1, 6), 16, 16), tempo: integer(80, 160), listened: integer(), edits: integer(), notice: text },
  frequency: { round: integer(0, 4), hz: integer(100, 1200), wave: oneOf(['sine', 'triangle']), points: number(0, 500), experiments: integer(), notice: text },
  botany: { plants: array(plant, 3), cash: integer(0, 28), day: integer(0, 5), started: boolean, water: array(integer(0, 2), 3, 3), reservoir: integer(0, 28), drainage: boolean, mulch: boolean, observed: boolean, observations: integer(0, 6), notice: text },
};

export function validJson(v: unknown, depth = 0): v is Json {
  if (depth > 8) return false;
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'string') return v.length <= 12000;
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= 1e7;
  if (Array.isArray(v)) return v.length <= 300 && Array.from(v).every(item => validJson(item, depth + 1));
  return object(v) && Object.keys(v).length <= 100 && Object.entries(v).every(([k, val]) => !['__proto__', 'constructor', 'prototype'].includes(k) && validJson(val, depth + 1));
}
export function parseSessionKey(key: string): { game: GameId; difficulty: Difficulty; mission: number } | null {
  const match = /^(money|hustle|scam|media|fix|code|career|food|admin|talk|power|rescue|music|frequency|botany)\/(explorer|builder|master)\/([0-7])$/.exec(key);
  return match ? { game: match[1] as GameId, difficulty: match[2] as Difficulty, mission: Number(match[3]) } : null;
}
export function validSlot(game: string, key: string, value: unknown, difficulty?: string, mission?: number): boolean {
  if (!Object.hasOwn(slots, game) || !validJson(value)) return false;
  const rules = slots[game as GameId]; const field = Object.hasOwn(fieldSlots, key);
  if (field) return !['music', 'frequency', 'botany'].includes(game) && (mission === undefined || mission >= 5) && fieldSlots[key](value);
  if (!Object.hasOwn(rules, key) || !rules[key](value)) return false;
  const d = Math.max(0, ['explorer', 'builder', 'master'].indexOf(difficulty || 'master'));
  if (game === 'scam' && key === 'index') return integer(0, [5, 6, 7][d])(value);
  if (game === 'frequency' && key === 'round') return integer(0, [2, 3, 4][d])(value);
  if (game === 'code' && key === 'robot') return shape({ x: integer(0, 4 + d), y: integer(0, 4 + d) })(value);
  if (game === 'code' && key === 'repeat') return integer(2, 5 + d)(value);
  return true;
}
export function validateCheckpoints(raw: unknown): Record<string, Checkpoint> {
  if (!object(raw) || Object.keys(raw).length > 360) throw new Error('Invalid mission checkpoints.');
  const result: Record<string, Checkpoint> = {};
  for (const [key, entry] of Object.entries(raw)) {
    const session = parseSessionKey(key);
    if (!session || !object(entry) || !object(entry.state) || typeof entry.botPractice !== 'boolean' || typeof entry.updatedAt !== 'string' || !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error('Invalid mission checkpoint identifiers.');
    if (Object.keys(entry.state).length > 60 || !Object.entries(entry.state).every(([field, value]) => validSlot(session.game, field, value, session.difficulty, session.mission))) throw new Error('A mission checkpoint is damaged. Current progress is unchanged.');
    // These phases need a nonempty selection; otherwise their final averages divide by zero.
    if (session.game === 'botany' && entry.state.started === true && (!Array.isArray(entry.state.plants) || entry.state.plants.length < 2)) throw new Error('A planted garden checkpoint needs at least two pots.');
    if (session.game === 'food' && typeof entry.state.stage === 'number' && entry.state.stage > 0 && (!object(entry.state.cart) || !Object.values(entry.state.cart).some(v => Number(v) > 0))) throw new Error('A meal-plan checkpoint needs a grocery basket.');
    result[key] = { state: JSON.parse(JSON.stringify(entry.state)) as Record<string, Json>, botPractice: entry.botPractice, updatedAt: entry.updatedAt };
  }
  return result;
}
