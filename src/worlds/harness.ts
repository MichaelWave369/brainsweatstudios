import { requireWorld } from "./compiler.ts";
import { chooseWorldAction } from "./controllers.ts";
import { generateExperiment, runWorldBatch } from "./experiments.ts";
import { baselineController, verifyWorldReceipt } from "./receipts.ts";
import { createWorldEnvironment } from "./runtime.ts";
import { WorldSession } from "./session.ts";
import { townPack, townZero } from "./townZero.ts";
async function campaign(days: 7 | 30) {
  const s = new WorldSession(townPack(days));
  while (s.status === "READY" && !s.env.result().terminal) await s.step();
  return s.receipt();
}
export async function runWorldHarness() {
  const now = () => performance.now();
  const capacities: {
    steps: number;
    episodes: number;
    milliseconds: number;
  }[] = [];
  for (const count of [1000, 10000]) {
    const start = now();
    let steps = 0,
      episodes = 0;
    while (steps < count) {
      const env = createWorldEnvironment(
        requireWorld(townZero(30)),
        369 + episodes++,
      );
      while (!env.result().terminal && steps < count) {
        const actor = env.actors[env.snapshot().turn].id;
        env.step([{ actor, action: chooseWorldAction(env.observe(actor)) }]);
        steps++;
      }
    }
    capacities.push({
      steps,
      episodes,
      milliseconds: Math.round(now() - start),
    });
  }
  const start7 = now(),
    seven = await campaign(7),
    ms7 = Math.round(now() - start7),
    start30 = now(),
    thirty = await campaign(30),
    ms30 = Math.round(now() - start30),
    verifyStart = now();
  verifyWorldReceipt(thirty);
  const verifyMs = Math.round(now() - verifyStart);
  const generateStart = now(),
    hundred = generateExperiment(townZero(), 25),
    generateMs = Math.round(now() - generateStart),
    batchStart = now();
  const batch = runWorldBatch(
    generateExperiment(townZero(), 5, [
      {
        id: "maintenance",
        family: "baseline",
        provider: "none",
        model: "public-baseline",
        baseline: "maintenance-first",
        context: "STATE_ONLY",
        requestBudget: 1000,
        timeoutMs: 10000,
        decisionInterval: 1,
        temperature: 0,
        seed: 369,
      },
    ]),
  );
  let trials = 0;
  while (!(await batch.next()).done) trials++;
  const batchMs = Math.round(now() - batchStart);
  const hundredStart = now(),
    hundredBatch = runWorldBatch(
      generateExperiment(townZero(), 25, [baselineController("maintenance")]),
    );
  let hundredTrials = 0;
  while (!(await hundredBatch.next()).done) hundredTrials++;
  const hundredMs = Math.round(now() - hundredStart);
  if (
    !seven.result.success ||
    !thirty.result.success ||
    trials !== 20 ||
    hundredTrials !== 100 ||
    hundred.instances.length !== 100
  )
    throw new Error("Town Zero harness failed.");
  return {
    schema: "world-performance@1",
    runtime: "1.0.0",
    reference: "Town Zero hourly 7/30-day curricula",
    capacities,
    capacityNote:
      "Authoritative steps across reset 30-day campaigns; not a claim of a 10,000-hour single scenario.",
    campaigns: [
      {
        days: 7,
        ticks: seven.result.tick,
        milliseconds: ms7,
        receiptBytes: new TextEncoder().encode(JSON.stringify(seven)).length,
      },
      {
        days: 30,
        ticks: thirty.result.tick,
        milliseconds: ms30,
        receiptBytes: new TextEncoder().encode(JSON.stringify(thirty)).length,
      },
    ],
    receiptVerificationMs: verifyMs,
    batch: { worlds: trials, milliseconds: batchMs },
    sequentialEpisodes: { episodes: hundredTrials, milliseconds: hundredMs },
    generated: {
      instances: hundred.instances.length,
      milliseconds: generateMs,
    },
    realModel: "NOT_RUN",
    claims:
      "Machine-specific descriptive measurements; no IQ, certification, real-model or arbitrary-scale claim.",
  };
}
