import { clone, exact, hash, plain } from "../runtime/data.ts";
import { dataBytes, validatePack } from "./compiler.ts";
import {
  summarizeBatch,
  validateWorldExperiment,
  type BatchReport,
  type TrialSummary,
  type WorldExperiment,
} from "./experiments.ts";
import { verifyWorldReceipt, type WorldReceipt } from "./receipts.ts";
import type { WorldPack } from "./types.ts";
export interface WorldSave {
  schema: "world-lab@1";
  pack: WorldPack | null;
  receipt: WorldReceipt | null;
  manifest: WorldExperiment | null;
  comparison: BatchReport | null;
}
export const freshWorldSave = (): WorldSave => ({
  schema: "world-lab@1",
  pack: null,
  receipt: null,
  manifest: null,
  comparison: null,
});
export function validateBatchReport(
  input: unknown,
  manifest: WorldExperiment,
): BatchReport {
  if (
    !plain(input) ||
    !exact(input, ["schema", "manifestHash", "trials", "groups", "digest"]) ||
    input.schema !== "world-batch@1" ||
    input.manifestHash !== manifest.digest ||
    !Array.isArray(input.trials) ||
    input.trials.length !==
      manifest.instances.length * manifest.controllers.length
  )
    throw new Error("Invalid frozen comparison.");
  const trials = input.trials as TrialSummary[],
    seen = new Set<string>();
  for (const t of trials) {
    const i = manifest.instances.find((i) => i.id === t.instance),
      c = manifest.controllers.find((c) => c.id === t.controller),
      key = `${t.instance}:${t.controller}`;
    if (
      !plain(t) ||
      !exact(t, [
        "instance",
        "partition",
        "controller",
        "seed",
        "worldHash",
        "receiptHash",
        "success",
        "ticks",
        "completion",
        "reserves",
        "blocked",
        "conflicts",
        "recoveries",
        "recoveryTicks",
        "inspections",
        "failure",
        "requests",
      ]) ||
      !i ||
      !c ||
      seen.has(key) ||
      t.partition !== i.partition ||
      t.seed !== i.seed ||
      t.worldHash !== i.worldHash ||
      typeof t.receiptHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(t.receiptHash) ||
      typeof t.success !== "boolean" ||
      typeof t.failure !== "string" ||
      t.failure.length > 40 ||
      ![
        "ticks",
        "completion",
        "reserves",
        "blocked",
        "conflicts",
        "recoveries",
        "recoveryTicks",
        "inspections",
        "requests",
      ].every(
        (k) =>
          typeof t[k as keyof TrialSummary] === "number" &&
          Number.isFinite(t[k as keyof TrialSummary]) &&
          Number(t[k as keyof TrialSummary]) >= 0 &&
          Number(t[k as keyof TrialSummary]) <= 100000000,
      ) ||
      t.ticks > i.spec.clock.maxTicks ||
      t.completion > 1
    )
      throw new Error("Comparison attribution or metric bounds differ.");
    seen.add(key);
  }
  const expected = summarizeBatch(manifest, trials);
  if (hash(input) !== hash(expected))
    throw new Error("Comparison distribution or integrity differs.");
  return expected;
}
export function validateWorldSave(input: unknown): WorldSave {
  if (input === undefined) return freshWorldSave();
  if (
    !plain(input) ||
    !exact(input, ["schema", "pack", "receipt", "manifest", "comparison"]) ||
    input.schema !== "world-lab@1" ||
    dataBytes(input) > 1100000
  )
    throw new Error("Invalid or excessive world lab save.");
  const pack =
      input.pack === null
        ? null
        : (clone(validatePack(input.pack)) as WorldPack),
    receipt = input.receipt === null ? null : verifyWorldReceipt(input.receipt),
    manifest =
      input.manifest === null ? null : validateWorldExperiment(input.manifest);
  if (input.comparison !== null && !manifest)
    throw new Error("A comparison needs its frozen manifest.");
  const comparison =
    input.comparison === null
      ? null
      : validateBatchReport(input.comparison, manifest!);
  return { schema: "world-lab@1", pack, receipt, manifest, comparison };
}
export function rememberWorld(
  save: WorldSave,
  receipt: WorldReceipt,
  pack?: WorldPack,
): WorldSave {
  const next: WorldSave = {
    ...save,
    receipt: verifyWorldReceipt(receipt),
    pack: pack || save.pack,
  };
  if (dataBytes(next) > 1100000) {
    next.manifest = null;
    next.comparison = null;
  }
  return validateWorldSave(next);
}
