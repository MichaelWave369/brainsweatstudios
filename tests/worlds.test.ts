import { describe, expect, it } from "vitest";
import { clone, hash } from "../src/runtime/data";
import {
  compileWorld,
  packHash,
  requireWorld,
  truth,
  validatePack,
} from "../src/worlds/compiler";
import {
  createWorldEnvironment,
  evaluate,
  seedHierarchy,
} from "../src/worlds/runtime";
import {
  baselineController,
  receiptDigest,
  verifyWorldReceipt,
} from "../src/worlds/receipts";
import { WorldSession } from "../src/worlds/session";
import { townPack, townZero, tutorialWorld } from "../src/worlds/townZero";
import { mockAdapter } from "../src/agents/mock";
import {
  AgentError,
  validateRequest,
  type ProviderAdapter,
} from "../src/agents/contracts";

async function finish(s: WorldSession) {
  let count = 0;
  while (!s.env.result().terminal && s.status === "READY" && count++ < 10000)
    await s.step();
  return s.receipt();
}
describe("data-only world security", () => {
  it("compiles immutable Town Zero and tutorial packs without changing legacy versions", () => {
    const c = requireWorld(townZero());
    expect(Object.isFrozen(c.spec.actions[0])).toBe(true);
    expect(validatePack(townPack()).worlds).toHaveLength(2);
    expect(packHash(townPack())).toBe(packHash(clone(townPack())));
    expect(requireWorld(tutorialWorld()).spec.clock.maxTicks).toBe(12);
  });
  it.each([
    "scripts",
    "html",
    "url",
    "shell",
    "unknown",
    "nan",
    "infinity",
    "duplicate",
    "prototype",
    "processor",
    "deep",
    "cycle",
    "role",
    "huge",
    "objectives",
  ])("rejects %s atomically", (kind) => {
    const s = townZero() as unknown as Record<string, unknown>;
    if (kind === "scripts") s.title = "eval(alert(1))";
    if (kind === "html") s.title = "<script>x</script>";
    if (kind === "url") s.title = "https://evil.test";
    if (kind === "shell") s.title = "$(touch /tmp/x)";
    if (kind === "unknown") s.callback = "code";
    if (kind === "nan" || kind === "infinity")
      (s.resources as { initial: number }[])[0].initial =
        kind === "nan" ? NaN : Infinity;
    if (kind === "duplicate")
      (s.resources as unknown[]).push((s.resources as unknown[])[0]);
    if (kind === "prototype")
      s.description = JSON.parse('{"__proto__":{"polluted":true}}');
    if (kind === "processor")
      (s.rules as { effects: unknown[] }[])[0].effects = [
        { type: "execute", code: "alert(1)" },
      ];
    if (kind === "deep") {
      let p: unknown = truth;
      for (let i = 0; i < 20; i++) p = { op: "not", rule: p };
      (s.rules as { when: unknown }[])[0].when = p;
    }
    if (kind === "cycle")
      (s.events as { effects: unknown[] }[])[0].effects = [
        { type: "schedule", event: "daily-demand", delay: 1 },
      ];
    if (kind === "role")
      (s.roles as { actions: string[] }[])[0].actions.push("maintain-pump");
    if (kind === "huge") s.entities = new Array(50000).fill({ id: "x" });
    if (kind === "objectives")
      (s.objectives as { requires: string[] }[])[0].requires = ["settlement"];
    const c = compileWorld(s);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors[0].path).toBeTruthy();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("never invokes executable getters", () => {
    const s = townZero();
    let calls = 0;
    Object.defineProperty(s, "title", {
      enumerable: true,
      get() {
        calls++;
        throw new Error("executed");
      },
    });
    expect(compileWorld(s).ok).toBe(false);
    expect(calls).toBe(0);
  });
  it("rejects whole packs when any world is invalid", () => {
    const p = townPack();
    p.worlds[1].actions[0].id = "constructor";
    expect(() => validatePack(p)).toThrow();
  });
});
describe("deterministic authority and causality", () => {
  it("shares a finite predicate-node budget across evaluations", () => {
    const e = createWorldEnvironment(requireWorld(tutorialWorld()));
    const budget = { remaining: 2 };
    expect(evaluate(truth, e.snapshot(), budget)).toBe(true);
    expect(evaluate(truth, e.snapshot(), budget)).toBe(true);
    expect(() => evaluate(truth, e.snapshot(), budget)).toThrow();
    expect(e.result().tick).toBe(0);
  });
  it("separates all seed streams and has no authoritative Math.random dependency", () => {
    const a = seedHierarchy(369);
    expect(new Set(Object.values(a)).size).toBe(7);
    expect(seedHierarchy(369)).toEqual(a);
    expect(() => seedHierarchy(NaN)).toThrow();
    const w = requireWorld(townZero()),
      a1 = createWorldEnvironment(w),
      a2 = createWorldEnvironment(w);
    for (let i = 0; i < 80; i++) {
      const actor = a1.actors[a1.snapshot().turn].id;
      expect(a1.step([{ actor, action: "wait" }])).toEqual(
        a2.step([{ actor, action: "wait" }]),
      );
    }
  });
  it("does not expose hidden state, RNG, future queues, or exact bucket values", () => {
    const e = createWorldEnvironment(requireWorld(townZero()));
    const p = e.observe("planner");
    expect(p.entities.pump.status).toBe("UNKNOWN");
    expect(p.resources.water).toBe("HIGH");
    expect(p.flags.daily).toBe("UNKNOWN");
    expect(JSON.stringify(p)).not.toContain("rng");
    expect(p).not.toHaveProperty("queue");
    expect(Object.isFrozen(p.entities)).toBe(true);
    const initial = e.stateHash();
    expect(() =>
      e.step([{ actor: "planner", action: "maintain-pump" }]),
    ).toThrow();
    expect(e.stateHash()).toBe(initial);
  });
  it("inspection costs time and budget and reveals only its authorized role", () => {
    const e = createWorldEnvironment(requireWorld(tutorialWorld()));
    const f = e.step([{ actor: "operator", action: "inspect-store" }]);
    expect(f.tick).toBe(1);
    expect(e.observe("operator").resources).toEqual({ water: 6, budget: 9 });
    expect(f.ledger.some((l) => l.kind === "reveal" && l.cause)).toBe(true);
  });
  it("macros consume their cost immediately and apply consequences later", () => {
    const e = createWorldEnvironment(requireWorld(tutorialWorld()));
    const f = e.step([{ actor: "operator", action: "refill" }]);
    expect(e.snapshot().resources).toEqual({ water: 6, budget: 8 });
    expect(f.ledger.some((l) => l.kind === "scheduled" && l.after === 2)).toBe(
      true,
    );
    e.step([{ actor: "operator", action: "wait" }]);
    expect(e.snapshot().resources.water).toBe(12);
  });
  it("deterministically resolves simultaneous exclusive assets and scarce resources independent of proposal order", () => {
    const spec = tutorialWorld();
    spec.turnMode = "simultaneous";
    spec.roles = [
      { ...spec.roles[0], id: "first" },
      { ...spec.roles[0], id: "second" },
    ];
    spec.actions.find((a) => a.id === "inspect-store")!.effects = [];
    spec.actions.find((a) => a.id === "refill")!.exclusive = "store";
    const w = requireWorld(spec),
      a = createWorldEnvironment(w),
      b = createWorldEnvironment(w);
    const proposals = [
      { actor: "first", action: "refill" },
      { actor: "second", action: "refill" },
    ];
    expect(a.step(proposals)).toEqual(b.step([...proposals].reverse()));
    expect(a.snapshot().resources.budget).toBe(8);
    expect(a.result().conflicts).toBe(1);
  });
  it("delayed failures record the original scheduling cause and recoverable facilities", async () => {
    const s = new WorldSession(townPack());
    for (let i = 0; i < 170 && !s.env.result().terminal; i++) {
      await s.step({});
    }
    const r = s.receipt();
    const cancellation = r.records
      .flatMap((x) => x.frame?.ledger || [])
      .find((l) => l.kind === "cancelled" && l.source === "maintain-pump");
    expect(cancellation?.before).toBe(168);
    expect(cancellation?.cause).toBeTruthy();
    expect(r.result.success).toBe(true);
  });
  it("an event explosion stops with an explicit bounded failure and rolls back partial effects", () => {
    const s = tutorialWorld();
    s.events[0].repeat = 1;
    s.events[0].maxRuns = 10000;
    s.events[0].at = 0;
    s.clock.maxTicks = 10000;
    s.rules = [
      {
        id: "flood",
        frequency: "tick",
        when: truth,
        effects: new Array(16).fill({
          type: "schedule",
          event: "demand",
          delay: 100,
        }),
      },
    ];
    const e = createWorldEnvironment(requireWorld(s));
    let n = 0;
    while (!e.result().terminal && n++ < 20)
      e.step([{ actor: "operator", action: "wait" }]);
    expect(e.result().reason).toBe("SIMULATION_LIMIT");
    expect(e.snapshot().queue.length).toBeLessThanOrEqual(128);
    expect(Object.values(e.snapshot().resources).every(Number.isFinite)).toBe(
      true,
    );
  });
});
describe("long receipts and controller interoperability", () => {
  it("resolves simultaneous model teams independently of inference completion order", async () => {
    const spec = tutorialWorld();
    spec.turnMode = "simultaneous";
    spec.roles = [
      { ...spec.roles[0], id: "first" },
      { ...spec.roles[0], id: "second" },
    ];
    spec.actions.find((a) => a.id === "inspect-store")!.effects = [];
    spec.actions.find((a) => a.id === "refill")!.exclusive = "store";
    const run = async (reverse: boolean) => {
      const observed: number[] = [];
      const controllers = Object.fromEntries(
        spec.roles.map((r) => [
          r.id,
          {
            ...baselineController(r.id),
            family: "model",
            provider: "mock",
            model: "mock-policy",
          },
        ]),
      );
      const adapters = Object.fromEntries(
        spec.roles.map((r, i) => [
          r.id,
          {
            ...mockAdapter(),
            propose: async (
              request: Parameters<ProviderAdapter["propose"]>[0],
            ) => {
              observed.push(request.observation.tick);
              await new Promise((resolve) =>
                setTimeout(resolve, i === Number(reverse) ? 20 : 1),
              );
              return {
                text: '{"action":{"type":"refill"}}',
                model: "mock-policy",
                usage: { inputTokens: null, outputTokens: null },
              };
            },
          },
        ]),
      );
      const s = new WorldSession(
        {
          schema: "brain-sweat-pack@1",
          id: "team-pack",
          version: "1.0.0",
          worlds: [spec],
        },
        spec.id,
        369,
        controllers as never,
        adapters,
      );
      await s.step();
      expect(observed).toEqual([0, 0]);
      expect(verifyWorldReceipt(s.receipt()).result.conflicts).toBe(1);
      return s.env.snapshot();
    };
    expect(await run(false)).toEqual(await run(true));
  });
  it("rejects lifecycle and artifact changes before altering session state", () => {
    const s = new WorldSession(townPack());
    s.stop();
    expect(() =>
      s.handoff("planner", {
        ...baselineController("invalid"),
        requestBudget: 0,
      }),
    ).toThrow();
    expect(s.status).toBe("STOPPED");
    expect(s.recorder.controller("planner").id).not.toBe("invalid");
    const before = s.env.stateHash();
    for (let i = 0; i < 128; i++) s.setMemory("planner", s.memories.planner);
    const memory = clone(s.memories.planner);
    expect(() =>
      s.setMemory("planner", { ...memory, facts: ["New fact"] }),
    ).toThrow();
    expect(s.memories.planner).toEqual(memory);
    expect(s.env.stateHash()).toBe(before);
    expect(verifyWorldReceipt(s.receipt()).artifacts).toHaveLength(128);
  });
  it("verifies a complete 30-day campaign, checkpoints and stopped restoration", async () => {
    const r = await finish(new WorldSession(townPack(30)));
    expect(r.result.tick).toBe(720);
    expect(r.result.success).toBe(true);
    expect(r.checkpoints.length).toBe(8);
    const v = verifyWorldReceipt(r),
      s = WorldSession.restore(v);
    expect(s.status).toBe("STOPPED");
    expect(s.env.stateHash()).toBe(v.finalHash);
    expect(s.receipt().digest).toBe(v.digest);
    expect(verifyWorldReceipt(s.receipt()).result).toEqual(v.result);
  });
  it.each(["event", "snapshot", "actor", "state", "chain", "rules"])(
    "rejects redigested %s tampering",
    async (kind) => {
      const r = clone(await finish(new WorldSession(townPack()))) as ReturnType<
        WorldSession["receipt"]
      >;
      if (kind === "event") r.records[0].frame!.ledger[0].after = "wrong";
      if (kind === "snapshot") r.checkpoints[0].state.resources.energy++;
      if (kind === "actor") r.records[0].decisions[0].actor = "infrastructure";
      if (kind === "state") r.finalHash = "f".repeat(64);
      if (kind === "chain") r.records[0].chain = "f".repeat(64);
      if (kind === "rules") r.pack.worlds[0].resources[0].initial++;
      const { digest: _d, ...base } = r;
      void _d;
      r.digest = receiptDigest(base);
      expect(() => verifyWorldReceipt(r)).toThrow();
    },
  );
  it("runs generic V7 mock providers through new public contracts without exposing hidden state", async () => {
    const p = townPack(),
      bindings = Object.fromEntries(
        p.worlds[0].roles.map((r) => [
          r.id,
          {
            ...baselineController(r.id),
            family: "model",
            provider: "mock",
            model: "mock-policy",
          },
        ]),
      );
    const s = new WorldSession(p, "town-zero", 369, bindings as never);
    const request = s.request("planner");
    expect(validateRequest(request).schema).toBe("provider-request@2");
    expect(request.observation.state).not.toHaveProperty("rng");
    expect(request.observation.state.entities).toHaveProperty(
      "pump.status",
      "UNKNOWN",
    );
    const receipt = await finish(s);
    expect(receipt.result.success).toBe(true);
    expect(verifyWorldReceipt(receipt).requests.planner).toBeGreaterThan(0);
  });
  it("preserves world state through human, model and baseline handoffs", async () => {
    const s = new WorldSession(townPack());
    await s.step();
    const actor = s.env.actors[s.env.snapshot().turn].id;
    s.handoff(actor, { ...baselineController("human"), family: "human" });
    await s.step({ [actor]: "wait" });
    s.handoff(actor, {
      ...baselineController("mock"),
      family: "model",
      provider: "mock",
      model: "mock-policy",
    });
    const r = await finish(s);
    expect(r.handoffs).toHaveLength(2);
    expect(verifyWorldReceipt(r).result.success).toBe(true);
  });
  it("pauses ignored provider cancellation, discards stale replies and counts spent calls", async () => {
    let resolve: (
      v: Awaited<ReturnType<ProviderAdapter["propose"]>>,
    ) => void = () => {};
    const mock = mockAdapter(),
      provider: ProviderAdapter = {
        ...mock,
        propose: () =>
          new Promise((r) => {
            resolve = r;
          }),
      };
    const s = new WorldSession(
      townPack(),
      "town-zero",
      369,
      {
        planner: {
          ...baselineController("slow"),
          family: "model",
          provider: "mock",
          model: "mock-policy",
        },
      },
      { planner: provider },
    );
    const before = s.env.stateHash(),
      pending = s.step();
    s.pause();
    resolve({
      text: '{"action":{"type":"wait"}}',
      model: "mock-policy",
      usage: { inputTokens: null, outputTokens: null },
    });
    await pending;
    expect(s.status).toBe("PAUSED");
    expect(s.env.stateHash()).toBe(before);
    expect(s.spent.planner).toBe(1);
    expect(verifyWorldReceipt(s.receipt()).result.tick).toBe(0);
  });
  it("times out without mutation and permits a fallback handoff", async () => {
    const provider: ProviderAdapter = {
      ...mockAdapter(),
      propose: async () => {
        throw new AgentError("TIMEOUT", "Test deadline.");
      },
    };
    const s = new WorldSession(
      townPack(),
      "town-zero",
      369,
      {
        planner: {
          ...baselineController("slow"),
          family: "model",
          provider: "mock",
          model: "mock-policy",
        },
      },
      { planner: provider },
    );
    await s.step();
    expect(s.status).toBe("ERROR");
    expect(s.env.result().tick).toBe(0);
    s.handoff("planner", baselineController("fallback"));
    expect((await finish(s)).result.success).toBe(true);
    expect(verifyWorldReceipt(s.receipt()).records[0].decisions[0].error).toBe(
      "TIMEOUT",
    );
  });
  it("request economy skips busy-role and interval inference while preserving replay", async () => {
    const s = new WorldSession(townPack(), "town-zero", 369, {
      planner: {
        ...baselineController("mock"),
        family: "model",
        provider: "mock",
        model: "mock-policy",
        decisionInterval: 12,
      },
    });
    for (let i = 0; i < 40; i++) await s.step();
    expect(s.spent.planner).toBeLessThan(10);
    expect(verifyWorldReceipt(s.receipt()).result.tick).toBe(40);
  });
  it("never trusts a claimed provider result or score", () => {
    const s = new WorldSession(townPack());
    const req = clone(s.request("planner"));
    req.observation.terminal.resources = 100;
    expect(() => validateRequest(req)).toThrow();
    expect(hash(s.env.snapshot())).toBe(hash(s.env.snapshot()));
  });
});
