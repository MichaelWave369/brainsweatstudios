export const WORLD_VERSION = "1.0.0" as const;
export const LIMITS = Object.freeze({
  specBytes: 128000,
  packBytes: 256000,
  receiptBytes: 8000000,
  ticks: 10000,
  roles: 4,
  resources: 16,
  entities: 32,
  locations: 16,
  actions: 48,
  events: 32,
  rules: 24,
  objectives: 24,
  flags: 16,
  pending: 128,
  eventsPerTick: 32,
  effectsPerTick: 512,
  ledgerPerTick: 768,
  checkpoints: 128,
  records: 10000,
});
export const SIGNALS = [
  "REQUEST_RESOURCE",
  "RESOURCE_AVAILABLE",
  "OBJECTIVE_COMPLETE",
  "OBJECTIVE_BLOCKED",
  "NEED_INSPECTION",
  "NEED_REPAIR",
  "HOLD",
  "PROCEED",
  "RISK_DETECTED",
  "STATUS_REQUEST",
] as const;
export type SignalType = (typeof SIGNALS)[number];
export const FAILURES = [
  "RESOURCE_EXHAUSTED",
  "DEADLINE_MISSED",
  "CRITICAL_FACILITY_OFFLINE",
  "UNRESOLVED_BLOCKAGE",
  "BUDGET_FAILURE",
  "COMMUNICATION_BREAKDOWN",
  "ACTION_BUDGET_EXCEEDED",
  "CONTROLLER_UNAVAILABLE",
  "SIMULATION_LIMIT",
] as const;
export type Failure = (typeof FAILURES)[number];
export type Visibility =
  | { mode: "always" | "hidden" }
  | { mode: "roles"; roles: string[] }
  | { mode: "inspect" }
  | { mode: "delayed"; tick: number }
  | { mode: "location"; location: string }
  | { mode: "bucket"; thresholds: number[] };
export type Ref =
  | "tick"
  | `resource:${string}`
  | `entity:${string}`
  | `flag:${string}`
  | `objective:${string}`;
export type Predicate =
  | { op: "all" | "any"; rules: Predicate[] }
  | { op: "not"; rule: Predicate }
  | {
      op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains";
      ref: Ref;
      value: number | boolean | string;
    };
export type Effect =
  | { type: "resource"; id: string; delta: number }
  | { type: "entity"; id: string; status: number }
  | { type: "flag"; id: string; value: boolean }
  | { type: "move"; entity: string; location: string }
  | {
      type: "reveal";
      kind: "resource" | "entity" | "flag";
      id: string;
      roles: string[];
    }
  | { type: "schedule"; event: string; delay: number }
  | { type: "cancel"; event: string }
  | { type: "objective"; id: string; status: "complete" | "failed" }
  | { type: "emit"; label: string }
  | {
      type: "signal";
      recipient: string;
      signal: SignalType;
      resource: string | null;
      amount: number | null;
    };
export interface RoleSpec {
  id: string;
  label: string;
  actions: string[];
  resources: string[];
  locations: string[];
  signals: boolean;
}
export interface ResourceSpec {
  id: string;
  label: string;
  min: number;
  max: number;
  initial: number;
  visibility: Visibility;
}
export interface LocationSpec {
  id: string;
  label: string;
  x: number;
  y: number;
  neighbors: string[];
}
export interface EntitySpec {
  id: string;
  label: string;
  location: string;
  status: number;
  visibility: Visibility;
}
export interface FlagSpec {
  id: string;
  initial: boolean;
  visibility: Visibility;
}
export interface ObjectiveSpec {
  id: string;
  label: string;
  parent: string | null;
  requires: string[];
  scope: "campaign" | "day" | "task";
  condition: Predicate;
  critical: boolean;
  deadline: number | null;
  failure: Failure;
}
export interface ActionSpec {
  id: string;
  label: string;
  costs: { resource: string; amount: number }[];
  condition: Predicate;
  effects: Effect[];
  duration: number;
  exclusive: string | null;
  location: string | null;
}
export interface EventSpec {
  id: string;
  label: string;
  at: number | null;
  when: Predicate | null;
  repeat: number;
  maxRuns: number;
  effects: Effect[];
  variants: Effect[][];
}
export interface RuleSpec {
  id: string;
  when: Predicate;
  frequency: "once" | "tick";
  effects: Effect[];
}
export interface WorldSpec {
  schema: "brain-sweat-world@1";
  id: string;
  version: string;
  title: string;
  description: string;
  clock: {
    unit: "tick" | "hour" | "day";
    ticksPerDay: number;
    maxTicks: number;
  };
  turnMode: "ordered" | "simultaneous";
  roles: RoleSpec[];
  resources: ResourceSpec[];
  locations: LocationSpec[];
  entities: EntitySpec[];
  flags: FlagSpec[];
  objectives: ObjectiveSpec[];
  actions: ActionSpec[];
  events: EventSpec[];
  rules: RuleSpec[];
  metrics: (
    | "completion"
    | "reserves"
    | "recovery"
    | "coordination"
    | "information"
    | "invalid-actions"
  )[];
}
export interface WorldPack {
  schema: "brain-sweat-pack@1";
  id: string;
  version: string;
  worlds: WorldSpec[];
}
export interface ValidationError {
  path: string;
  code: string;
  message: string;
}
export interface CompiledWorld {
  readonly spec: Readonly<WorldSpec>;
  readonly hash: string;
  readonly actions: Readonly<Record<string, ActionSpec>>;
  readonly events: Readonly<Record<string, EventSpec>>;
  readonly roles: Readonly<Record<string, RoleSpec>>;
}
export type Compilation =
  | { ok: true; world: CompiledWorld }
  | { ok: false; errors: ValidationError[] };
export interface SeedHierarchy {
  master: number;
  map: number;
  resource: number;
  event: number;
  weather: number;
  observation: number;
  presentation: number;
}
export interface Actor {
  id: string;
  role: string;
}
export interface Scheduled {
  id: string;
  due: number;
  kind: "event" | "macro";
  source: string;
  cause: string | null;
  actor: string | null;
}
export interface TeamSignal {
  id: string;
  sender: string;
  recipient: string;
  type: SignalType;
  resource: string | null;
  amount: number | null;
  tick: number;
}
export interface WorldState {
  tick: number;
  turn: number;
  resources: Record<string, number>;
  entities: Record<string, { status: number; location: string }>;
  flags: Record<string, boolean>;
  objectives: Record<string, "pending" | "complete" | "failed">;
  busy: Record<string, number>;
  positions: Record<string, string>;
  revealed: Record<string, string[]>;
  queue: Scheduled[];
  runs: Record<string, number>;
  fired: string[];
  signals: TeamSignal[];
  rng: number;
  serial: number;
  failure: Failure | null;
  metrics: {
    blocked: number;
    conflicts: number;
    inspections: number;
    signals: number;
    recoveries: number;
    recoveryTicks: number;
    failedAt: Record<string, number>;
    minReserves: Record<string, number>;
  };
}
export interface LedgerEntry {
  id: string;
  tick: number;
  kind:
    | "action"
    | "resource"
    | "entity"
    | "flag"
    | "move"
    | "reveal"
    | "scheduled"
    | "triggered"
    | "cancelled"
    | "completed"
    | "objective"
    | "signal"
    | "notice"
    | "failure";
  source: string;
  cause: string | null;
  target: string;
  before: number | string | boolean | null;
  after: number | string | boolean | null;
}
export interface Intent {
  actor: string;
  action: string;
}
export interface Resolution {
  actor: string;
  action: string;
  outcome: "executed" | "blocked" | "conflict" | "busy";
  actionId: string;
}
export interface WorldResult {
  terminal: boolean;
  success: boolean;
  reason: Failure | "running" | "campaign-complete";
  tick: number;
  completion: number;
  reserves: Record<string, number>;
  blocked: number;
  conflicts: number;
  inspections: number;
  signals: number;
  recoveries: number;
  recoveryTicks: number;
}
export interface WorldObservation {
  schema: "world-observation@1";
  worldHash: string;
  tick: number;
  day: number;
  actor: Actor;
  turn: string | null;
  objective: string;
  resources: Record<string, number | string>;
  entities: Record<
    string,
    { status: number | string; location: string | null }
  >;
  flags: Record<string, boolean | string>;
  objectives: Record<string, string>;
  signals: TeamSignal[];
  legalActions: {
    type: string;
    label: string;
    duration: number;
    costs: { resource: string; amount: number }[];
  }[];
  busyUntil: number;
  locations: LocationSpec[];
  terminal: boolean;
}
export interface WorldFrame {
  tick: number;
  intents: Intent[];
  resolutions: Resolution[];
  ledger: LedgerEntry[];
  stateHash: string;
  result: WorldResult;
}
export interface WorldEnvironment {
  readonly world: CompiledWorld;
  readonly actors: readonly Actor[];
  readonly seeds: Readonly<SeedHierarchy>;
  observe(actor: string): WorldObservation;
  step(intents: Intent[]): WorldFrame;
  snapshot(): WorldState;
  stateHash(): string;
  result(): WorldResult;
}
