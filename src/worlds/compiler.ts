import {
  clone,
  exact,
  finite,
  freeze,
  hash,
  integer,
  plain,
} from "../runtime/data.ts";
import {
  FAILURES,
  LIMITS,
  SIGNALS,
  type Compilation,
  type CompiledWorld,
  type Effect,
  type Predicate,
  type ValidationError,
  type Visibility,
  type WorldPack,
  type WorldSpec,
} from "./types.ts";

export const dataBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;
const id = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-z][a-z0-9-]{0,31}$/.test(v) &&
  !["constructor", "prototype", "__proto__"].includes(v);
const version = (v: unknown) =>
  typeof v === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v);
const safeText = (v: unknown, max: number): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= max &&
  !Array.from(v).some(
    (c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)),
  ) &&
  !/[<>`]|(?:https?:|javascript:|data:|file:)\/\/|\$\(|=>|\b(?:eval|function)\s*\(|(?:^|\s)(?:\.\.\/|\/bin\/|\/etc\/)/i.test(
    v,
  );
class Invalid extends Error {
  constructor(readonly detail: ValidationError) {
    super(detail.message);
  }
}
const fail = (path: string, message: string, code = "INVALID"): never => {
  throw new Invalid({ path, code, message });
};
const check = (test: unknown, path: string, message: string): void => {
  if (!test) fail(path, message);
};
function shape(
  v: unknown,
  keys: string[],
  path: string,
): asserts v is Record<string, unknown> {
  check(
    plain(v) && exact(v, keys),
    path,
    "Expected exactly the documented fields.",
  );
}
function list(
  v: unknown,
  max: number,
  path: string,
  min = 0,
): asserts v is unknown[] {
  check(
    Array.isArray(v) && v.length >= min && v.length <= max,
    path,
    `Expected ${min}–${max} entries.`,
  );
}
// Inspect descriptors before values: programmatic objects with getters/functions
// never execute during validation. JSON imports take this same bounded path.
export function assertData(
  value: unknown,
  maxBytes: number,
  maxNodes = 20000,
  maxDepth = 16,
): void {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const row = stack.pop()!;
    if (++nodes > maxNodes || row.depth > maxDepth)
      fail("$", "Data complexity limit exceeded.", "LIMIT");
    const v = row.value;
    if (v === null || typeof v === "boolean" || typeof v === "string") {
      if (typeof v === "string" && v.length > maxBytes)
        fail("$", "String limit exceeded.", "LIMIT");
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) fail("$", "Numbers must be finite.");
      continue;
    }
    if (!Array.isArray(v) && !plain(v))
      fail("$", "Only plain serializable data is supported.");
    if (Array.isArray(v) && v.length > maxNodes)
      fail("$", "Array limit exceeded.", "LIMIT");
    const descriptors = Object.getOwnPropertyDescriptors(v);
    for (const [key, d] of Object.entries(descriptors)) {
      if (
        ["__proto__", "prototype", "constructor"].includes(key) ||
        !("value" in d)
      )
        fail("$", "Executable accessors and prototype keys are unsupported.");
      if (Array.isArray(v) && key === "length") continue;
      stack.push({ value: d.value, depth: row.depth + 1 });
    }
    if (stack.length > maxNodes)
      fail("$", "Data complexity limit exceeded.", "LIMIT");
  }
  check(dataBytes(value) <= maxBytes, "$", "Import byte limit exceeded.");
}
export function parseWorldData(
  text: string,
  limit: number = LIMITS.packBytes,
): unknown {
  check(
    new TextEncoder().encode(text).length <= limit,
    "$",
    "Import byte limit exceeded.",
  );
  const v: unknown = JSON.parse(text);
  assertData(
    v,
    limit,
    limit > LIMITS.packBytes ? 1000000 : 20000,
    limit > LIMITS.packBytes ? 24 : 16,
  );
  return v;
}

function validateSpec(input: unknown): WorldSpec {
  assertData(input, LIMITS.specBytes);
  shape(
    input,
    [
      "schema",
      "id",
      "version",
      "title",
      "description",
      "clock",
      "turnMode",
      "roles",
      "resources",
      "locations",
      "entities",
      "flags",
      "objectives",
      "actions",
      "events",
      "rules",
      "metrics",
    ],
    "$",
  );
  check(
    input.schema === "brain-sweat-world@1" &&
      id(input.id) &&
      version(input.version),
    "$",
    "Unsupported schema, id or version.",
  );
  check(
    safeText(input.title, 80) && safeText(input.description, 600),
    "$",
    "Use bounded plain text without scripts, markup or URLs.",
  );
  shape(input.clock, ["unit", "ticksPerDay", "maxTicks"], "clock");
  check(
    ["tick", "hour", "day"].includes(String(input.clock.unit)) &&
      integer(input.clock.ticksPerDay, 1, 240) &&
      integer(input.clock.maxTicks, 1, LIMITS.ticks),
    "clock",
    "Unsupported simulation clock.",
  );
  check(
    ["ordered", "simultaneous"].includes(String(input.turnMode)),
    "turnMode",
    "Unsupported turn model.",
  );
  const maxTicks = Number(input.clock.maxTicks);
  const caps = {
    roles: LIMITS.roles,
    resources: LIMITS.resources,
    locations: LIMITS.locations,
    entities: LIMITS.entities,
    flags: LIMITS.flags,
    objectives: LIMITS.objectives,
    actions: LIMITS.actions,
    events: LIMITS.events,
    rules: LIMITS.rules,
  };
  const ids: Record<string, Set<string>> = {};
  for (const [key, cap] of Object.entries(caps)) {
    const value = input[key];
    list(
      value,
      cap,
      key,
      ["roles", "locations", "actions", "objectives"].includes(key) ? 1 : 0,
    );
    ids[key] = new Set();
    value.forEach((v, i) => {
      check(
        plain(v) && id(v.id),
        `${key}.${i}.id`,
        "Use a bounded safe identifier.",
      );
      const ident = (v as { id: string }).id;
      check(!ids[key].has(ident), `${key}.${i}.id`, "Duplicate identifier.");
      ids[key].add(ident);
    });
  }
  const reference = (kind: string, v: unknown, path: string) =>
    check(
      typeof v === "string" && ids[kind].has(v),
      path,
      `Unknown ${kind} reference.`,
    );
  const references = (kind: string, v: unknown, max: number, path: string) => {
    list(v, max, path);
    check(new Set(v).size === v.length, path, "Duplicate references.");
    v.forEach((r) => reference(kind, r, path));
  };
  const visibility = (v: unknown, path: string): void => {
    check(plain(v), path, "Invalid visibility.");
    const o = v as Record<string, unknown>;
    if (o.mode === "always" || o.mode === "hidden" || o.mode === "inspect")
      shape(o, ["mode"], path);
    else if (o.mode === "roles") {
      shape(o, ["mode", "roles"], path);
      references("roles", o.roles, LIMITS.roles, path);
    } else if (o.mode === "delayed") {
      shape(o, ["mode", "tick"], path);
      check(integer(o.tick, 0, LIMITS.ticks), path, "Invalid reveal time.");
    } else if (o.mode === "location") {
      shape(o, ["mode", "location"], path);
      reference("locations", o.location, path);
    } else if (o.mode === "bucket") {
      shape(o, ["mode", "thresholds"], path);
      list(o.thresholds, 3, path, 1);
      check(
        o.thresholds.every(
          (n, i, a) =>
            finite(n, -1000000, 1000000) && (i === 0 || n > Number(a[i - 1])),
        ),
        path,
        "Use increasing finite bucket thresholds.",
      );
    } else fail(path, "Unsupported observation capability.");
  };
  const predicate = (v: unknown, path: string, depth = 0): void => {
    check(depth <= 6, path, "Rule depth limit exceeded.");
    check(plain(v), path, "Invalid predicate.");
    const p = v as Record<string, unknown>;
    if (p.op === "all" || p.op === "any") {
      shape(p, ["op", "rules"], path);
      list(p.rules, 8, path);
      p.rules.forEach((r, i) => predicate(r, `${path}.${i}`, depth + 1));
    } else if (p.op === "not") {
      shape(p, ["op", "rule"], path);
      predicate(p.rule, path, depth + 1);
    } else {
      shape(p, ["op", "ref", "value"], path);
      check(
        ["eq", "ne", "lt", "lte", "gt", "gte", "contains"].includes(
          String(p.op),
        ),
        path,
        "Unsupported rule processor.",
      );
      check(typeof p.ref === "string", path, "Use an allowlisted reference.");
      const [kind, ident, extra] = String(p.ref).split(":");
      check(!extra, path, "Dynamic paths are unsupported.");
      if (kind === "tick")
        check(p.ref === "tick", path, "Invalid clock reference.");
      else {
        check(
          ["resource", "entity", "flag", "objective"].includes(kind),
          path,
          "Use an allowlisted reference.",
        );
        reference(
          {
            resource: "resources",
            entity: "entities",
            flag: "flags",
            objective: "objectives",
          }[kind]!,
          ident,
          path,
        );
      }
      const numeric = ["tick", "resource", "entity"].includes(kind);
      check(
        numeric
          ? finite(p.value, -1000000, 1000000) && p.op !== "contains"
          : kind === "flag"
            ? typeof p.value === "boolean" &&
              ["eq", "ne"].includes(String(p.op))
            : ["pending", "complete", "failed"].includes(String(p.value)) &&
              ["eq", "ne", "contains"].includes(String(p.op)),
        path,
        "Predicate type does not match reference.",
      );
    }
  };
  const effects = (v: unknown, path: string): void => {
    list(v, 16, path);
    v.forEach((raw, i) => {
      const p = `${path}.${i}`;
      check(plain(raw), p, "Invalid effect.");
      const e = raw as Record<string, unknown>;
      if (e.type === "resource") {
        shape(e, ["type", "id", "delta"], p);
        reference("resources", e.id, p);
        check(integer(e.delta, -100000, 100000), p, "Invalid resource delta.");
      } else if (e.type === "entity") {
        shape(e, ["type", "id", "status"], p);
        reference("entities", e.id, p);
        check(integer(e.status, 0, 100), p, "Invalid abstract status.");
      } else if (e.type === "flag") {
        shape(e, ["type", "id", "value"], p);
        reference("flags", e.id, p);
        check(typeof e.value === "boolean", p, "Invalid bounded flag.");
      } else if (e.type === "move") {
        shape(e, ["type", "entity", "location"], p);
        reference("entities", e.entity, p);
        reference("locations", e.location, p);
      } else if (e.type === "reveal") {
        shape(e, ["type", "kind", "id", "roles"], p);
        check(
          ["resource", "entity", "flag"].includes(String(e.kind)),
          p,
          "Invalid sensor target.",
        );
        reference(
          { resource: "resources", entity: "entities", flag: "flags" }[
            String(e.kind)
          ]!,
          e.id,
          p,
        );
        references("roles", e.roles, 4, p);
      } else if (e.type === "schedule") {
        shape(e, ["type", "event", "delay"], p);
        reference("events", e.event, p);
        check(
          integer(e.delay, 1, LIMITS.ticks),
          p,
          "Delayed events need positive bounded time.",
        );
      } else if (e.type === "cancel") {
        shape(e, ["type", "event"], p);
        reference("events", e.event, p);
      } else if (e.type === "objective") {
        shape(e, ["type", "id", "status"], p);
        reference("objectives", e.id, p);
        check(
          ["complete", "failed"].includes(String(e.status)),
          p,
          "Invalid objective transition.",
        );
      } else if (e.type === "emit") {
        shape(e, ["type", "label"], p);
        check(safeText(e.label, 120), p, "Use a bounded plain event label.");
      } else if (e.type === "signal") {
        shape(e, ["type", "recipient", "signal", "resource", "amount"], p);
        if (e.recipient !== "team") reference("roles", e.recipient, p);
        check(
          SIGNALS.includes(e.signal as (typeof SIGNALS)[number]) &&
            (e.resource === null ||
              (typeof e.resource === "string" &&
                ids.resources.has(e.resource))) &&
            (e.amount === null || integer(e.amount, 0, 100000)),
          p,
          "Invalid structured signal.",
        );
      } else fail(p, "Unsupported effect capability.");
    });
  };
  for (const [kind, keys] of Object.entries({
    resources: ["id", "label", "min", "max", "initial", "visibility"],
    locations: ["id", "label", "x", "y", "neighbors"],
    entities: ["id", "label", "location", "status", "visibility"],
    flags: ["id", "initial", "visibility"],
    roles: ["id", "label", "actions", "resources", "locations", "signals"],
    objectives: [
      "id",
      "label",
      "parent",
      "requires",
      "scope",
      "condition",
      "critical",
      "deadline",
      "failure",
    ],
    actions: [
      "id",
      "label",
      "costs",
      "condition",
      "effects",
      "duration",
      "exclusive",
      "location",
    ],
    events: [
      "id",
      "label",
      "at",
      "when",
      "repeat",
      "maxRuns",
      "effects",
      "variants",
    ],
    rules: ["id", "when", "frequency", "effects"],
  })) {
    (input[kind] as unknown[]).forEach((v, i) => {
      const p = `${kind}.${i}`;
      shape(v, keys, p);
      if ("label" in v)
        check(safeText(v.label, 80), p, "Use a bounded plain label.");
      if (kind === "resources") {
        check(
          integer(v.min, 0, 1000000) &&
            integer(v.max, 1, 1000000) &&
            Number(v.min) < Number(v.max) &&
            integer(v.initial, Number(v.min), Number(v.max)),
          p,
          "Invalid resource bounds.",
        );
        visibility(v.visibility, p);
      }
      if (kind === "locations") {
        check(
          finite(v.x, 0, 100) && finite(v.y, 0, 100),
          p,
          "Invalid map coordinates.",
        );
        references("locations", v.neighbors, 16, p);
        check(
          !(v.neighbors as string[]).includes(String(v.id)),
          p,
          "Self edges are unsupported.",
        );
      }
      if (kind === "entities") {
        reference("locations", v.location, p);
        check(integer(v.status, 0, 100), p, "Invalid entity status.");
        visibility(v.visibility, p);
      }
      if (kind === "flags") {
        check(typeof v.initial === "boolean", p, "Invalid flag.");
        visibility(v.visibility, p);
      }
      if (kind === "roles") {
        references("actions", v.actions, 48, p);
        references("resources", v.resources, 16, p);
        references("locations", v.locations, 16, p);
        check(
          typeof v.signals === "boolean" &&
            (v.locations as string[]).length > 0,
          p,
          "Role needs a location and communication permission.",
        );
      }
      if (kind === "objectives") {
        if (v.parent !== null) reference("objectives", v.parent, p);
        references("objectives", v.requires, 24, p);
        check(
          ["campaign", "day", "task"].includes(String(v.scope)) &&
            typeof v.critical === "boolean" &&
            (v.deadline === null || integer(v.deadline, 1, maxTicks)) &&
            FAILURES.includes(v.failure as (typeof FAILURES)[number]),
          p,
          "Invalid objective policy.",
        );
        predicate(v.condition, p);
      }
      if (kind === "actions") {
        list(v.costs, 16, p);
        const costs = new Set<string>();
        v.costs.forEach((c) => {
          shape(c, ["resource", "amount"], p);
          reference("resources", c.resource, p);
          check(
            integer(c.amount, 0, 100000) && !costs.has(String(c.resource)),
            p,
            "Duplicate or invalid cost.",
          );
          costs.add(String(c.resource));
        });
        predicate(v.condition, p);
        effects(v.effects, p);
        check(
          integer(v.duration, 0, 72) &&
            (v.exclusive === null || id(v.exclusive)),
          p,
          "Invalid bounded macro action.",
        );
        if (v.location !== null) reference("locations", v.location, p);
      }
      if (kind === "events") {
        check(
          (v.at === null || integer(v.at, 0, maxTicks)) &&
            integer(v.repeat, 0, LIMITS.ticks) &&
            integer(v.maxRuns, 1, 10000),
          p,
          "Invalid bounded event schedule.",
        );
        if (v.when !== null) predicate(v.when, p);
        effects(v.effects, p);
        list(v.variants, 4, p);
        v.variants.forEach((e) => effects(e, p));
      }
      if (kind === "rules") {
        check(
          ["once", "tick"].includes(String(v.frequency)),
          p,
          "Unsupported rule frequency.",
        );
        predicate(v.when, p);
        effects(v.effects, p);
      }
    });
  }
  list(input.metrics, 6, "metrics");
  check(
    input.metrics.every((m) =>
      [
        "completion",
        "reserves",
        "recovery",
        "coordination",
        "information",
        "invalid-actions",
      ].includes(String(m)),
    ) && new Set(input.metrics).size === input.metrics.length,
    "metrics",
    "Unsupported or duplicated metrics.",
  );
  const spec = input as unknown as WorldSpec;
  const acyclic = (graph: Record<string, string[]>, path: string) => {
    const active = new Set<string>(),
      done = new Set<string>();
    const visit = (n: string) => {
      check(
        !active.has(n),
        path,
        "Circular dependency or event scheduling is unsupported.",
      );
      if (done.has(n)) return;
      active.add(n);
      graph[n].forEach(visit);
      active.delete(n);
      done.add(n);
    };
    Object.keys(graph).forEach(visit);
  };
  acyclic(
    Object.fromEntries(
      spec.objectives.map((o) => [
        o.id,
        [...o.requires, ...(o.parent ? [o.parent] : [])],
      ]),
    ),
    "objectives",
  );
  acyclic(
    Object.fromEntries(
      spec.events.map((e) => [
        e.id,
        [...e.effects, ...e.variants.flat()]
          .filter(
            (x): x is Extract<Effect, { type: "schedule" }> =>
              x.type === "schedule",
          )
          .map((x) => x.event),
      ]),
    ),
    "events",
  );
  const required = (
    es: Effect[],
  ): { resources: string[]; locations: string[]; signals: boolean } => {
    const resources: string[] = [],
      locations: string[] = [];
    let signals = false;
    const visit = (items: Effect[], seen: Set<string>) =>
      items.forEach((e) => {
        if (e.type === "resource") resources.push(e.id);
        if (e.type === "move") locations.push(e.location);
        if (e.type === "entity")
          locations.push(spec.entities.find((x) => x.id === e.id)!.location);
        if (e.type === "signal") signals = true;
        if (e.type === "schedule" && !seen.has(e.event)) {
          seen.add(e.event);
          const ev = spec.events.find((x) => x.id === e.event)!;
          visit([...ev.effects, ...ev.variants.flat()], seen);
        }
      });
    visit(es, new Set());
    return { resources, locations, signals };
  };
  for (const role of spec.roles)
    for (const actionId of role.actions) {
      const a = spec.actions.find((x) => x.id === actionId)!,
        req = required(a.effects);
      check(
        [...a.costs.map((c) => c.resource), ...req.resources].every((r) =>
          role.resources.includes(r),
        ) &&
          [...req.locations, ...(a.location ? [a.location] : [])].every((l) =>
            role.locations.includes(l),
          ) &&
          (!req.signals || role.signals),
        `roles.${role.id}`,
        "An action exceeds role resource, location or signal authority.",
      );
    }
  return freeze(clone(spec));
}
export function compileWorld(input: unknown): Compilation {
  try {
    const spec = validateSpec(input);
    const world: CompiledWorld = freeze({
      spec,
      hash: hash(spec),
      actions: Object.fromEntries(spec.actions.map((a) => [a.id, a])),
      events: Object.fromEntries(spec.events.map((e) => [e.id, e])),
      roles: Object.fromEntries(spec.roles.map((r) => [r.id, r])),
    });
    return { ok: true, world };
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Invalid
          ? error.detail
          : {
              path: "$",
              code: "INVALID",
              message: "Malformed or unsupported world data.",
            },
      ],
    };
  }
}
export function requireWorld(input: unknown): CompiledWorld {
  const c = compileWorld(input);
  if (!c.ok)
    throw new Error(c.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
  return c.world;
}
export function validatePack(input: unknown): Readonly<WorldPack> {
  assertData(input, LIMITS.packBytes);
  shape(input, ["schema", "id", "version", "worlds"], "pack");
  check(
    input.schema === "brain-sweat-pack@1" &&
      id(input.id) &&
      version(input.version),
    "pack",
    "Unsupported pack schema.",
  );
  list(input.worlds, 4, "pack.worlds", 1);
  const worlds = input.worlds.map((w) => requireWorld(w).spec as WorldSpec);
  check(
    new Set(worlds.map((w) => w.id)).size === worlds.length,
    "pack",
    "Duplicate world ids.",
  );
  return freeze({
    schema: "brain-sweat-pack@1",
    id: input.id as string,
    version: input.version as string,
    worlds,
  });
}
export const packHash = (pack: unknown) => hash(validatePack(pack));
export const visible = (
  v: Visibility,
  role: string,
  tick: number,
  location: string,
) =>
  v.mode === "always" ||
  v.mode === "bucket" ||
  (v.mode === "roles" && v.roles.includes(role)) ||
  (v.mode === "delayed" && tick >= v.tick) ||
  (v.mode === "location" && v.location === location);
export const truth: Predicate = { op: "all", rules: [] };
