import type { ArenaKind } from './arenaRules.ts';
import { canonical, clone, exact, freeze, hash, integer, plain } from './data.ts';
import { curriculum, episodeConfig, seedGroups } from './curriculum.ts';
import { controllerFromPackage, packageRules, packageRover, validatePackage, type ControllerPackage } from './packages.ts';
import { recordEpisode, type Receipt } from './receipts.ts';
import { ENVIRONMENTS, ENVIRONMENT_VERSION, RUNTIME_VERSION, type EnvironmentId, type Split } from './types.ts';
import { searchGeneration, trainRover, type RoverRecord } from '../training/models.ts';

export type ExperimentMethod = 'frozen' | 'rule-search' | 'q-learning';
export interface GroupReport { split: Split; transfer: boolean; episodes: number; successes: number; score: number; ticks: number; failures: Record<string, number> }
export interface ExperimentReport { groups: GroupReport[]; transferDelta: number; controllerHash: string }
export interface Experiment {
  schema: 'experiment@1'; runtime: string; experimentId: string; environment: EnvironmentId; environmentVersion: string;
  curriculum: string; seed: number; seeds: Record<Split, number[]>; controller: ControllerPackage;
  method: ExperimentMethod; parameters: { generations: number; episodes: number; alpha: number; gamma: number; controllerSeed: number; episodeLimit: number };
  result: ExperimentReport | null; traceHashes: string[]; digest: string;
}
export interface ExperimentOutcome { manifest: Experiment; champion: ControllerPackage; receipts: Receipt[] }
export interface ExperimentProgress { phase: string; completed: number; total: number }
const identity = (e: Omit<Experiment, 'experimentId' | 'digest'>) => { const { result: _r, traceHashes: _t, ...spec } = e; void _r; void _t; return hash(spec).slice(0, 24); };
function seal(data: Omit<Experiment, 'digest' | 'experimentId'>): Experiment {
  const payload = { ...clone(data), experimentId: identity(data) }; return freeze({ ...payload, digest: hash(payload) });
}
export function createExperiment(environment: EnvironmentId, controller: ControllerPackage, stage = 'builder', seed = 3, method: ExperimentMethod = 'frozen', count = 6): Experiment {
  const pkg = validatePackage(controller, environment); curriculum(stage); seedGroups(seed);
  return validateExperiment(seal({ schema: 'experiment@1', runtime: RUNTIME_VERSION, environment, environmentVersion: ENVIRONMENT_VERSION, curriculum: stage, seed, seeds: seedGroups(seed), controller: pkg, method, parameters: { generations: method === 'rule-search' ? count : 0, episodes: method === 'q-learning' ? count : 0, alpha: 0.25, gamma: 0.97, controllerSeed: 42 + seed, episodeLimit: environment === 'rover' ? 80 : 120 }, result: null, traceHashes: [] }));
}
export function validateExperiment(input: unknown): Experiment {
  if (!plain(input) || !exact(input, ['schema', 'runtime', 'experimentId', 'environment', 'environmentVersion', 'curriculum', 'seed', 'seeds', 'controller', 'method', 'parameters', 'result', 'traceHashes', 'digest']) || input.schema !== 'experiment@1' || input.runtime !== RUNTIME_VERSION || input.environmentVersion !== ENVIRONMENT_VERSION || !ENVIRONMENTS.includes(input.environment as EnvironmentId) || !integer(input.seed, 0, 99) || typeof input.curriculum !== 'string' || !['frozen', 'rule-search', 'q-learning'].includes(String(input.method))) throw new Error('Invalid or incompatible experiment manifest.');
  curriculum(input.curriculum); const pkg = validatePackage(input.controller, input.environment as EnvironmentId);
  if (canonical(input.seeds) !== canonical(seedGroups(input.seed))) throw new Error('Experiment seeds must match the disjoint TRAIN / VALIDATION / HOLDOUT recipe.');
  const p = input.parameters;
  if (!plain(p) || !exact(p, ['generations', 'episodes', 'alpha', 'gamma', 'controllerSeed', 'episodeLimit']) || !integer(p.generations, 0, 8) || !integer(p.episodes, 0, 1000) || p.alpha !== 0.25 || p.gamma !== 0.97 || !integer(p.controllerSeed, 0, 2 ** 32 - 1) || p.episodeLimit !== (input.environment === 'rover' ? 80 : 120)) throw new Error('Invalid or excessive experiment parameters.');
  if (input.method === 'rule-search' ? input.environment === 'rover' || p.episodes !== 0 || p.generations < 1 : input.method === 'q-learning' ? input.environment !== 'rover' || p.generations !== 0 || p.episodes < 1 || !('q' in pkg.parameters) || pkg.parameters.trainingEpisodes + p.episodes > 100000 : p.generations !== 0 || p.episodes !== 0) throw new Error('Experiment method does not match its controller/limits.');
  if (!Array.isArray(input.traceHashes) || input.traceHashes.length > 32 || !input.traceHashes.every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))) throw new Error('Invalid trace hash list.');
  if (input.result !== null) {
    const r = input.result;
    if (!plain(r) || !exact(r, ['groups', 'transferDelta', 'controllerHash']) || !Array.isArray(r.groups) || r.groups.length !== 4 || typeof r.controllerHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.controllerHash) || typeof r.transferDelta !== 'number' || !Number.isFinite(r.transferDelta) || Math.abs(r.transferDelta) > 100 || input.traceHashes.length !== 32) throw new Error('Invalid experiment result.');
    for (const [i, g] of r.groups.entries()) if (!plain(g) || !exact(g, ['split', 'transfer', 'episodes', 'successes', 'score', 'ticks', 'failures']) || g.split !== ['TRAIN', 'VALIDATION', 'HOLDOUT', 'HOLDOUT'][i] || g.transfer !== (i === 3) || g.episodes !== 8 || !integer(g.successes, 0, 8) || typeof g.score !== 'number' || !Number.isFinite(g.score) || g.score < 0 || g.score > 100 || typeof g.ticks !== 'number' || !Number.isFinite(g.ticks) || g.ticks < 1 || g.ticks > Number(p.episodeLimit) || !plain(g.failures) || Object.entries(g.failures).some(([k, v]) => !['tick-limit', 'resource-exhausted'].includes(k) || !integer(v, 1, 8)) || Object.values(g.failures).reduce<number>((sum, n) => sum + Number(n), 0) !== 8 - g.successes) throw new Error('Invalid split result.');
  } else if (input.traceHashes.length) throw new Error('Trace hashes need an experiment result.');
  const { digest, experimentId, ...data } = input;
  if (digest !== hash({ ...data, experimentId }) || experimentId !== identity(data as unknown as Omit<Experiment, 'digest' | 'experimentId'>)) throw new Error('Experiment integrity or identity differs.');
  return freeze(clone(input)) as unknown as Experiment;
}
export function* experimentSteps(input: Experiment): Generator<ExperimentProgress, ExperimentOutcome> {
  const spec = validateExperiment(input), stage = curriculum(spec.curriculum), mode = 'mode' in spec.controller.parameters ? spec.controller.parameters.mode : 'courier';
  let champion = spec.controller;
  if (spec.method === 'rule-search' && 'rules' in champion.parameters) {
    let rules = champion.parameters.rules;
    for (let i = 0; i < spec.parameters.generations; i++) { rules = searchGeneration(spec.environment as ArenaKind, rules, stage.difficulty, spec.seed, { seeds: spec.seeds.TRAIN, variant: stage.trainingVariant }).champion; yield { phase: 'TRAIN', completed: i + 1, total: spec.parameters.generations }; }
    champion = packageRules(spec.environment as ArenaKind, rules);
  }
  if (spec.method === 'q-learning' && 'q' in champion.parameters) {
    let rover: RoverRecord = { mode, episodes: champion.parameters.trainingEpisodes, random: spec.parameters.controllerSeed, q: clone(champion.parameters.q), history: [] };
    for (let completed = 0; completed < spec.parameters.episodes;) { const count = Math.min(25, spec.parameters.episodes - completed); rover = trainRover(rover, count, { seeds: spec.seeds.TRAIN, variant: stage.trainingVariant, difficulty: stage.difficulty }); completed += count; yield { phase: 'TRAIN', completed, total: spec.parameters.episodes }; }
    champion = packageRover(rover.q, mode, rover.episodes);
  }
  const frozenHash = champion.controller.hash, controller = controllerFromPackage(champion), groups: GroupReport[] = [], receipts: Receipt[] = [];
  for (const [i, split] of (['TRAIN', 'VALIDATION', 'HOLDOUT', 'HOLDOUT'] as Split[]).entries()) {
    const trials: Receipt[] = [];
    for (const seed of spec.seeds[split]) { const receipt = recordEpisode(episodeConfig(spec.environment, seed, spec.curriculum, mode, i === 3), controller); trials.push(receipt); receipts.push(receipt); yield { phase: i === 3 ? 'TRANSFER' : split, completed: receipts.length, total: 32 }; }
    const failures: Record<string, number> = {};
    trials.forEach(r => { if (!r.result.success) failures[r.result.reason] = (failures[r.result.reason] || 0) + 1; });
    groups.push({ split, transfer: i === 3, episodes: trials.length, successes: trials.filter(r => r.result.success).length, score: trials.reduce((s, r) => s + r.result.score, 0) / trials.length, ticks: trials.reduce((s, r) => s + r.result.ticks, 0) / trials.length, failures });
  }
  if (controller.metadata().hash !== frozenHash || hash(spec.controller) !== hash(input.controller)) throw new Error('Evaluation changed the controller.');
  const { digest: _d, experimentId: _id, ...data } = spec; void _d; void _id;
  const manifest = seal({ ...data, result: { groups, transferDelta: (groups[3].successes - groups[2].successes) / 8 * 100, controllerHash: frozenHash }, traceHashes: receipts.map(r => r.digest) });
  return { manifest, champion, receipts };
}
export function runExperiment(spec: Experiment): ExperimentOutcome {
  const run = experimentSteps(spec); let step = run.next(); while (!step.done) step = run.next(); return step.value;
}
export function verifyExperiment(spec: Experiment): ExperimentOutcome {
  const result = runExperiment(spec);
  if (spec.result && (canonical(spec.result) !== canonical(result.manifest.result) || canonical(spec.traceHashes) !== canonical(result.manifest.traceHashes))) throw new Error('Rerun differs from the imported result or trace hashes.');
  return result;
}
