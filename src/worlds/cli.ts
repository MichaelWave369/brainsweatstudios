import { parseWorldData, requireWorld, validatePack } from "./compiler.ts";
import { runWorldBatch } from "./experiments.ts";
import { verifyWorldReceipt } from "./receipts.ts";
import { WorldSession } from "./session.ts";
import { townPack } from "./townZero.ts";
export async function worldCommand(
  command: string,
  args: string[],
  file: string | null,
) {
  if (command === "list")
    return townPack().worlds.map((s) => ({
      id: s.id,
      version: s.version,
      hash: requireWorld(s).hash,
      ticks: s.clock.maxTicks,
    }));
  if (command === "validate") {
    const input = parseWorldData(file!);
    const pack =
      typeof input === "object" && input !== null && "worlds" in input
        ? validatePack(input)
        : null;
    return pack
      ? {
          valid: true,
          worlds: pack.worlds.map((s) => ({
            id: s.id,
            hash: requireWorld(s).hash,
          })),
        }
      : { valid: true, hash: requireWorld(input).hash };
  }
  if (command === "verify") {
    const r = verifyWorldReceipt(parseWorldData(file!, 8000000));
    return {
      verified: true,
      worldHash: r.worldHash,
      finalHash: r.finalHash,
      result: r.result,
    };
  }
  if (command === "run") {
    const world = args[0] || "town-zero",
      seedIndex = args.indexOf("--seed"),
      seed = seedIndex >= 0 ? Number(args[seedIndex + 1]) : 369;
    const s = new WorldSession(townPack(), world, seed);
    while (s.status === "READY" && !s.env.result().terminal) await s.step();
    return verifyWorldReceipt(s.receipt());
  }
  if (command === "batch") {
    const batch = runWorldBatch(parseWorldData(file!, 4000000));
    while (true) {
      const r = await batch.next();
      if (r.done) return r.value;
    }
  }
  throw new Error(
    "Use list, validate FILE, run WORLD --seed N, verify RECEIPT or batch MANIFEST.",
  );
}
