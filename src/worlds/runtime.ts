import { clone, exact, freeze, hash, integer, plain } from "../runtime/data.ts";
import { visible } from "./compiler.ts";
import {
  LIMITS,
  type Actor,
  type CompiledWorld,
  type Effect,
  type Intent,
  type LedgerEntry,
  type Predicate,
  type Ref,
  type Resolution,
  type Scheduled,
  type SeedHierarchy,
  type WorldEnvironment,
  type WorldFrame,
  type WorldObservation,
  type WorldResult,
  type WorldState,
} from "./types.ts";

export function seedHierarchy(master: number): Readonly<SeedHierarchy> {
  if (!integer(master, 0, 999999))
    throw new Error("Choose a finite master seed from 0 to 999999.");
  const derive = (name: string) =>
    parseInt(hash({ master, name }).slice(0, 8), 16) || 1;
  return freeze({
    master,
    map: derive("map"),
    resource: derive("resource"),
    event: derive("event"),
    weather: derive("weather"),
    observation: derive("observation"),
    presentation: derive("presentation"),
  });
}
export const nextRandom = (state: number) => {
  let n = state;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return n >>> 0;
};
const hydration = new WeakMap<
  WorldEnvironment,
  (state: WorldState, hash: string) => void
>();
// Host-only replay helper. Receipt callers first verify the complete recording;
// a supplied hash alone is never treated as proof of a legitimate checkpoint.
export function hydrateVerifiedWorld(
  env: WorldEnvironment,
  state: WorldState,
  expectedHash: string,
) {
  const restore = hydration.get(env);
  if (!restore) throw new Error("Unknown replay environment.");
  restore(state, expectedHash);
}
function read(state: WorldState, ref: Ref): number | boolean | string {
  if (ref === "tick") return state.tick;
  const [kind, id] = ref.split(":");
  if (kind === "resource") return state.resources[id];
  if (kind === "entity") return state.entities[id].status;
  if (kind === "flag") return state.flags[id];
  return state.objectives[id];
}
export function evaluate(rule: Predicate, state: WorldState): boolean {
  if (rule.op === "all") return rule.rules.every((r) => evaluate(r, state));
  if (rule.op === "any") return rule.rules.some((r) => evaluate(r, state));
  if (rule.op === "not") return !evaluate(rule.rule, state);
  if (!("ref" in rule)) return false;
  const a = read(state, rule.ref),
    b = rule.value;
  if (rule.op === "eq") return a === b;
  if (rule.op === "ne") return a !== b;
  if (rule.op === "contains") return String(a).includes(String(b));
  if (rule.op === "lt") return Number(a) < Number(b);
  if (rule.op === "lte") return Number(a) <= Number(b);
  if (rule.op === "gt") return Number(a) > Number(b);
  return Number(a) >= Number(b);
}
export function validateActors(
  world: CompiledWorld,
  input: Actor[],
): readonly Actor[] {
  if (
    !Array.isArray(input) ||
    input.length !== world.spec.roles.length ||
    !input.every(
      (a) =>
        plain(a) &&
        exact(a, ["id", "role"]) &&
        typeof a.id === "string" &&
        /^[a-z][a-z0-9-]{0,31}$/.test(a.id) &&
        world.roles[a.role],
    ) ||
    new Set(input.map((a) => a.id)).size !== input.length ||
    new Set(input.map((a) => a.role)).size !== input.length
  )
    throw new Error("Use exactly one uniquely named actor per world role.");
  // Authority order comes from the spec, never input or promise completion order.
  return freeze(
    world.spec.roles.map((r) => clone(input.find((a) => a.role === r.id)!)),
  );
}
export function createWorldEnvironment(
  world: CompiledWorld,
  master = 369,
  input: Actor[] = world.spec.roles.map((r) => ({ id: r.id, role: r.id })),
): WorldEnvironment {
  const spec = world.spec,
    seeds = seedHierarchy(master),
    actors = validateActors(world, input);
  let state: WorldState = {
    tick: 0,
    turn: 0,
    resources: Object.fromEntries(spec.resources.map((r) => [r.id, r.initial])),
    entities: Object.fromEntries(
      spec.entities.map((e) => [
        e.id,
        { status: e.status, location: e.location },
      ]),
    ),
    flags: Object.fromEntries(spec.flags.map((f) => [f.id, f.initial])),
    objectives: Object.fromEntries(
      spec.objectives.map((o) => [o.id, "pending"]),
    ),
    busy: Object.fromEntries(actors.map((a) => [a.id, 0])),
    positions: Object.fromEntries(
      actors.map((a) => [a.id, world.roles[a.role].locations[0]]),
    ),
    revealed: Object.fromEntries(spec.roles.map((r) => [r.id, []])),
    queue: [],
    runs: Object.fromEntries(spec.events.map((e) => [e.id, 0])),
    fired: [],
    signals: [],
    rng: seeds.event,
    serial: 0,
    failure: null,
    metrics: {
      blocked: 0,
      conflicts: 0,
      inspections: 0,
      signals: 0,
      recoveries: 0,
      recoveryTicks: 0,
      failedAt: {},
      minReserves: Object.fromEntries(
        spec.resources.map((r) => [r.id, r.initial]),
      ),
    },
  };
  let ledger: LedgerEntry[] = [],
    effectsUsed = 0;
  const entry = (
    kind: LedgerEntry["kind"],
    source: string,
    cause: string | null,
    target: string,
    before: LedgerEntry["before"],
    after: LedgerEntry["after"],
  ) => {
    if (ledger.length >= LIMITS.ledgerPerTick) throw new Error("Ledger limit.");
    const row: LedgerEntry = {
      id: `l-${++state.serial}`,
      tick: state.tick,
      kind,
      source,
      cause,
      target,
      before,
      after,
    };
    ledger.push(row);
    return row.id;
  };
  const result = (): WorldResult => {
    const terminal =
      state.failure !== null || state.tick >= spec.clock.maxTicks;
    const critical = spec.objectives.filter((o) => o.critical),
      success =
        terminal &&
        state.failure === null &&
        critical.every((o) => state.objectives[o.id] === "complete");
    return freeze({
      terminal,
      success,
      reason:
        state.failure ||
        (!terminal
          ? "running"
          : success
            ? "campaign-complete"
            : critical.find((o) => state.objectives[o.id] !== "complete")
                ?.failure || "DEADLINE_MISSED"),
      tick: state.tick,
      completion:
        spec.objectives.filter((o) => state.objectives[o.id] === "complete")
          .length / spec.objectives.length,
      reserves: clone(state.resources),
      blocked: state.metrics.blocked,
      conflicts: state.metrics.conflicts,
      inspections: state.metrics.inspections,
      signals: state.metrics.signals,
      recoveries: state.metrics.recoveries,
      recoveryTicks: state.metrics.recoveryTicks,
    });
  };
  const actor = (id: string) => {
    const a = actors.find((a) => a.id === id);
    if (!a) throw new Error("Unknown actor.");
    return a;
  };
  const revealed = (role: string, key: string) =>
    state.revealed[role].includes(key);
  const available = (a: Actor) =>
    result().terminal ||
    (spec.turnMode === "ordered" && actors[state.turn].id !== a.id)
      ? []
      : world.roles[a.role].actions
          .filter((id) => state.busy[a.id] <= state.tick || id === "wait")
          .map((id) => world.actions[id]);
  const observe = (id: string): WorldObservation => {
    const a = actor(id),
      position = state.positions[id];
    const resources = Object.fromEntries(
      spec.resources.map((r) => {
        const known = revealed(a.role, `resource:${r.id}`);
        let value: number | string = "UNKNOWN";
        if (known || visible(r.visibility, a.role, state.tick, position)) {
          value = state.resources[r.id];
          if (!known && r.visibility.mode === "bucket") {
            const b = r.visibility.thresholds.findIndex(
              (n) => Number(value) <= n,
            );
            value = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"][
              b < 0 ? r.visibility.thresholds.length : b
            ];
          }
        }
        return [r.id, value];
      }),
    );
    const entities = Object.fromEntries(
      spec.entities.map((e) => {
        const known =
          revealed(a.role, `entity:${e.id}`) ||
          visible(e.visibility, a.role, state.tick, position);
        return [
          e.id,
          known
            ? clone(state.entities[e.id])
            : { status: "UNKNOWN", location: e.location },
        ];
      }),
    );
    const flags = Object.fromEntries(
      spec.flags.map((f) => [
        f.id,
        revealed(a.role, `flag:${f.id}`) ||
        visible(f.visibility, a.role, state.tick, position)
          ? state.flags[f.id]
          : "UNKNOWN",
      ]),
    );
    return freeze({
      schema: "world-observation@1",
      worldHash: world.hash,
      tick: state.tick,
      day: Math.floor(state.tick / spec.clock.ticksPerDay) + 1,
      actor: clone(a),
      turn: spec.turnMode === "ordered" ? actors[state.turn].id : null,
      objective: spec.description,
      resources,
      entities,
      flags,
      objectives: clone(state.objectives),
      signals: state.signals
        .filter((s) => s.recipient === "team" || s.recipient === a.role)
        .map(clone),
      legalActions: available(a).map((x) => ({
        type: x.id,
        label: x.label,
        duration: x.duration,
        costs: clone(x.costs),
      })),
      busyUntil: state.busy[id],
      locations: clone(spec.locations),
      terminal: result().terminal,
    });
  };
  const schedule = (item: Omit<Scheduled, "id">) => {
    if (state.queue.length >= LIMITS.pending)
      throw new Error("Future event limit.");
    if (
      item.kind === "event" &&
      state.runs[item.source] +
        state.queue.filter(
          (x) => x.kind === "event" && x.source === item.source,
        ).length >=
        world.events[item.source].maxRuns
    )
      return;
    const id = `q-${++state.serial}`;
    state.queue.push({ ...item, id });
    entry("scheduled", item.source, item.cause, id, null, item.due);
  };
  const apply = (
    effects: readonly Effect[],
    source: string,
    cause: string | null,
    who: string | null,
  ) => {
    for (const e of effects) {
      if (++effectsUsed > LIMITS.effectsPerTick)
        throw new Error("Effect limit.");
      if (e.type === "resource") {
        const r = spec.resources.find((r) => r.id === e.id)!,
          before = state.resources[e.id],
          after = Math.max(r.min, Math.min(r.max, before + e.delta));
        state.resources[e.id] = after;
        if (before !== after)
          entry("resource", source, cause, e.id, before, after);
      }
      if (e.type === "entity") {
        const before = state.entities[e.id].status;
        state.entities[e.id].status = e.status;
        if (before !== e.status) {
          entry("entity", source, cause, e.id, before, e.status);
          if (e.status === 0) state.metrics.failedAt[e.id] = state.tick;
          else if (before === 0 && state.metrics.failedAt[e.id] !== undefined) {
            state.metrics.recoveries++;
            state.metrics.recoveryTicks +=
              state.tick - state.metrics.failedAt[e.id];
            delete state.metrics.failedAt[e.id];
          }
        }
      }
      if (e.type === "flag") {
        const before = state.flags[e.id];
        state.flags[e.id] = e.value;
        if (before !== e.value)
          entry("flag", source, cause, e.id, before, e.value);
      }
      if (e.type === "move") {
        const before = state.entities[e.entity].location;
        state.entities[e.entity].location = e.location;
        entry("move", source, cause, e.entity, before, e.location);
      }
      if (e.type === "reveal") {
        for (const role of e.roles) {
          const key = `${e.kind}:${e.id}`;
          if (!state.revealed[role].includes(key)) {
            state.revealed[role].push(key);
            state.metrics.inspections++;
            entry("reveal", source, cause, key, null, role);
          }
        }
      }
      if (e.type === "schedule")
        schedule({
          due: state.tick + e.delay,
          kind: "event",
          source: e.event,
          cause,
          actor: who,
        });
      if (e.type === "cancel") {
        const removed = state.queue.filter(
          (q) => q.kind === "event" && q.source === e.event,
        );
        state.queue = state.queue.filter((q) => !removed.includes(q));
        removed.forEach((q) =>
          entry("cancelled", source, cause, q.id, q.due, null),
        );
      }
      if (e.type === "objective") {
        const before = state.objectives[e.id];
        state.objectives[e.id] = e.status;
        entry("objective", source, cause, e.id, before, e.status);
        const o = spec.objectives.find((o) => o.id === e.id)!;
        if (e.status === "failed" && o.critical) state.failure = o.failure;
      }
      if (e.type === "emit")
        entry("notice", source, cause, "notice", null, e.label);
      if (e.type === "signal") {
        const id = entry("signal", source, cause, e.recipient, null, e.signal);
        state.signals = [
          ...state.signals,
          {
            id,
            sender: who || "world",
            recipient: e.recipient,
            type: e.signal,
            resource: e.resource,
            amount: e.amount,
            tick: state.tick,
          },
        ].slice(-16);
        state.metrics.signals++;
      }
    }
  };
  // At reset only schedule: fixed events at zero execute on the first tick.
  for (const e of spec.events)
    if (e.at !== null)
      schedule({
        due: e.at,
        kind: "event",
        source: e.id,
        cause: null,
        actor: null,
      });
  ledger = [];
  const objectives = () => {
    for (const o of spec.objectives) {
      if (state.objectives[o.id] === "failed") continue;
      const old = state.objectives[o.id],
        ok =
          evaluate(o.condition, state) &&
          o.requires.every((r) => state.objectives[r] === "complete");
      let next: WorldState["objectives"][string] = ok ? "complete" : "pending";
      if (!ok && o.deadline !== null && state.tick >= o.deadline)
        next = "failed";
      state.objectives[o.id] = next;
      if (old !== next) entry("objective", o.id, null, o.id, old, next);
      if (next === "failed" && o.critical) state.failure = o.failure;
    }
  };
  const stateHash = () => hash({ worldHash: world.hash, seeds, actors, state });
  const step = (intents: Intent[]): WorldFrame => {
    if (result().terminal) throw new Error("This campaign has ended.");
    if (
      !Array.isArray(intents) ||
      intents.length !== (spec.turnMode === "ordered" ? 1 : actors.length) ||
      new Set(intents.map((i) => i.actor)).size !== intents.length
    )
      throw new Error(
        "Supply one legal proposal for each actor in the current frame.",
      );
    for (const p of intents) {
      if (
        !plain(p) ||
        !exact(p, ["actor", "action"]) ||
        typeof p.actor !== "string" ||
        typeof p.action !== "string" ||
        !available(actor(p.actor)).some((a) => a.id === p.action)
      )
        throw new Error(
          "Role, turn or action authority rejected the proposal.",
        );
    }
    const before = clone(state);
    ledger = [];
    effectsUsed = 0;
    const resolutions: Resolution[] = [];
    const sorted = actors.flatMap((a) =>
        intents.filter((p) => p.actor === a.id),
      ),
      exclusive = new Set<string>();
    try {
      for (const p of sorted) {
        const a = world.actions[p.action];
        const actionId = entry(
          "action",
          p.action,
          null,
          p.actor,
          null,
          p.action,
        );
        let outcome: Resolution["outcome"] = "executed";
        if (state.busy[p.actor] > state.tick && p.action !== "wait")
          outcome = "busy";
        else if (
          a.exclusive &&
          (exclusive.has(a.exclusive) ||
            state.queue.some(
              (q) =>
                q.kind === "macro" &&
                world.actions[q.source].exclusive === a.exclusive,
            ))
        )
          outcome = "conflict";
        else if (
          !evaluate(a.condition, state) ||
          a.costs.some(
            (c) =>
              state.resources[c.resource] - c.amount <
              spec.resources.find((r) => r.id === c.resource)!.min,
          )
        )
          outcome = "blocked";
        if (outcome === "executed" && a.location) {
          const reached = new Set<string>([state.positions[p.actor]]),
            queue = [state.positions[p.actor]];
          while (queue.length) {
            const place = queue.shift()!;
            for (const neighbor of spec.locations.find((l) => l.id === place)!
              .neighbors)
              if (
                !reached.has(neighbor) &&
                world.roles[actor(p.actor).role].locations.includes(neighbor)
              ) {
                reached.add(neighbor);
                queue.push(neighbor);
              }
          }
          if (!reached.has(a.location)) outcome = "blocked";
        }
        if (outcome === "executed") {
          if (a.exclusive) exclusive.add(a.exclusive);
          apply(
            a.costs.map((c) => ({
              type: "resource",
              id: c.resource,
              delta: -c.amount,
            })),
            a.id,
            actionId,
            p.actor,
          );
          if (a.location) state.positions[p.actor] = a.location;
          if (a.duration) {
            state.busy[p.actor] = state.tick + a.duration;
            schedule({
              due: state.busy[p.actor],
              kind: "macro",
              source: a.id,
              cause: actionId,
              actor: p.actor,
            });
          } else apply(a.effects, a.id, actionId, p.actor);
        } else {
          state.metrics.blocked++;
          if (outcome === "conflict") state.metrics.conflicts++;
          entry("notice", a.id, actionId, p.actor, null, outcome);
        }
        resolutions.push({
          actor: p.actor,
          action: p.action,
          outcome,
          actionId,
        });
      }
      state.tick++;
      state.turn = (state.turn + 1) % actors.length;
      for (const e of spec.events)
        if (
          e.at === null &&
          e.when &&
          state.runs[e.id] < e.maxRuns &&
          !state.queue.some((q) => q.kind === "event" && q.source === e.id) &&
          evaluate(e.when, state)
        )
          schedule({
            due: state.tick,
            kind: "event",
            source: e.id,
            cause: entry("triggered", e.id, null, e.id, null, state.tick),
            actor: null,
          });
      let fired = 0;
      while (true) {
        state.queue.sort(
          (a, b) =>
            a.due - b.due || Number(a.id.slice(2)) - Number(b.id.slice(2)),
        );
        const q = state.queue[0];
        if (!q || q.due > state.tick) break;
        if (++fired > LIMITS.eventsPerTick) throw new Error("Event limit.");
        state.queue.shift();
        if (q.kind === "macro") {
          const cause = entry(
            "completed",
            q.source,
            q.cause,
            q.id,
            q.due,
            state.tick,
          );
          apply(world.actions[q.source].effects, q.source, cause, q.actor);
        } else {
          const e = world.events[q.source];
          if (state.runs[e.id] >= e.maxRuns) continue;
          state.runs[e.id]++;
          if (e.when && !evaluate(e.when, state)) {
            const cause = entry("cancelled", e.id, q.cause, q.id, q.due, null);
            if (e.repeat && state.runs[e.id] < e.maxRuns)
              schedule({
                due: q.due + e.repeat,
                kind: "event",
                source: e.id,
                cause,
                actor: q.actor,
              });
            continue;
          }
          const cause = entry(
            "triggered",
            e.id,
            q.cause,
            q.id,
            q.due,
            state.tick,
          );
          apply(e.effects, e.id, cause, q.actor);
          if (e.variants.length) {
            state.rng = nextRandom(state.rng);
            apply(
              e.variants[state.rng % e.variants.length],
              e.id,
              cause,
              q.actor,
            );
          }
          if (e.repeat && state.runs[e.id] < e.maxRuns)
            schedule({
              due: q.due + e.repeat,
              kind: "event",
              source: e.id,
              cause,
              actor: q.actor,
            });
          entry("completed", e.id, cause, q.id, null, state.tick);
        }
      }
      for (const rule of spec.rules)
        if (
          (rule.frequency === "tick" || !state.fired.includes(rule.id)) &&
          evaluate(rule.when, state)
        ) {
          const cause = entry(
            "triggered",
            rule.id,
            null,
            rule.id,
            null,
            state.tick,
          );
          apply(rule.effects, rule.id, cause, null);
          if (rule.frequency === "once") state.fired.push(rule.id);
        }
      objectives();
      for (const r of spec.resources) {
        if (!integer(state.resources[r.id], r.min, r.max))
          throw new Error("Accounting invariant.");
        state.metrics.minReserves[r.id] = Math.min(
          state.metrics.minReserves[r.id],
          state.resources[r.id],
        );
      }
    } catch {
      state = before;
      state.failure = "SIMULATION_LIMIT";
      ledger = [];
      entry("failure", "runtime", null, "campaign", null, "SIMULATION_LIMIT");
      resolutions.length = 0;
    }
    return freeze({
      tick: state.tick,
      intents: clone(sorted),
      resolutions,
      ledger: clone(ledger),
      stateHash: stateHash(),
      result: result(),
    });
  };
  const environment: WorldEnvironment = {
    world,
    actors,
    seeds,
    observe,
    step,
    snapshot: () => freeze(clone(state)),
    stateHash,
    result,
  };
  hydration.set(environment, (snapshot, expected) => {
    const previous = state;
    state = clone(snapshot);
    if (stateHash() !== expected) {
      state = previous;
      throw new Error("Verified checkpoint state differs.");
    }
  });
  return environment;
}
