import { expect, it } from "vitest";
import { clone, hash } from "../src/runtime/data";
import { requireWorld } from "../src/worlds/compiler";
import {
  generateExperiment,
  memoryExperiment,
  runWorldTrial,
  mutateWorld,
  runWorldBatch,
  validateWorldExperiment,
} from "../src/worlds/experiments";
import {
  validateBatchReport,
  validateWorldSave,
  freshWorldSave,
} from "../src/worlds/notebook";
import { inspectWorldReceipt } from "../src/worlds/receipts";
import { freshMemory, verifyWorldReceipt } from "../src/worlds/receipts";
import { WorldSession } from "../src/worlds/session";
import { townPack, townZero, tutorialWorld } from "../src/worlds/townZero";

it("generates generic families with no optional resources or scheduled events", () => {
  const s = tutorialWorld();
  s.resources = [];
  s.events = [];
  s.roles[0].resources = [];
  s.roles[0].actions = ["wait"];
  s.actions = [s.actions[0]];
  s.objectives[0].condition = { op: "gte", ref: "tick", value: 1 };
  const m = generateExperiment(s, 1);
  expect(m.family.allowedMutations).toEqual([]);
  expect(validateWorldExperiment(m).instances).toHaveLength(4);
});

it("freezes separate public context strategies and rejects trials outside the manifest", async () => {
  const m = memoryExperiment(tutorialWorld(), 1);
  expect(m.controllers.map((c) => c.context)).toEqual([
    "STATE_ONLY",
    "RECENT_WINDOW",
    "BOUNDED_NOTEBOOK",
  ]);
  await expect(
    runWorldTrial(m, "unknown", m.controllers[0].id),
  ).rejects.toThrow();
  const a = await runWorldTrial(m, m.instances[0].id, m.controllers[0].id);
  const b = await runWorldTrial(m, m.instances[0].id, m.controllers[0].id);
  expect(a).toEqual(b);
  expect(a.summary.controller).toBe(m.controllers[0].id);
});
it("generates 100 reproducible bounded instances with disjoint frozen partitions", () => {
  const a = generateExperiment(townZero(), 25),
    b = generateExperiment(townZero(), 25);
  expect(a).toEqual(b);
  expect(a.instances).toHaveLength(100);
  expect(new Set(a.instances.map((i) => i.id)).size).toBe(100);
  expect(validateWorldExperiment(a).family.holdoutPolicy).toBe(
    "frozen-no-tuning",
  );
  expect(
    a.instances
      .filter((i) => i.partition === "HOLDOUT")
      .every((i) => i.changed.length === 0),
  ).toBe(true);
});
it("rejects redigested split leakage and undeclared transfer capabilities", () => {
  const a = clone(generateExperiment(townZero()));
  a.instances[2] = clone(a.instances[0]);
  a.instances[2].partition = "HOLDOUT";
  const { digest, ...data } = a;
  void digest;
  a.digest = hash(data);
  expect(() => validateWorldExperiment(a)).toThrow();
  expect(() =>
    mutateWorld(townZero(), [
      { type: "reserve-scale", resource: "energy", percent: 100000 },
    ]),
  ).toThrow();
});
it("mutations affect bounded reserves, event schedules and reachable map connectivity", () => {
  const a = townZero(),
    b = mutateWorld(a, [
      { type: "reserve-scale", resource: "energy", percent: 70 },
      { type: "event-shift", event: "storm", ticks: 12 },
      { type: "blocked-location", location: "bridge" },
    ]);
  expect(b.resources[0].initial).toBe(126);
  expect(b.events.find((e) => e.id === "storm")!.at).toBe(108);
  expect(b.locations.find((l) => l.id === "bridge")!.neighbors).toEqual([]);
  expect(requireWorld(b).hash).not.toBe(requireWorld(a).hash);
});
it("runs and reproduces frozen controller distributions from the same instances", async () => {
  const manifest = generateExperiment(townZero(), 1);
  const run = async () => {
    const g = runWorldBatch(manifest);
    while (true) {
      const n = await g.next();
      if (n.done) return n.value;
      expect(n.value.receipt.result.tick).toBeLessThanOrEqual(168);
    }
  };
  const a = await run(),
    b = await run();
  expect(a).toEqual(b);
  expect(a.trials).toHaveLength(8);
  expect(validateBatchReport(a, manifest)).toEqual(a);
  expect(a.groups[0].completion.count).toBe(1);
  const bad = clone(a);
  bad.groups[0].completion.mean++;
  expect(() => validateBatchReport(bad, manifest)).toThrow();
}, 15000);
it("inspects verified checkpoint segments without changing the campaign or original receipt", async () => {
  const s = new WorldSession(townPack());
  for (let i = 0; i < 140; i++) await s.step();
  const r = s.receipt(),
    before = s.env.stateHash();
  for (const index of [0, 96, 117, 140]) {
    const v = inspectWorldReceipt(r, index);
    expect(v.result.tick).toBe(index);
    expect(s.env.stateHash()).toBe(before);
  }
  expect(inspectWorldReceipt(r, 140).environment.stateHash()).toBe(r.finalHash);
});
it("bounded save imports fail atomically for corrupt receipts and leave legacy missing data empty", async () => {
  expect(validateWorldSave(undefined)).toEqual(freshWorldSave());
  const s = new WorldSession(townPack());
  await s.step();
  const saved = validateWorldSave({
    ...freshWorldSave(),
    pack: townPack(),
    receipt: s.receipt(),
  });
  const bad = clone(saved);
  bad.receipt!.finalHash = "0".repeat(64);
  expect(() => validateWorldSave(bad)).toThrow();
  expect(saved.receipt!.result.tick).toBe(1);
});

it("persists controller-owned memory and structured plans without changing world authority", async () => {
  const s = new WorldSession(townPack()),
    before = s.env.stateHash();
  s.setMemory("planner", {
    ...freshMemory(),
    facts: ["Inspection still needed."],
    commitments: ["Keep the reserve."],
  });
  s.setPlan("planner", {
    schema: "world-plan@1",
    goal: "Maintain the settlement",
    steps: ["Inspect", "Maintain"],
    risks: ["Delayed wear"],
    fallbacks: ["Request supplies"],
  });
  expect(s.env.stateHash()).toBe(before);
  await s.step();
  const r = verifyWorldReceipt(s.receipt()),
    restored = WorldSession.restore(r);
  expect(restored.memories.planner.facts).toEqual(["Inspection still needed."]);
  expect(restored.plans.planner.steps).toEqual(["Inspect", "Maintain"]);
  expect(restored.status).toBe("STOPPED");
  expect(r.artifacts.map((a) => a.kind)).toEqual(["memory", "plan"]);
});
