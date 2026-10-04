import { clone, exact, freeze, hash, integer, plain } from "../runtime/data.ts";
import {
  assertData,
  dataBytes,
  requireWorld,
  validatePack,
} from "./compiler.ts";
import { createWorldEnvironment, hydrateVerifiedWorld } from "./runtime.ts";
import {
  LIMITS,
  type Actor,
  type WorldEnvironment,
  type WorldFrame,
  type WorldPack,
  type WorldResult,
  type WorldState,
} from "./types.ts";

export const BASELINES = [
  "greedy",
  "maintenance-first",
  "reserve-first",
  "objective-priority",
  "reactive",
] as const;
export const MEMORY_MODES = [
  "STATE_ONLY",
  "RECENT_WINDOW",
  "BOUNDED_NOTEBOOK",
] as const;
export interface WorldController {
  id: string;
  family: "human" | "baseline" | "model";
  provider: "none" | "mock" | "ollama";
  model: string;
  baseline: (typeof BASELINES)[number];
  context: (typeof MEMORY_MODES)[number];
  requestBudget: number;
  timeoutMs: number;
  decisionInterval: number;
  temperature: number;
  seed: number;
}
export interface WorldMemory {
  schema: "world-memory@1";
  facts: string[];
  hypotheses: string[];
  plans: string[];
  warnings: string[];
  commitments: string[];
  completed: string[];
  unresolved: string[];
}
export interface WorldPlan {
  schema: "world-plan@1";
  goal: string;
  steps: string[];
  risks: string[];
  fallbacks: string[];
}
export function validatePlan(input: unknown): WorldPlan {
  assertData(input, 4096, 100, 4);
  if (
    !plain(input) ||
    !exact(input, ["schema", "goal", "steps", "risks", "fallbacks"]) ||
    input.schema !== "world-plan@1" ||
    typeof input.goal !== "string" ||
    input.goal.length > 120 ||
    !["steps", "risks", "fallbacks"].every(
      (k) =>
        Array.isArray(input[k]) &&
        input[k].length <= 6 &&
        input[k].every((s) => typeof s === "string" && s.length <= 120),
    )
  )
    throw new Error("Invalid bounded public plan.");
  return freeze(clone(input)) as unknown as WorldPlan;
}
export interface WorldArtifact {
  index: number;
  tick: number;
  actor: string;
  kind: "memory" | "plan";
  value: WorldMemory | WorldPlan;
}
export const freshMemory = (): WorldMemory => ({
  schema: "world-memory@1",
  facts: [],
  hypotheses: [],
  plans: [],
  warnings: [],
  commitments: [],
  completed: [],
  unresolved: [],
});
export function validateMemory(input: unknown): WorldMemory {
  assertData(input, 4096, 500, 4);
  if (
    !plain(input) ||
    !exact(input, Object.keys(freshMemory())) ||
    input.schema !== "world-memory@1" ||
    !Object.entries(input)
      .filter(([k]) => k !== "schema")
      .every(
        ([, v]) =>
          Array.isArray(v) &&
          v.length <= 6 &&
          v.every(
            (s) =>
              typeof s === "string" &&
              s.length <= 120 &&
              !Array.from(s).some((c) => c.charCodeAt(0) <= 8),
          ),
      )
  )
    throw new Error("Use bounded public memory lists.");
  return freeze(clone(input)) as unknown as WorldMemory;
}
export function validateWorldController(input: unknown): WorldController {
  if (
    !plain(input) ||
    !exact(input, [
      "id",
      "family",
      "provider",
      "model",
      "baseline",
      "context",
      "requestBudget",
      "timeoutMs",
      "decisionInterval",
      "temperature",
      "seed",
    ]) ||
    typeof input.id !== "string" ||
    !/^[a-z][a-z0-9-]{0,31}$/.test(input.id) ||
    !["human", "baseline", "model"].includes(String(input.family)) ||
    !["none", "mock", "ollama"].includes(String(input.provider)) ||
    (input.family === "model") !== (input.provider !== "none") ||
    typeof input.model !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(input.model) ||
    !BASELINES.includes(input.baseline as (typeof BASELINES)[number]) ||
    !MEMORY_MODES.includes(input.context as (typeof MEMORY_MODES)[number]) ||
    !integer(input.requestBudget, 1, 4096) ||
    !integer(input.timeoutMs, 10, 60000) ||
    !integer(input.decisionInterval, 1, 24) ||
    typeof input.temperature !== "number" ||
    !Number.isFinite(input.temperature) ||
    input.temperature < 0 ||
    input.temperature > 2 ||
    !integer(input.seed, 0, 999999)
  )
    throw new Error("Invalid bounded world controller.");
  return freeze(clone(input)) as unknown as WorldController;
}
export const baselineController = (
  id = "baseline",
  baseline: WorldController["baseline"] = "maintenance-first",
): WorldController => ({
  id,
  family: "baseline",
  provider: "none",
  model: "public-baseline",
  baseline,
  context: "STATE_ONLY",
  requestBudget: 1000,
  timeoutMs: 10000,
  decisionInterval: 1,
  temperature: 0,
  seed: 369,
});
export interface DecisionEvidence {
  actor: string;
  controller: string;
  action: string | null;
  error: string | null;
  requests: number;
  note: string | null;
  memory: WorldMemory | null;
}
export interface WorldRecord {
  index: number;
  decisions: DecisionEvidence[];
  frame: WorldFrame | null;
  chain: string;
}
export interface WorldCheckpoint {
  index: number;
  tick: number;
  state: WorldState;
  stateHash: string;
  chain: string;
  hash: string;
}
export interface WorldHandoff {
  index: number;
  tick: number;
  actor: string;
  from: string;
  to: WorldController;
  note: string;
}
export interface WorldReceipt {
  schema: "world-episode@1";
  runtime: "1.0.0";
  pack: WorldPack;
  packHash: string;
  worldId: string;
  worldHash: string;
  masterSeed: number;
  seedHierarchy: WorldEnvironment["seeds"];
  actors: Actor[];
  initialControllers: Record<string, WorldController>;
  initialHash: string;
  records: WorldRecord[];
  checkpoints: WorldCheckpoint[];
  handoffs: WorldHandoff[];
  artifacts: WorldArtifact[];
  requests: Record<string, number>;
  ending: "stopped" | "complete" | "error" | "budget";
  result: WorldResult;
  finalHash: string;
  finalChain: string;
  digest: string;
}
const recordHash = (previous: string, record: Omit<WorldRecord, "chain">) =>
  hash({ previous, record });
const checkpointHash = (c: Omit<WorldCheckpoint, "hash">) => hash(c);
export const receiptDigest = (r: Omit<WorldReceipt, "digest">) => hash(r);
export class WorldRecorder {
  readonly initialControllers: Record<string, WorldController>;
  readonly records: WorldRecord[] = [];
  readonly checkpoints: WorldCheckpoint[] = [];
  readonly handoffs: WorldHandoff[] = [];
  readonly artifacts: WorldArtifact[] = [];
  readonly pack: WorldPack;
  readonly initialHash: string;
  readonly packHash: string;
  readonly requests: Record<string, number>;
  private chain: string;
  private size: number;
  constructor(
    readonly env: WorldEnvironment,
    pack: unknown,
    controllers: Record<string, WorldController>,
  ) {
    this.pack = clone(validatePack(pack)) as WorldPack;
    const included = this.pack.worlds.find((w) => w.id === env.world.spec.id);
    if (!included || hash(included) !== env.world.hash)
      throw new Error("The world does not match this pack.");
    this.initialControllers = Object.fromEntries(
      env.actors.map((a) => [a.id, validateWorldController(controllers[a.id])]),
    );
    this.requests = Object.fromEntries(env.actors.map((a) => [a.id, 0]));
    this.initialHash = env.stateHash();
    this.packHash = hash(this.pack);
    this.chain = hash({
      packHash: this.packHash,
      worldHash: env.world.hash,
      initialHash: this.initialHash,
      seeds: env.seeds,
      actors: env.actors,
    });
    this.size =
      dataBytes(this.pack) + dataBytes(this.initialControllers) + 4000;
    this.checkpoint();
  }
  canRecord() {
    return (
      this.records.length < LIMITS.records &&
      this.size < LIMITS.receiptBytes - 550000
    );
  }
  private checkpoint() {
    const base = {
      index: this.records.length,
      tick: this.env.result().tick,
      state: this.env.snapshot(),
      stateHash: this.env.stateHash(),
      chain: this.chain,
    };
    const cp = { ...base, hash: checkpointHash(base) };
    this.checkpoints.push(cp);
    this.size += dataBytes(cp);
  }
  append(decisions: DecisionEvidence[], frame: WorldFrame | null) {
    if (!this.canRecord()) throw new Error("Receipt recording limit reached.");
    const base = {
      index: this.records.length,
      decisions: clone(decisions),
      frame,
    };
    this.chain = recordHash(this.chain, base);
    const row = { ...base, chain: this.chain };
    this.records.push(row);
    this.size += dataBytes(row);
    decisions.forEach((d) => {
      this.requests[d.actor] += d.requests;
    });
    if (this.records.length % 96 === 0) this.checkpoint();
  }
  handoff(actor: string, to: WorldController, note: string) {
    if (
      this.handoffs.length >= 32 ||
      typeof note !== "string" ||
      note.length > 120
    )
      throw new Error("Handoff bound exceeded.");
    const previous = this.controller(actor);
    const h = {
      index: this.records.length,
      tick: this.env.result().tick,
      actor,
      from: previous.id,
      to: validateWorldController(to),
      note,
    };
    const n = dataBytes(h);
    if (this.size + n > LIMITS.receiptBytes - 550000)
      throw new Error("Handoff recording limit reached.");
    this.handoffs.push(h);
    this.size += n;
  }
  controller(actor: string) {
    return (
      this.handoffs.filter((h) => h.actor === actor).at(-1)?.to ||
      this.initialControllers[actor]
    );
  }
  artifact(actor: string, kind: WorldArtifact["kind"], value: unknown) {
    if (
      !this.env.actors.some((a) => a.id === actor) ||
      this.artifacts.length >= 128 ||
      !this.canRecord()
    )
      throw new Error("Public artifact limit exceeded.");
    const artifact: WorldArtifact = {
      index: this.records.length,
      tick: this.env.result().tick,
      actor,
      kind,
      value: kind === "memory" ? validateMemory(value) : validatePlan(value),
    };
    this.artifacts.push(artifact);
    this.size += dataBytes(artifact);
  }
  finish(ending: WorldReceipt["ending"] = "stopped"): WorldReceipt {
    const base: Omit<WorldReceipt, "digest"> = {
      schema: "world-episode@1",
      runtime: "1.0.0",
      pack: this.pack,
      packHash: this.packHash,
      worldId: this.env.world.spec.id,
      worldHash: this.env.world.hash,
      masterSeed: this.env.seeds.master,
      seedHierarchy: clone(this.env.seeds),
      actors: clone(this.env.actors) as Actor[],
      initialControllers: clone(this.initialControllers),
      initialHash: this.initialHash,
      records: clone(this.records),
      checkpoints: clone(this.checkpoints),
      handoffs: clone(this.handoffs),
      artifacts: clone(this.artifacts),
      requests: clone(this.requests),
      ending,
      result: this.env.result(),
      finalHash: this.env.stateHash(),
      finalChain: this.chain,
    };
    const r = { ...base, digest: receiptDigest(base) };
    if (dataBytes(r) > LIMITS.receiptBytes)
      throw new Error("Receipt byte limit exceeded.");
    return freeze(r);
  }
}
const verified = new WeakSet<WorldReceipt>();
function requireEqual(a: unknown, b: unknown, message: string) {
  if (hash(a) !== hash(b)) throw new Error(message);
}
export function verifyWorldReceipt(input: unknown): WorldReceipt {
  if (verified.has(input as WorldReceipt)) return input as WorldReceipt;
  assertData(input, LIMITS.receiptBytes, 1000000, 24);
  if (
    !plain(input) ||
    !exact(input, [
      "schema",
      "runtime",
      "pack",
      "packHash",
      "worldId",
      "worldHash",
      "masterSeed",
      "seedHierarchy",
      "actors",
      "initialControllers",
      "initialHash",
      "records",
      "checkpoints",
      "handoffs",
      "artifacts",
      "requests",
      "ending",
      "result",
      "finalHash",
      "finalChain",
      "digest",
    ]) ||
    input.schema !== "world-episode@1" ||
    input.runtime !== "1.0.0" ||
    !Array.isArray(input.records) ||
    input.records.length > LIMITS.records ||
    !Array.isArray(input.checkpoints) ||
    input.checkpoints.length > LIMITS.checkpoints ||
    !Array.isArray(input.handoffs) ||
    input.handoffs.length > 32 ||
    !Array.isArray(input.artifacts) ||
    input.artifacts.length > 128 ||
    !plain(input.initialControllers) ||
    !plain(input.requests) ||
    !["stopped", "complete", "error", "budget"].includes(String(input.ending))
  )
    throw new Error("Incompatible or excessive world receipt.");
  const raw = input as unknown as WorldReceipt;
  const { digest, ...base } = raw;
  requireEqual(digest, receiptDigest(base), "World receipt integrity differs.");
  const pack = validatePack(raw.pack);
  requireEqual(raw.packHash, hash(pack), "World pack hash differs.");
  const s = pack.worlds.find((s) => s.id === raw.worldId);
  if (!s) throw new Error("Receipt world is absent from the pack.");
  const world = requireWorld(s);
  requireEqual(raw.worldHash, world.hash, "Compiled world hash differs.");
  const env = createWorldEnvironment(world, raw.masterSeed, raw.actors);
  requireEqual(raw.seedHierarchy, env.seeds, "Seed hierarchy differs.");
  requireEqual(
    raw.initialHash,
    env.stateHash(),
    "Initial world state differs.",
  );
  if (
    !exact(
      raw.initialControllers,
      env.actors.map((a) => a.id),
    ) ||
    !exact(
      raw.requests,
      env.actors.map((a) => a.id),
    )
  )
    throw new Error("Controller actor bindings differ.");
  const recorder = new WorldRecorder(env, pack, raw.initialControllers);
  let hi = 0,
    ai = 0;
  const applyArtifacts = (i: number) => {
    while (ai < raw.artifacts.length && raw.artifacts[ai].index === i) {
      const a = raw.artifacts[ai++];
      if (
        !plain(a) ||
        !exact(a, ["index", "tick", "actor", "kind", "value"]) ||
        a.tick !== env.result().tick ||
        !["memory", "plan"].includes(a.kind)
      )
        throw new Error("Public artifact attribution differs.");
      recorder.artifact(a.actor, a.kind, a.value);
    }
  };
  const applyHandoffs = (i: number) => {
    while (hi < raw.handoffs.length && raw.handoffs[hi].index === i) {
      const h = raw.handoffs[hi++];
      if (
        !plain(h) ||
        !exact(h, ["index", "tick", "actor", "from", "to", "note"]) ||
        !integer(h.index, 0, raw.records.length) ||
        h.tick !== env.result().tick ||
        !env.actors.some((a) => a.id === h.actor) ||
        h.from !== recorder.controller(h.actor).id
      )
        throw new Error("Handoff attribution differs.");
      recorder.handoff(h.actor, h.to, h.note);
    }
  };
  for (let i = 0; i < raw.records.length; i++) {
    applyHandoffs(i);
    applyArtifacts(i);
    const r = raw.records[i];
    if (
      !plain(r) ||
      !exact(r, ["index", "decisions", "frame", "chain"]) ||
      r.index !== i ||
      !Array.isArray(r.decisions) ||
      r.decisions.length < 1 ||
      r.decisions.length > env.actors.length ||
      new Set(r.decisions.map((d) => d.actor)).size !== r.decisions.length
    )
      throw new Error("Invalid world record.");
    for (const d of r.decisions) {
      if (
        !plain(d) ||
        !exact(d, [
          "actor",
          "controller",
          "action",
          "error",
          "requests",
          "note",
          "memory",
        ]) ||
        !env.actors.some((a) => a.id === d.actor) ||
        d.controller !== recorder.controller(d.actor).id ||
        !integer(d.requests, 0, 3) ||
        (d.action !== null &&
          (typeof d.action !== "string" ||
            !/^[a-z][a-z0-9-]{0,31}$/.test(d.action))) ||
        (d.note !== null &&
          (typeof d.note !== "string" || d.note.length > 200)) ||
        (d.error !== null &&
          ![
            "ILLEGAL_ACTION",
            "MALFORMED",
            "OVERSIZED",
            "EMPTY",
            "REFUSAL",
            "TIMEOUT",
            "UNAVAILABLE",
            "VERSION",
            "CANCELLED",
            "BUDGET",
            "DISCONNECTED",
          ].includes(d.error))
      )
        throw new Error("Decision attribution or bounds differ.");
      if (d.memory !== null) validateMemory(d.memory);
      if (d.requests && recorder.controller(d.actor).family !== "model")
        throw new Error("Only model decisions consume requests.");
    }
    let frame: WorldFrame | null = null;
    if (r.frame !== null) {
      if (r.decisions.some((d) => d.error !== null || d.action === null))
        throw new Error("Rejected proposals cannot execute.");
      frame = env.step(
        r.decisions.map((d) => ({ actor: d.actor, action: d.action! })),
      );
      requireEqual(
        r.frame,
        frame,
        "Recorded world transition or hidden state differs.",
      );
    } else if (!r.decisions.some((d) => d.error !== null))
      throw new Error(
        "A non-executing record needs an explicit controller error.",
      );
    recorder.append(r.decisions, frame);
    requireEqual(
      r.chain,
      recorder.records[i].chain,
      "World hash chain differs.",
    );
  }
  applyHandoffs(raw.records.length);
  applyArtifacts(raw.records.length);
  if (ai !== raw.artifacts.length)
    throw new Error("Public artifact order differs.");
  if (hi !== raw.handoffs.length) throw new Error("Handoff order differs.");
  requireEqual(
    raw.checkpoints,
    recorder.checkpoints,
    "Verified checkpoints differ.",
  );
  if (
    !env.actors.every((a) =>
      integer(raw.requests[a.id], recorder.requests[a.id], 4096),
    )
  )
    throw new Error("Request accounting differs.");
  requireEqual(raw.result, env.result(), "World result differs.");
  requireEqual(raw.finalHash, env.stateHash(), "Final state differs.");
  requireEqual(
    raw.finalChain,
    recorder.finish().finalChain,
    "Final chain differs.",
  );
  if (raw.ending === "complete" && !env.result().terminal)
    throw new Error("A running world cannot claim campaign completion.");
  const result = freeze(clone(raw));
  verified.add(result);
  return result;
}
export function inspectWorldReceipt(
  input: unknown,
  index: number,
): {
  state: WorldState;
  record: WorldRecord | null;
  result: WorldResult;
  environment: WorldEnvironment;
} {
  const r = verifyWorldReceipt(input);
  if (!integer(index, 0, r.records.length))
    throw new Error("Invalid replay index.");
  const world = requireWorld(r.pack.worlds.find((s) => s.id === r.worldId));
  const env = createWorldEnvironment(world, r.masterSeed, r.actors);
  const checkpoint = r.checkpoints.filter((c) => c.index <= index).at(-1)!;
  hydrateVerifiedWorld(env, checkpoint.state, checkpoint.stateHash);
  for (const row of r.records.slice(checkpoint.index, index))
    if (row.frame)
      env.step(
        row.decisions.map((d) => ({ actor: d.actor, action: d.action! })),
      );
  return {
    state: env.snapshot(),
    record: index ? r.records[index - 1] : null,
    result: env.result(),
    environment: env,
  };
}
