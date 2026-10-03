import type { ArenaState, PolicyAction } from './arenaRules.ts';
import type { RoverEpisode, RoverMode } from './roverRules.ts';

export const RUNTIME_VERSION = '1.0.0' as const;
export const ENVIRONMENT_VERSION = '1.0.0' as const;
export const ENVIRONMENTS = ['sports', 'outpost', 'scenario', 'space', 'rover'] as const;
export type EnvironmentId = typeof ENVIRONMENTS[number];
export type Action = PolicyAction;
export type Split = 'TRAIN' | 'VALIDATION' | 'HOLDOUT';
export type Variant = 'standard' | 'constraints' | 'transfer';
export interface EnvironmentConfig {
  environment: EnvironmentId; version: string; seed: number; difficulty: number;
  variant: Variant; mode: RoverMode;
}
export type SimulationState = ArenaState | RoverEpisode;
export type PublicState = Omit<ArenaState, 'trace'> | Omit<RoverEpisode, 'trace' | 'random'>;
export interface Observation {
  schema: 'observation@1'; environment: EnvironmentId; tick: number;
  state: PublicState; target: [number, number]; conditions: string[];
  observationIndex: number | null;
  map: number[][];
}
export interface ActionSpec { action: Action; enabled: boolean; description: string }
export interface TraceEvent { type: 'move' | 'collision' | 'objective' | 'resource' | 'wind' | 'terminal'; detail: string }
export type TerminalReason = 'running' | 'goal' | 'tick-limit' | 'resource-exhausted';
export interface EpisodeResult { terminal: boolean; reason: TerminalReason; success: boolean; ticks: number; score: number; reward: number; collisions: number }
export interface Snapshot { schema: 'snapshot@1'; config: EnvironmentConfig; state: SimulationState }
export interface StepResult {
  observation: Observation; action: Action; executedAction: Action; reward: number;
  events: TraceEvent[]; result: EpisodeResult;
}
export interface Environment {
  readonly config: Readonly<EnvironmentConfig>;
  reset(seed?: number): Observation;
  observe(): Observation;
  availableActions(): ActionSpec[];
  step(action: unknown): StepResult;
  snapshot(): Snapshot;
  restore(snapshot: unknown): Observation;
  stateHash(): string;
  isTerminal(): boolean;
  result(): EpisodeResult;
}
export type ControllerFamily = 'human' | 'authored' | 'rules' | 'replay' | 'q-learning';
export interface ControllerMetadata { family: ControllerFamily; version: string; hash: string }
export interface Decision { action: Action; reason?: string; rule?: number; values?: number[] }
export interface Controller {
  metadata(): ControllerMetadata;
  reset(seed: number): void;
  chooseAction(observation: Readonly<Observation>, actions: readonly ActionSpec[]): Decision;
}
// A future asynchronous adapter may return an intent. The host still validates
// it through Environment.step; stale episode/tick intents must be discarded.
export interface AsyncController {
  metadata(): ControllerMetadata;
  chooseAction(observation: Readonly<Observation>, actions: readonly ActionSpec[], signal: AbortSignal): Promise<Decision>;
}
