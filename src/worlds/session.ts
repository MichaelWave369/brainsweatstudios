import { clone, freeze, hash } from "../runtime/data.ts";
import {
  AgentError,
  controllerSpec,
  freshNotebook,
  parseProposal,
  type ContextData,
  type ProviderAdapter,
} from "../agents/contracts.ts";
import { createProvider } from "../agents/registry.ts";
import {
  validateWorldRequest,
  type WorldProviderRequest,
} from "../agents/worldContracts.ts";
import { requireWorld, validatePack } from "./compiler.ts";
import { chooseWorldAction } from "./controllers.ts";
import {
  baselineController,
  freshMemory,
  inspectWorldReceipt,
  receiptDigest,
  validateMemory,
  validatePlan,
  validateWorldController,
  verifyWorldReceipt,
  WorldRecorder,
  type DecisionEvidence,
  type WorldController,
  type WorldMemory,
  type WorldPlan,
  type WorldReceipt,
} from "./receipts.ts";
import { createWorldEnvironment } from "./runtime.ts";
import type {
  LedgerEntry,
  WorldEnvironment,
  WorldFrame,
  WorldObservation,
} from "./types.ts";

export function publicEvents(
  view: WorldObservation,
  ledger: readonly LedgerEntry[],
): { type: string; detail: string }[] {
  return ledger
    .filter((e) =>
      e.kind === "resource"
        ? typeof view.resources[e.target] === "number"
        : e.kind === "entity"
          ? typeof view.entities[e.target]?.status === "number"
          : ["objective", "signal", "notice"].includes(e.kind),
    )
    .slice(-8)
    .map((e) => ({
      type: e.kind,
      detail:
        e.kind === "signal"
          ? "A structured team signal arrived."
          : e.kind === "objective"
            ? `Objective ${e.target} changed.`
            : e.kind === "notice"
              ? "A bounded world notice was recorded."
              : `Visible ${e.kind} ${e.target} changed.`,
    }));
}
export class WorldSession {
  readonly env: WorldEnvironment;
  readonly recorder: WorldRecorder;
  readonly memories: Record<string, WorldMemory>;
  readonly spent: Record<string, number>;
  readonly plans: Record<string, WorldPlan> = {};
  status:
    | "READY"
    | "STOPPED"
    | "REQUESTING"
    | "PAUSED"
    | "COMPLETE"
    | "ERROR"
    | "BUDGET" = "READY";
  error = "";
  private generation = 0;
  private pending = new Set<AbortController>();
  private lastDecision: Record<string, number> = {};
  constructor(
    packInput: unknown,
    worldId = "town-zero",
    seed = 369,
    controllers?: Record<string, WorldController>,
    private adapters: Record<string, ProviderAdapter> = {},
  ) {
    const pack = validatePack(packInput),
      world = requireWorld(pack.worlds.find((s) => s.id === worldId));
    this.env = createWorldEnvironment(world, seed);
    const bindings = Object.fromEntries(
      this.env.actors.map((a) => [
        a.id,
        validateWorldController(
          controllers?.[a.id] || baselineController(a.id),
        ),
      ]),
    );
    this.recorder = new WorldRecorder(this.env, pack, bindings);
    this.memories = Object.fromEntries(
      this.env.actors.map((a) => [a.id, freshMemory()]),
    );
    this.spent = Object.fromEntries(this.env.actors.map((a) => [a.id, 0]));
  }
  pause() {
    this.generation++;
    this.pending.forEach((p) => p.abort());
    this.pending.clear();
    this.status = "PAUSED";
  }
  stop() {
    this.pause();
    this.status = "STOPPED";
  }
  resume() {
    this.status = this.env.result().terminal ? "COMPLETE" : "READY";
    this.error = "";
  }
  handoff(
    actor: string,
    to: WorldController,
    note = "Operator selected a replacement.",
  ) {
    this.pause();
    this.recorder.handoff(actor, to, note);
    this.lastDecision[actor] = -10000;
    this.resume();
  }
  private context(actor: string, controller: WorldController): ContextData {
    const own = this.recorder.records
      .flatMap((r) =>
        r.decisions
          .filter((d) => d.actor === actor && d.action && r.frame)
          .map((d) => ({
            tick: r.frame!.tick,
            action: d.action!,
            events: publicEvents(this.env.observe(actor), r.frame!.ledger).map(
              (e) => e.detail,
            ),
          })),
      )
      .slice(-6);
    const memory = this.memories[actor];
    return {
      strategy:
        controller.context === "BOUNDED_NOTEBOOK"
          ? "BOUNDED_EPISODE_MEMORY"
          : controller.context,
      recent: controller.context === "RECENT_WINDOW" ? own : [],
      summary: [],
      notebook:
        controller.context === "BOUNDED_NOTEBOOK"
          ? {
              ...freshNotebook(),
              facts: memory.facts,
              plans: memory.plans,
              warnings: memory.warnings,
              completed: memory.completed,
              unresolved: memory.unresolved,
            }
          : null,
    };
  }
  request(actor: string): WorldProviderRequest {
    const o = this.env.observe(actor),
      c = this.recorder.controller(actor),
      spec = controllerSpec(
        "model",
        c.provider === "ollama" ? "ollama" : "mock",
        c.model,
      );
    spec.id = c.id;
    spec.settings.temperature = c.temperature;
    spec.settings.seed = c.seed;
    const last = this.recorder.records.at(-1)?.frame;
    return validateWorldRequest({
      schema: "provider-request@2",
      template: "mission@1",
      controller: spec,
      budgets: {
        maxTicks: this.env.world.spec.clock.maxTicks,
        maxRequests: c.requestBudget,
        timeoutMs: c.timeoutMs,
        retries: 0,
        observationBytes: 24000,
        responseBytes: 4096,
        notebookBytes: 4096,
      },
      observation: {
        schema: "model-observation@2",
        actionSchema: "model-action@1",
        episode: hash({
          pack: this.recorder.packHash,
          seeds: this.env.seeds,
        }).slice(0, 24),
        sequence: this.spent[actor] + 1,
        world: this.env.world.spec.id,
        environmentVersion: "1.0.0",
        worldHash: this.env.world.hash,
        packHash: this.recorder.packHash,
        agent: { id: actor, role: o.actor.role },
        tick: o.tick,
        objective: o.objective,
        state: {
          resources: o.resources,
          entities: o.entities,
          flags: o.flags,
          objectives: o.objectives,
          signals: o.signals,
          busyUntil: o.busyUntil,
          day: o.day,
        },
        target: null,
        map: [],
        conditions: [],
        observationIndex: null,
        turn: o.turn || "simultaneous",
        legalActions: o.legalActions.map((a) => ({ type: a.type })),
        constraints: {
          remainingTicks: this.env.world.spec.clock.maxTicks - o.tick,
          information:
            "Only visible state is available. Legal attempts can be blocked. Repairs are abstract and delayed.",
        },
        events: last ? publicEvents(o, last.ledger) : [],
        terminal: {
          terminal: o.terminal,
          success: false,
          reason: o.terminal ? "stopped" : "running",
          ticks: o.tick,
          score: 0,
          collisions: 0,
          resources: 0,
        },
      },
      context: this.context(actor, c),
    });
  }
  async step(human: Record<string, string> = {}): Promise<WorldFrame | null> {
    if (this.status !== "READY")
      throw new Error("Resume or start the campaign before stepping.");
    if (this.env.result().terminal) {
      this.status = "COMPLETE";
      return null;
    }
    if (!this.recorder.canRecord()) {
      this.status = "BUDGET";
      this.error = "Receipt recording budget reached.";
      return null;
    }
    const actors =
      this.env.world.spec.turnMode === "ordered"
        ? [this.env.actors[this.env.snapshot().turn]]
        : [...this.env.actors];
    for (const a of actors)
      if (this.recorder.controller(a.id).family === "human" && !human[a.id])
        throw new Error(
          "Supply a legal human intent for every active human role.",
        );
    const token = this.generation;
    this.status = "REQUESTING";
    const decisions = await Promise.all(
      actors.map(async (a) => {
        const c = this.recorder.controller(a.id),
          o = this.env.observe(a.id);
        const d: DecisionEvidence = {
          actor: a.id,
          controller: c.id,
          action: null,
          error: null,
          requests: 0,
          note: null,
          memory: null,
        };
        if (c.family === "human") {
          d.action = human[a.id];
          if (!o.legalActions.some((x) => x.type === d.action))
            d.error = "ILLEGAL_ACTION";
          return d;
        }
        if (c.family === "baseline") {
          d.action = chooseWorldAction(o, c.baseline);
          d.note = `Public ${c.baseline} baseline.`;
          return d;
        }
        if (
          (o.legalActions.length === 1 && o.legalActions[0].type === "wait") ||
          (this.lastDecision[a.id] !== undefined &&
            o.tick - this.lastDecision[a.id] < c.decisionInterval)
        ) {
          d.action = "wait";
          d.note = "World-authorized idle interval.";
          return d;
        }
        if (this.spent[a.id] >= Math.min(4096, c.requestBudget)) {
          d.error = "BUDGET";
          return d;
        }
        const request = this.request(a.id);
        this.spent[a.id]++;
        d.requests = 1;
        const abort = new AbortController();
        this.pending.add(abort);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const adapter =
            this.adapters[a.id] ||
            createProvider(c.provider === "ollama" ? "ollama" : "mock");
          const response = await Promise.race([
            adapter.propose(request, abort.signal),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                abort.abort();
                reject(
                  new AgentError(
                    "TIMEOUT",
                    "World controller deadline expired.",
                  ),
                );
              }, c.timeoutMs);
              abort.signal.addEventListener(
                "abort",
                () =>
                  reject(
                    new AgentError(
                      "CANCELLED",
                      "World controller request cancelled.",
                    ),
                  ),
                { once: true },
              );
            }),
          ]);
          const proposal = parseProposal(
            response.text,
            request.observation.legalActions,
            request.budgets,
          );
          d.action = proposal.action.type;
          d.note = proposal.note || null;
          if (proposal.notebook) {
            const memory = {
              ...this.memories[a.id],
              facts: proposal.notebook.facts,
              plans: proposal.notebook.plans,
              warnings: proposal.notebook.warnings,
              completed: proposal.notebook.completed,
              unresolved: proposal.notebook.unresolved,
            };
            d.memory = validateMemory(memory);
          }
          this.lastDecision[a.id] = o.tick;
        } catch (error) {
          d.error = error instanceof AgentError ? error.code : "UNAVAILABLE";
        } finally {
          if (timer !== undefined) clearTimeout(timer);
          this.pending.delete(abort);
        }
        return d;
      }),
    );
    if (token !== this.generation) return null;
    const bad = decisions.find((d) => d.error !== null);
    if (bad) {
      this.recorder.append(decisions, null);
      this.status = bad.error === "BUDGET" ? "BUDGET" : "ERROR";
      this.error = `Controller ${bad.actor}: ${bad.error}.`;
      return null;
    }
    const frame = this.env.step(
      decisions.map((d) => ({ actor: d.actor, action: d.action! })),
    );
    this.recorder.append(decisions, frame);
    decisions.forEach((d) => {
      if (d.memory) this.memories[d.actor] = d.memory;
    });
    this.status = frame.result.terminal ? "COMPLETE" : "READY";
    return frame;
  }
  setMemory(actor: string, value: unknown) {
    if (!this.memories[actor]) throw new Error("Unknown memory owner.");
    this.memories[actor] = validateMemory(value);
    this.recorder.artifact(actor, "memory", this.memories[actor]);
  }
  setPlan(actor: string, value: unknown) {
    this.plans[actor] = validatePlan(value);
    this.recorder.artifact(actor, "plan", this.plans[actor]);
  }
  receipt(): WorldReceipt {
    const r = this.recorder.finish(
      this.status === "COMPLETE"
        ? "complete"
        : this.status === "ERROR"
          ? "error"
          : this.status === "BUDGET"
            ? "budget"
            : "stopped",
    );
    const { digest: _digest, ...base } = r;
    void _digest;
    const updated = { ...base, requests: clone(this.spent) };
    return freeze({ ...updated, digest: receiptDigest(updated) });
  }
  static restore(
    input: unknown,
    adapters: Record<string, ProviderAdapter> = {},
  ): WorldSession {
    const r = verifyWorldReceipt(input),
      s = new WorldSession(
        r.pack,
        r.worldId,
        r.masterSeed,
        r.initialControllers,
        adapters,
      );
    let hi = 0,
      ai = 0;
    for (let i = 0; i <= r.records.length; i++) {
      while (hi < r.handoffs.length && r.handoffs[hi].index === i) {
        const h = r.handoffs[hi++];
        s.recorder.handoff(h.actor, h.to, h.note);
      }
      while (ai < r.artifacts.length && r.artifacts[ai].index === i) {
        const a = r.artifacts[ai++];
        s.recorder.artifact(a.actor, a.kind, a.value);
        if (a.kind === "memory") s.memories[a.actor] = a.value as WorldMemory;
        else s.plans[a.actor] = a.value as WorldPlan;
      }
      const row = r.records[i];
      if (!row) break;
      const frame = row.frame
        ? s.env.step(
            row.decisions.map((d) => ({ actor: d.actor, action: d.action! })),
          )
        : null;
      s.recorder.append(row.decisions, frame);
      row.decisions.forEach((d) => {
        if (d.memory) s.memories[d.actor] = d.memory;
      });
    }
    Object.assign(s.spent, r.requests);
    s.status = "STOPPED";
    return s;
  }
  view(index: number) {
    return inspectWorldReceipt(this.receipt(), index);
  }
}
