import { choose, validateDecision, validateMetadata } from './controllers.ts';
import { canonical, clone, exact, freeze, hash, plain } from './data.ts';
import { createEnvironment, validateConfig } from './environment.ts';
import { RUNTIME_VERSION, type ActionSpec, type Controller, type ControllerMetadata, type Decision, type EnvironmentConfig, type EpisodeResult, type Observation, type StepResult } from './types.ts';

export interface TraceRow {
  tick: number; observation: Observation; actions: ActionSpec[]; decision: Decision;
  transition: StepResult; changes: Record<string, unknown>; stateHash: string;
}
export interface Receipt {
  schema: 'episode@1'; runtime: string; episodeId: string; config: EnvironmentConfig;
  controller: ControllerMetadata; initialHash: string; steps: TraceRow[];
  result: EpisodeResult; finalHash: string; digest: string;
}
export function changes(before: Observation, after: Observation): Record<string, unknown> {
  const a = before.state as unknown as Record<string, unknown>, b = after.state as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.keys(b).filter(k => canonical(a[k]) !== canonical(b[k])).map(k => [k, clone(b[k])]));
}
export function runHeadless(config: EnvironmentConfig, controller: Controller) {
  const environment = createEnvironment(config); controller.reset(config.seed);
  while (!environment.isTerminal()) environment.step(choose(controller, environment.observe(), environment.availableActions()).action);
  return { result: environment.result(), snapshot: environment.snapshot(), finalHash: environment.stateHash() };
}
export function recordEpisode(config: EnvironmentConfig, controller: Controller): Receipt {
  const environment = createEnvironment(config), metadata = validateMetadata(controller.metadata()); controller.reset(config.seed);
  const initialHash = environment.stateHash(), steps: TraceRow[] = [];
  while (!environment.isTerminal()) {
    const observation = environment.observe(), actions = environment.availableActions(), decision = choose(controller, observation, actions);
    const transition = environment.step(decision.action);
    steps.push({ tick: transition.observation.tick, observation, actions, decision, transition, changes: changes(observation, transition.observation), stateHash: environment.stateHash() });
  }
  const payload = { schema: 'episode@1' as const, runtime: RUNTIME_VERSION, episodeId: hash({ config, metadata }).slice(0, 24), config: clone(config), controller: metadata, initialHash, steps, result: environment.result(), finalHash: environment.stateHash() };
  return freeze({ ...payload, digest: hash(payload) });
}
const identical = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export function verifyReceipt(input: unknown): Receipt {
  // Bound work before hashing/replaying. Incoming files also have a byte limit.
  if (!plain(input) || !exact(input, ['schema', 'runtime', 'episodeId', 'config', 'controller', 'initialHash', 'steps', 'result', 'finalHash', 'digest']) || input.schema !== 'episode@1' || input.runtime !== RUNTIME_VERSION || !Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 120 || typeof input.digest !== 'string') throw new Error('Invalid or incompatible episode receipt.');
  const config = validateConfig(input.config), metadata = validateMetadata(input.controller), { digest, ...payload } = input;
  if (hash(payload) !== digest) throw new Error('Receipt integrity hash differs.');
  if (input.episodeId !== hash({ config, metadata }).slice(0, 24)) throw new Error('Episode identity differs.');
  const environment = createEnvironment(config);
  if (input.initialHash !== environment.stateHash()) throw new Error('Initial state hash differs.');
  for (let i = 0; i < input.steps.length; i++) {
    const row = input.steps[i];
    if (!plain(row) || !exact(row, ['tick', 'observation', 'actions', 'decision', 'transition', 'changes', 'stateHash']) || row.tick !== i + 1) throw new Error(`Invalid trace row ${i + 1}.`);
    if (environment.isTerminal()) throw new Error('Receipt has actions after termination.');
    const before = environment.observe(), decision = validateDecision(row.decision);
    if (!identical(row.observation, before) || !identical(row.actions, environment.availableActions())) throw new Error(`Observation or action mask differs at tick ${i + 1}.`);
    const next = environment.step(decision.action);
    if (!identical(row.transition, next) || !identical(row.changes, changes(before, next.observation)) || row.stateHash !== environment.stateHash()) throw new Error(`Transition or state hash differs at tick ${i + 1}.`);
  }
  if (!environment.isTerminal() || !identical(input.result, environment.result()) || input.finalHash !== environment.stateHash()) throw new Error('Terminal result or final state hash differs.');
  return freeze(clone(input)) as unknown as Receipt;
}
// Inspector positions are derived from verified immutable transitions. Reading
// a previous frame neither restores nor advances the original environment.
export function inspectTick(receipt: Receipt, tick: number): Observation {
  if (!Number.isInteger(tick) || tick < 0 || tick > receipt.steps.length) throw new Error('Choose a recorded tick.');
  return clone(tick === 0 ? receipt.steps[0].observation : receipt.steps[tick - 1].transition.observation);
}
