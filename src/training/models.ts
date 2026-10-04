import { freshCareer, validateCareer } from '../career/validation.ts';
import type { CareerSave } from '../career/types.ts';
import { freshCircuit, validateCircuit } from '../circuit/evidence.ts';
import type { CircuitSave } from '../circuit/types.ts';
import { assertData } from '../worlds/compiler.ts';
import { freshWorldSave, validateWorldSave, type WorldSave } from '../worlds/notebook';
import { freshGarage, validateGarage, type GarageSave } from '../agents/notebook.ts';
import { freshLab, validateLab, type LabSave } from '../runtime/notebook.ts';
import { randomStep, Q_ROWS, roverMoves, greedyAction, type RoverEpisode } from '../runtime/roverRules.ts';
export * from '../runtime/roverRules.ts';
import { AGENT_IDS, type ArenaKind, type ArenaState, type PolicyRule } from '../games/rung4/models';
import { configuration, createEnvironment } from '../runtime/environment.ts';
import { ruleController } from '../runtime/controllers.ts';
import type { Variant } from '../runtime/types.ts';
import { runHeadless } from '../runtime/receipts.ts';
import { parsePolicy } from '../games/rung4/validation';

export const arenaTitles: Record<ArenaKind, string> = { sports: 'Sport Bot Arena', outpost: 'Survival Agent Outpost', scenario: 'Scenario Agent Dispatch', space: 'Space Agent Rendezvous' };
export interface Trial { seed: number; status: ArenaState['status']; score: number; ticks: number; collisions: number; energy: number; water: number }
export interface Assessment { trials: Trial[]; successes: number; score: number; ticks: number; worst: number }
export interface SearchPoint { generation: number; successes: number; score: number; ticks: number }
export interface ControllerRecord { draft: PolicyRule[]; champion: PolicyRule[]; stage: number; seed: number; history: SearchPoint[] }
export interface RoverPoint { episode: number; successes: number; reward: number }
export interface RoverRecord { mode: 'courier' | 'storm'; episodes: number; random: number; q: number[][]; history: RoverPoint[] }
export interface AcademySave { controllers: Partial<Record<ArenaKind, ControllerRecord>>; rover: RoverRecord; lab: LabSave; garage: GarageSave; worlds: WorldSave; career: CareerSave; circuit: CircuitSave }

export function splitSeeds(seed: number, heldOut = false) { return Array.from({ length: 8 }, (_, i) => (heldOut ? 20000 : 1000) + seed * 101 + i * 17); }
export function assess(kind: ArenaKind, rules: PolicyRule[], stage: number, seeds: number[], variant: Variant = 'standard'): Assessment {
  const trials = seeds.map(seed => {
    const trial = runHeadless(configuration(kind, seed, stage, variant), ruleController(rules)), e = trial.snapshot.state as ArenaState;
    return { seed, status: e.status, score: trial.result.score, ticks: e.tick, collisions: e.collisions, energy: e.energy, water: e.water };
  });
  return { trials, successes: trials.filter(e => e.status === 'complete').length, score: trials.reduce((s, e) => s + e.score, 0) / trials.length, ticks: trials.reduce((s, e) => s + e.ticks, 0) / trials.length, worst: Math.min(...trials.map(e => e.score)) };
}
export function better(a: Assessment, b: Assessment) { return a.successes > b.successes || a.successes === b.successes && (a.score > b.score || a.score === b.score && a.ticks < b.ticks); }
const usefulRules: PolicyRule[] = [
  { when: 'low-energy', action: 'rest' }, { when: 'low-water', action: 'refill' },
  { when: 'at-objective', action: 'interact' }, { when: 'docking-window', action: 'interact' },
  { when: 'fast-approach', action: 'brake' }, { when: 'always', action: 'approach' },
];
// A bounded neighborhood search, not a language model. All candidates are
// evaluated on the training split; no evaluation seed enters this function.
export function searchGeneration(kind: ArenaKind, rules: PolicyRule[], stage: number, seed: number, options: { seeds?: number[]; variant?: Variant } = {}) {
  const candidates: PolicyRule[][] = [rules];
  for (const rule of usefulRules) {
    if (rules.length < 8) candidates.push([rule, ...rules], [...rules.slice(0, -1), rule, rules[rules.length - 1]]);
    for (let i = 0; i < rules.length; i++) candidates.push(rules.map((r, j) => i === j ? rule : r));
  }
  for (let i = 0; i < rules.length; i++) {
    if (rules.length > 1) candidates.push(rules.filter((_, j) => i !== j));
    if (i > 0) { const swap = [...rules]; [swap[i - 1], swap[i]] = [swap[i], swap[i - 1]]; candidates.push(swap); }
  }
  let champion = rules.map(r => ({ ...r })), report = assess(kind, champion, stage, options.seeds || splitSeeds(seed), options.variant);
  const unique = new Set([JSON.stringify(rules)]);
  for (const candidate of candidates) {
    const key = JSON.stringify(candidate); if (unique.has(key)) continue; unique.add(key);
    const result = assess(kind, candidate, stage, options.seeds || splitSeeds(seed), options.variant);
    if (better(result, report)) { champion = candidate.map(r => ({ ...r })); report = result; }
  }
  return { champion, report, candidates: unique.size };
}
export function failureAdvice(kind: ArenaKind, trial?: Trial) {
  if (!trial) return 'Run an evaluation to inspect a trial.';
  if (trial.status === 'complete') return 'Goal reached. Compare ticks, collisions, and remaining reserves before making the controller more aggressive.';
  if (trial.collisions > 0) return 'Blocked moves consumed ticks. Inspect the map and the movement rule that kept matching.';
  if (trial.water <= 0 && kind === 'outpost') return 'Water ran out. Put a refill condition before default movement; the station is at (0, 0).';
  if (trial.energy <= 0) return kind === 'space' ? 'Thruster energy ran out. Inspect braking and docking rules before adding more thrust.' : 'Energy ran out. Prioritize rest before default movement.';
  return kind === 'space' ? 'The docking condition never completed. Inspect approach speed and the docking-window rule.' : 'The tick limit arrived first. Check whether interact can match before default movement.';
}

export function roverFresh(mode: RoverRecord['mode'] = 'courier'): RoverRecord { return { mode, episodes: 0, random: 42, q: Array.from({ length: Q_ROWS }, () => [0, 0, 0, 0]), history: [] }; }
// Q-learning: Q(s,a) <- Q(s,a) + alpha * (r + gamma * max Q(s',.) - Q(s,a)).
// Terminal transitions have zero bootstrap. Evaluation never updates the table.
export function trainRover(record: RoverRecord, count = 20, options: { seeds?: number[]; variant?: Variant; difficulty?: number } = {}): RoverRecord {
  const q = record.q.map(row => [...row]); let random = record.random, successes = 0, rewards = 0;
  const n = Math.max(1, Math.min(25, Math.floor(count)));
  for (let i = 0; i < n; i++) {
    const seed = options.seeds ? options.seeds[(record.episodes + i) % options.seeds.length] : (record.episodes + i) % 10000;
    const env = createEnvironment(configuration('rover', seed, options.difficulty || 0, options.variant || 'standard', record.mode));
    const epsilon = Math.max(0.06, 0.55 * Math.exp(-(record.episodes + i) / 400));
    while (!env.isTerminal()) {
      random = randomStep(random); const explore = random / 2 ** 32 < epsilon; random = randomStep(random);
      const observation = env.observe().observationIndex!, action = explore ? Math.floor(random / 2 ** 32 * 4) : greedyAction(q, observation), next = env.step(roverMoves[action]);
      const future = next.result.terminal ? 0 : Math.max(...q[next.observation.observationIndex!]);
      q[observation][action] += 0.25 * (next.reward + 0.97 * future - q[observation][action]);
    }
    successes += Number(env.result().success); rewards += env.result().reward;
  }
  const episodes = record.episodes + n;
  return { ...record, episodes, random, q, history: [...record.history, { episode: episodes, successes: successes / n * 100, reward: rewards / n }].slice(-80) };
}
export function runRover(record: RoverRecord, seed: number) {
  const env = createEnvironment(configuration('rover', seed, 0, 'standard', record.mode)), trace: RoverEpisode['trace'] = [];
  while (!env.isTerminal()) {
    const next = env.step(roverMoves[greedyAction(record.q, env.observe().observationIndex!)]), view = next.observation.state as Omit<RoverEpisode, 'trace' | 'random'>;
    trace.push({ tick: view.tick, x: view.x, y: view.y, action: roverMoves.indexOf(next.executedAction as typeof roverMoves[number]), reward: next.reward, carrying: view.carrying, collision: next.events.some(e => e.type === 'collision') });
  }
  return { ...env.snapshot().state as RoverEpisode, trace };
}
export function evaluateRover(record: RoverRecord) {
  const trials = Array.from({ length: 20 }, (_, i) => runRover(record, 20000 + i * 19));
  return { trials, successes: trials.filter(e => e.status === 'complete').length, ticks: trials.reduce((s, e) => s + e.tick, 0) / trials.length, collisions: trials.reduce((s, e) => s + e.collisions, 0) / trials.length };
}
export const freshAcademy = (): AcademySave => ({ controllers: {}, rover: roverFresh(), lab: freshLab(), garage: freshGarage(), worlds: freshWorldSave(), career: freshCareer(), circuit: freshCircuit() });
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
export function validateAcademy(value: unknown): AcademySave {
  if (value === undefined) return freshAcademy();
  assertData(value, 9000000, 2000000, 40);
  const legacy = object(value) ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'circuit')) : value;
  assertData(legacy, 3000000, 900000, 34);
  const old = object(legacy) ? Object.fromEntries(Object.entries(legacy).filter(([k]) => k !== 'career')) : legacy;
  if (!object(value) || !object(old) || !(keys(old, ['controllers', 'rover']) || keys(old, ['controllers', 'rover', 'lab']) || keys(old, ['controllers', 'rover', 'lab', 'garage']) || keys(old, ['controllers', 'rover', 'lab', 'garage', 'worlds']) || keys(old, ['controllers', 'rover', 'worlds']) || keys(old, ['controllers', 'rover', 'lab', 'worlds'])) || !object(value.controllers) || Object.keys(value.controllers).some(k => !(AGENT_IDS as readonly string[]).includes(k))) throw new Error('Invalid academy save.');
  const controllers: AcademySave['controllers'] = {};
  for (const kind of AGENT_IDS) {
    const c = value.controllers[kind]; if (c === undefined) continue;
    if (!object(c) || !keys(c, ['draft', 'champion', 'stage', 'seed', 'history']) || !integer(c.stage, 0, 2) || !integer(c.seed, 0, 99) || !Array.isArray(c.history) || c.history.length > 80 || !c.history.every(p => object(p) && keys(p, ['generation', 'successes', 'score', 'ticks']) && integer(p.generation, 0, 100000) && integer(p.successes, 0, 8) && finite(p.score, 0, 100) && finite(p.ticks, 0, 120))) throw new Error('Invalid controller training record.');
    controllers[kind] = { draft: parsePolicy({ version: 1, kind, rules: c.draft }, kind), champion: parsePolicy({ version: 1, kind, rules: c.champion }, kind), stage: c.stage as number, seed: c.seed as number, history: c.history.map(p => ({ ...p })) as SearchPoint[] };
  }
  const r = value.rover;
  if (!object(r) || !keys(r, ['mode', 'episodes', 'random', 'q', 'history']) || !['courier', 'storm'].includes(String(r.mode)) || !integer(r.episodes, 0, 100000) || !integer(r.random, 0, 2 ** 32 - 1) || !Array.isArray(r.q) || r.q.length !== Q_ROWS || !r.q.every(row => Array.isArray(row) && row.length === 4 && row.every(v => finite(v, -100, 100))) || !Array.isArray(r.history) || r.history.length > 80 || !r.history.every(p => object(p) && keys(p, ['episode', 'successes', 'reward']) && integer(p.episode, 1, r.episodes as number) && finite(p.successes, 0, 100) && finite(p.reward, -200, 100))) throw new Error('Invalid learned rover record.');
  return { controllers, circuit: validateCircuit(value.circuit), career: validateCareer(value.career), lab: validateLab(value.lab), garage: validateGarage(value.garage), worlds: validateWorldSave(value.worlds), rover: { mode: r.mode as RoverRecord['mode'], episodes: r.episodes as number, random: r.random as number, q: (r.q as number[][]).map(row => [...row]), history: r.history.map(p => ({ ...p })) as RoverPoint[] } };
}
