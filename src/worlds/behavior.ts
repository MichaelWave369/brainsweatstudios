import { freeze } from "../runtime/data.ts";
import { verifyWorldReceipt } from "./receipts.ts";

export interface WorldBehavior {
  repeatedRejections: number;
  delayedOutages: number;
  actionCosts: Record<string, number>;
}

// These are mechanical diagnostics of verified evidence, not inferred intent,
// memory capacity or intelligence. They never alter authoritative state.
export function summarizeWorldBehavior(input: unknown): WorldBehavior {
  const receipt = verifyWorldReceipt(input),
    spec = receipt.pack.worlds.find((w) => w.id === receipt.worldId)!,
    events = new Set(spec.events.map((e) => e.id)),
    actions = new Map(spec.actions.map((a) => [a.id, a])),
    actionCosts = Object.fromEntries(spec.resources.map((r) => [r.id, 0])),
    rejected = new Map<string, string>(),
    scheduled = new Map(
      receipt.checkpoints[0].state.queue
        .filter((q) => q.kind === "event")
        .map((q) => [q.id, 0]),
    );
  let repeatedRejections = 0,
    delayedOutages = 0;
  for (const record of receipt.records) {
    if (!record.frame) continue;
    for (const resolution of record.frame.resolutions) {
      const key = `${resolution.actor}:${resolution.action}`;
      if (resolution.outcome === "executed") {
        rejected.delete(key);
        for (const cost of actions.get(resolution.action)!.costs)
          actionCosts[cost.resource] += cost.amount;
      } else if (
        resolution.outcome === "blocked" ||
        resolution.outcome === "conflict"
      ) {
        if (rejected.get(key) === resolution.outcome) repeatedRejections++;
        rejected.set(key, resolution.outcome);
      }
    }
    const delayedTriggers = new Set<string>();
    for (const entry of record.frame.ledger) {
      if (entry.kind === "scheduled" && events.has(entry.source))
        scheduled.set(entry.target, entry.tick);
      if (
        entry.kind === "triggered" &&
        events.has(entry.source) &&
        scheduled.has(entry.target) &&
        scheduled.get(entry.target)! < entry.tick
      )
        delayedTriggers.add(entry.id);
      if (
        entry.kind === "entity" &&
        entry.before !== 0 &&
        entry.after === 0 &&
        entry.cause !== null &&
        delayedTriggers.has(entry.cause)
      )
        delayedOutages++;
      if (entry.kind === "cancelled" || entry.kind === "completed")
        scheduled.delete(entry.target);
    }
  }
  return freeze({ repeatedRejections, delayedOutages, actionCosts });
}
