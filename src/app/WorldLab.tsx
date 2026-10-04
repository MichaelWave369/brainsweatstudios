import { useEffect, useMemo, useRef, useState } from "react";
import { clone } from "../runtime/data";
import { compileWorld, parseWorldData, validatePack } from "../worlds/compiler";
import {
  generateExperiment,
  memoryExperiment,
  validateWorldExperiment,
  type BatchReport,
  type TrialSummary,
} from "../worlds/experiments";
import {
  rememberWorld,
  validateBatchReport,
  validateWorldSave,
  type WorldSave,
} from "../worlds/notebook";
import {
  BASELINES,
  baselineController,
  inspectWorldReceipt,
  validateMemory,
  verifyWorldReceipt,
  type WorldController,
  type WorldReceipt,
} from "../worlds/receipts";
import { WorldSession } from "../worlds/session";
import { townZero, tutorialWorld } from "../worlds/townZero";
import type { WorldPack, WorldSpec } from "../worlds/types";
import { ollamaAdapter } from "../agents/ollama";
import type { ModelInfo } from "../agents/contracts";
import WorldAuthoring from "./WorldAuthoring";

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const customPack = (spec: WorldSpec): WorldPack => ({
  schema: "brain-sweat-pack@1",
  id: "operator-pack",
  version: "1.0.0",
  worlds: [spec],
});
export default function WorldLab({
  saved,
  paused,
  onChange,
}: {
  saved: WorldSave;
  paused: boolean;
  onChange: (v: WorldSave) => void;
}) {
  const [spec, setSpec] = useState<WorldSpec>(
      () => clone(saved.pack?.worlds[0] || townZero()) as WorldSpec,
    ),
    [days, setDays] = useState<7 | 14 | 30>(7),
    [seed, setSeed] = useState(369),
    [role, setRole] = useState(spec.roles[0].id),
    [controller, setController] = useState("maintenance-first"),
    [mode, setMode] = useState("cap"),
    [cap, setCap] = useState(24),
    [running, setRunning] = useState(false),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState(""),
    [frame, setFrame] = useState(saved.receipt?.records.length || 0),
    [filter, setFilter] = useState(""),
    [humanIntents, setHumanIntents] = useState<Record<string, string>>({}),
    [batching, setBatching] = useState(false),
    [trials, setTrials] = useState<TrialSummary[]>([]),
    [models, setModels] = useState<ModelInfo[]>([]),
    [model, setModel] = useState(""),
    [memoryText, setMemoryText] = useState(""),
    [contextMode, setContextMode] =
      useState<WorldController["context"]>("STATE_ONLY"),
    [requestCap, setRequestCap] = useState(1000),
    [interval, setIntervalValue] = useState(1);
  const [planGoal, setPlanGoal] = useState(""),
    [planSteps, setPlanSteps] = useState("");
  const [initialSession] = useState<WorldSession | null>(() =>
    saved.receipt ? WorldSession.restore(saved.receipt) : null,
  );
  const session = useRef<WorldSession | null>(initialSession),
    worker = useRef<Worker | null>(null),
    active = useRef(false),
    alive = useRef(true),
    saveRef = useRef(saved),
    displayReceipt = useRef<WorldReceipt | null>(saved.receipt),
    callback = useRef(onChange),
    bridge = useRef<ReturnType<typeof ollamaAdapter> | null>(null);
  saveRef.current = saved;
  callback.current = onChange;
  const compiled = useMemo(() => compileWorld(spec), [spec]);
  const receipt = useMemo(
    // Reuse the immutable receipt verified by persist. Rebuilding it here
    // caused another full replay on every board render during long campaigns.
    () => displayReceipt.current || saved.receipt,
    [revision, saved.receipt],
  );
  const inspection = useMemo(
    () =>
      receipt
        ? inspectWorldReceipt(receipt, Math.min(frame, receipt.records.length))
        : null,
    [receipt, frame],
  );
  const world = session.current?.env.world.spec || spec,
    state = inspection?.state,
    current = session.current?.env,
    status = current ? session.current!.status : "STOPPED";
  const halt = () => {
    active.current = false;
    session.current?.pause();
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
    setBatching(false);
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current = false;
      session.current?.stop();
      worker.current?.terminate();
      bridge.current?.disconnect();
    };
  }, []);
  useEffect(() => {
    if (paused) {
      active.current = false;
      session.current?.pause();
      worker.current?.terminate();
      worker.current = null;
      setRunning(false);
      setBatching(false);
      setRevision((n) => n + 1);
    }
  }, [paused]);
  const persist = (s: WorldSession, follow = true) => {
    try {
      const r = verifyWorldReceipt(s.receipt()),
        next = rememberWorld(saveRef.current, r, s.recorder.pack);
      displayReceipt.current = r;
      saveRef.current = next;
      callback.current(next);
      setRevision((n) => n + 1);
      if (follow) setFrame(r.records.length);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Campaign could not be saved.",
      );
      active.current = false;
      setRunning(false);
    }
  };
  const bindings = (source: WorldSpec) =>
    Object.fromEntries(
      source.roles.map((r) => [
        r.id,
        {
          ...baselineController(
            r.id,
            BASELINES.includes(controller as WorldController["baseline"])
              ? (controller as WorldController["baseline"])
              : "maintenance-first",
          ),
          family:
            controller === "human" && r.id === role
              ? "human"
              : controller === "mock" || controller === "ollama"
                ? "model"
                : "baseline",
          provider:
            controller === "mock"
              ? "mock"
              : controller === "ollama"
                ? "ollama"
                : "none",
          model:
            controller === "ollama"
              ? model
              : controller === "mock"
                ? "mock-policy"
                : "public-baseline",
          requestBudget: requestCap,
          decisionInterval: interval,
          context: contextMode,
        } as WorldController,
      ]),
    );
  const start = () => {
    try {
      halt();
      if (!compiled.ok)
        throw new Error("Correct validation errors before preview.");
      if (controller === "ollama" && (!bridge.current || !model))
        throw new Error(
          "Connect and explicitly select an installed model first.",
        );
      const adapters =
        controller === "ollama"
          ? Object.fromEntries(spec.roles.map((r) => [r.id, bridge.current!]))
          : {};
      session.current = new WorldSession(
        customPack(spec),
        spec.id,
        seed,
        bindings(spec),
        adapters,
      );
      setFrame(0);
      setNotice(
        "Validated world started. Every role uses the same authority boundary.",
      );
      persist(session.current);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "World could not start.",
      );
    }
  };
  const advance = async (human: Record<string, string> = {}) => {
    const s = session.current;
    if (!s || paused) return;
    try {
      if (s.status !== "READY") s.resume();
      const result = await s.step(human);
      if (result) setHumanIntents({});
      if (alive.current) persist(s);
    } catch (error) {
      if (alive.current)
        setNotice(error instanceof Error ? error.message : "Action rejected.");
    }
  };
  const run = async () => {
    const s = session.current;
    if (!s || paused) return;
    active.current = true;
    s.resume();
    setRunning(true);
    setRevision((n) => n + 1);
    const startTick = s.env.result().tick,
      dayEnd =
        (Math.floor(startTick / s.env.world.spec.clock.ticksPerDay) + 1) *
        s.env.world.spec.clock.ticksPerDay;
    try {
      while (
        active.current &&
        !s.env.result().terminal &&
        s.status === "READY" &&
        s.env.result().tick - startTick < cap
      ) {
        let done = false;
        for (
          let i = 0;
          i < 8 &&
          active.current &&
          s.status === "READY" &&
          !s.env.result().terminal;
          i++
        ) {
          const actors =
            s.env.world.spec.turnMode === "ordered"
              ? [s.env.actors[s.env.snapshot().turn]]
              : s.env.actors;
          if (
            actors.some((a) => s.recorder.controller(a.id).family === "human")
          ) {
            setNotice("A human role is waiting for a legal action.");
            done = true;
            break;
          }
          const f = await s.step();
          if (
            (mode === "event" &&
              f?.ledger.some(
                (e) => e.kind === "triggered" && s.env.world.events[e.source],
              )) ||
            (mode === "day" && s.env.result().tick >= dayEnd) ||
            (mode === "decision" &&
              f?.resolutions.some((r) => r.action !== "wait")) ||
            s.env.result().tick - startTick >= cap
          ) {
            done = true;
            break;
          }
        }
        if (!alive.current) return;
        persist(s);
        if (done) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
      }
    } catch (error) {
      if (alive.current)
        setNotice(error instanceof Error ? error.message : "Campaign paused.");
    } finally {
      active.current = false;
      if (alive.current) {
        setRunning(false);
        persist(s);
      }
    }
  };
  const handoff = (family: "human" | "baseline" | "model", local = false) => {
    const s = session.current;
    if (!s) return;
    try {
      if (local && (!bridge.current || !model))
        throw new Error(
          "Connect and explicitly select an installed model first.",
        );
      active.current = false;
      setRunning(false);
      s.handoff(
        role,
        {
          ...baselineController(
            `${role.slice(0, 16)}-${family}-${s.recorder.handoffs.length}`,
          ),
          family,
          provider: family === "model" ? (local ? "ollama" : "mock") : "none",
          model:
            family === "model"
              ? local
                ? model
                : "mock-policy"
              : "public-baseline",
          context: contextMode,
          requestBudget: requestCap,
          decisionInterval: interval,
        },
        "Operator selected a replacement.",
        local ? bridge.current! : undefined,
      );
      persist(s);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Handoff rejected.");
    }
  };
  const importFile = async (
    file: File | undefined,
    kind: "pack" | "receipt" | "manifest",
  ) => {
    if (!file) return;
    try {
      if (
        file.size >
        (kind === "receipt" ? 8000000 : kind === "manifest" ? 4000000 : 256000)
      )
        throw new Error("Import byte limit exceeded.");
      const input = parseWorldData(
        await file.text(),
        kind === "receipt" ? 8000000 : kind === "manifest" ? 4000000 : 256000,
      );
      if (kind === "pack") {
        const pack = validatePack(input);
        const next = validateWorldSave({ ...saveRef.current, pack });
        halt();
        setSpec(clone(pack.worlds[0]) as WorldSpec);
        setRole(pack.worlds[0].roles[0].id);
        saveRef.current = next;
        callback.current(next);
        setNotice("World pack validated. Preview remains stopped.");
      } else if (kind === "receipt") {
        const r = verifyWorldReceipt(input);
        const restored = WorldSession.restore(r);
        halt();
        session.current = restored;
        setSpec(
          clone(r.pack.worlds.find((s) => s.id === r.worldId)!) as WorldSpec,
        );
        setRole(r.actors[0].role);
        persist(restored);
        setNotice("World replay verified. Restored campaign is stopped.");
      } else launchBatch(input);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Import rejected. Saved data was preserved.",
      );
    }
  };
  const launchBatch = (
    input?: unknown,
    inspect?: { instance: string; controller: string },
  ) => {
    try {
      const manifest = validateWorldExperiment(
        input || generateExperiment(spec, 2),
      );
      halt();
      setBatching(true);
      setTrials([]);
      const w = new Worker(
        new URL("../worlds/batch.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      w.onmessage = (e) => {
        if (!alive.current) return;
        const data = e.data as {
          type: string;
          summary: TrialSummary;
          receipt: WorldReceipt;
          report: BatchReport;
          message: string;
        };
        if (data.type === "trial") {
          setTrials((t) => [...t, data.summary]);
        } else if (data.type === "inspected") {
          try {
            const expected = saveRef.current.comparison?.trials.find(
              (t) =>
                t.instance === data.summary.instance &&
                t.controller === data.summary.controller,
            );
            if (expected && expected.receiptHash !== data.receipt.digest)
              throw new Error(
                "Selected trial replay differs from the frozen comparison.",
              );
            const restored = WorldSession.restore(data.receipt);
            session.current = restored;
            persist(restored);
            setNotice("Frozen trial reproduced. Inspection is stopped.");
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Trial inspection failed.",
            );
          }
          setBatching(false);
          w.terminate();
          worker.current = null;
        } else if (data.type === "complete") {
          try {
            const next = validateWorldSave({
              ...saveRef.current,
              manifest,
              comparison: data.report,
            });
            validateBatchReport(data.report, next.manifest!);
            saveRef.current = next;
            callback.current(next);
            setNotice(
              "Frozen comparison completed. No controller was tuned against holdout.",
            );
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Comparison exceeded the local save budget.",
            );
          }
          setBatching(false);
          w.terminate();
          worker.current = null;
        } else {
          setNotice(data.message);
          setBatching(false);
          w.terminate();
          worker.current = null;
        }
      };
      w.onerror = () => {
        setNotice("Background comparison failed.");
        setBatching(false);
        w.terminate();
        worker.current = null;
      };
      w.postMessage(
        inspect ? { kind: "inspect", manifest, ...inspect } : manifest,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Comparison rejected.",
      );
    }
  };
  const connect = async () => {
    try {
      const b = ollamaAdapter(),
        abort = new AbortController();
      await b.connect(abort.signal);
      const discovered = await b.models(abort.signal);
      bridge.current = b;
      setModels(discovered);
      setNotice(
        "Local bridge connected. Select an installed model explicitly.",
      );
    } catch {
      setNotice(
        "Local model unavailable. The offline mock and baselines remain available.",
      );
    }
  };
  const actor =
      current?.actors.find((a) => a.role === role)?.id ||
      current?.actors[0]?.id ||
      role,
    view = current?.observe(actor),
    canHuman =
      current && session.current!.recorder.controller(actor).family === "human",
    rows =
      inspection?.record?.frame?.ledger.filter(
        (e) =>
          !filter ||
          [e.source, e.target, e.kind, e.cause || ""].some((x) =>
            x.includes(filter),
          ),
      ) || [];
  return (
    <div className="world-lab">
      <header className="academy-panel">
        <span className="eyebrow">THE WORLD IS A VERIFIED ARTIFACT</span>
        <h2>World authoring lab</h2>
        <p>
          Build and inspect bounded fictional worlds. Controller proposals
          always pass through the world.
        </p>
      </header>
      <div className="world-grid academy-panel">
        <label>
          Reference world
          <select
            aria-label="Reference world"
            value={
              spec.id === "reserve-lesson" ? "reserve-lesson" : "town-zero"
            }
            disabled={running || batching}
            onChange={(e) => {
              const s =
                e.target.value === "reserve-lesson"
                  ? tutorialWorld()
                  : townZero(days);
              setSpec(s);
              setRole(s.roles[0].id);
            }}
          >
            <option value="town-zero">Town Zero</option>
            <option value="reserve-lesson">Reserve Lesson</option>
          </select>
        </label>
        <label>
          Campaign curriculum
          <select
            aria-label="Campaign curriculum"
            value={days}
            disabled={running || batching}
            onChange={(e) => {
              const n = Number(e.target.value) as 7 | 14 | 30;
              setDays(n);
              setSpec(townZero(n));
              setRole("planner");
            }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <label>
          Master seed
          <input
            aria-label="World master seed"
            type="number"
            min={0}
            max={999999}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <label>
          Operator role
          <select
            aria-label="Operator role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {(current?.world.spec.roles || spec.roles).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Controller team
          <select
            aria-label="World controller team"
            value={controller}
            onChange={(e) => setController(e.target.value)}
          >
            {BASELINES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
            <option value="human">Human + baseline team</option>
            <option value="mock">Offline mock team</option>
            <option value="ollama">Local model team</option>
          </select>
        </label>
        <label>
          Context strategy
          <select
            aria-label="World context strategy"
            value={contextMode}
            onChange={(e) => {
              setContextMode(e.target.value as WorldController["context"]);
              const s = session.current;
              if (s) {
                const c = s.recorder.controller(actor);
                s.handoff(actor, {
                  ...c,
                  context: e.target.value as WorldController["context"],
                });
                persist(s);
              }
            }}
          >
            {["STATE_ONLY", "RECENT_WINDOW", "BOUNDED_NOTEBOOK"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Requests per role
          <input
            aria-label="World request budget"
            type="number"
            min={1}
            max={4096}
            value={requestCap}
            onChange={(e) => setRequestCap(Number(e.target.value))}
          />
        </label>
        <label>
          Decision interval
          <input
            aria-label="World decision interval"
            type="number"
            min={1}
            max={24}
            value={interval}
            onChange={(e) => setIntervalValue(Number(e.target.value))}
          />
        </label>
      </div>
      {controller === "ollama" ? (
        <div className="academy-panel">
          <button className="btn secondary" onClick={() => void connect()}>
            Connect Town Zero local bridge
          </button>
          <label>
            Installed world model
            <select
              aria-label="Installed world model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">Select installed model</option>
              {models.map((m) => (
                <option key={m.id}>{m.id}</option>
              ))}
            </select>
          </label>
          <button
            className="btn secondary"
            onClick={() => {
              halt();
              bridge.current?.disconnect();
              bridge.current = null;
              setModels([]);
              setModel("");
            }}
          >
            Disconnect world provider
          </button>
        </div>
      ) : null}
      <WorldAuthoring
        spec={spec}
        onChange={setSpec}
        disabled={running || batching}
      />
      <section className="academy-panel" aria-label="World validation">
        <h3>Validated preview</h3>
        {compiled.ok ? (
          <>
            <p>Ready to compile and run.</p>
            <div className="world-summary">
              <span>Roles: {spec.roles.length}</span>
              <span>Resources: {spec.resources.length}</span>
              <span>Facilities: {spec.entities.length}</span>
              <span>Actions: {spec.actions.length}</span>
              <span>Events: {spec.events.length}</span>
              <span>Ticks: {spec.clock.maxTicks}</span>
            </div>
            <p className="world-hash" translate="no">
              {compiled.world.hash}
            </p>
          </>
        ) : (
          <div role="status">
            {compiled.errors.map((e, i) => (
              <p key={i}>
                {e.path}: {e.message}
              </p>
            ))}
          </div>
        )}
        <div className="button-row">
          <button
            className="btn primary"
            disabled={!compiled.ok || paused || running || batching}
            onClick={start}
          >
            Run validated preview
          </button>
          <button
            className="btn secondary"
            disabled={!compiled.ok}
            onClick={() =>
              download("brain-sweat-world-pack.json", customPack(spec))
            }
          >
            Export world pack
          </button>
          <label className="btn secondary import-button">
            Import world pack
            <input
              type="file"
              aria-label="Import world pack"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0], "pack");
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      {current && state ? (
        <>
          <section className="academy-panel world-operations">
            <h3>Town Zero operations board</h3>
            <div className="world-summary">
              <strong className="world-status" translate="no">
                {status}
              </strong>
              <span>
                Day {Math.floor(state.tick / world.clock.ticksPerDay) + 1}
              </span>
              <span>Tick {state.tick}</span>
              <span>Weather: {state.flags.storm ? "storm" : "stable"}</span>
            </div>
            <svg
              className="world-map"
              viewBox="0 0 500 400"
              role="img"
              aria-label="Fictional district map and facility states"
            >
              {world.locations.flatMap((l) =>
                l.neighbors.map((n) => {
                  const next = world.locations.find((x) => x.id === n)!;
                  return (
                    <path
                      key={`${l.id}-${n}`}
                      d={`M${l.x * 4.6 + 20} ${l.y * 3.3 + 10} L${next.x * 4.6 + 20} ${next.y * 3.3 + 10}`}
                      stroke="#45627a"
                      strokeWidth={3}
                    />
                  );
                }),
              )}
              {world.locations.map((l) => {
                const facilities = world.entities.filter(
                    (e) => state.entities[e.id].location === l.id,
                  ),
                  offline = facilities.some(
                    (e) => state.entities[e.id].status === 0,
                  );
                return (
                  <g key={l.id}>
                    <rect
                      x={l.x * 4.6 - 12}
                      y={l.y * 3.3 - 12}
                      width={66}
                      height={45}
                      rx={8}
                      fill={offline ? "#752e3c" : "#153e46"}
                      stroke={offline ? "#ffbcc8" : "#87e4be"}
                      strokeWidth={2}
                    />
                    <text
                      x={l.x * 4.6 + 20}
                      y={l.y * 3.3 + 6}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={12}
                    >
                      {facilities.length
                        ? facilities
                            .map((e) =>
                              state.entities[e.id].status === 0
                                ? "OFF"
                                : state.entities[e.id].status < 60
                                  ? "LOW"
                                  : "OK",
                            )
                            .join("/")
                        : "•"}
                    </text>
                    <text
                      x={l.x * 4.6 + 20}
                      y={l.y * 3.3 + 50}
                      textAnchor="middle"
                      fill="#edf5ff"
                      fontSize={10}
                    >
                      {l.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p>
              Operator inspection shows authoritative state. Each controller
              receives its own masked observations.
            </p>
            <div className="world-resources">
              {Object.entries(state.resources).map(([id, n]) => (
                <div key={id}>
                  <span>
                    {world.resources.find((r) => r.id === id)?.label || id}
                  </span>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
            <div className="world-objectives">
              {world.objectives.map((o) => (
                <p key={o.id}>
                  {o.label}: <strong>{state.objectives[o.id]}</strong>
                </p>
              ))}
            </div>
            <div className="button-row">
              <button
                className="btn secondary"
                disabled={paused || running || current.result().terminal}
                onClick={() => void advance()}
              >
                Step world controller
              </button>
              <button
                className="btn primary"
                disabled={paused || running || current.result().terminal}
                onClick={() => void run()}
              >
                Run bounded campaign
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  halt();
                  persist(session.current!);
                }}
              >
                Pause world
              </button>
              <button
                className="btn secondary"
                disabled={paused}
                onClick={() => {
                  session.current!.resume();
                  setRevision((n) => n + 1);
                }}
              >
                Resume world
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  halt();
                  session.current!.stop();
                  persist(session.current!);
                }}
              >
                Stop world
              </button>
            </div>
            <div className="world-grid">
              <label>
                Autonomy mode
                <select
                  aria-label="World autonomy mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="cap">Run with tick cap</option>
                  <option value="event">Run until event</option>
                  <option value="day">Run until day end</option>
                  <option value="decision">Run until decision</option>
                </select>
              </label>
              <label>
                Run tick cap
                <input
                  aria-label="World run tick cap"
                  type="number"
                  min={1}
                  max={1000}
                  value={cap}
                  onChange={(e) =>
                    setCap(Math.max(1, Math.min(1000, Number(e.target.value))))
                  }
                />
              </label>
            </div>
            <div className="button-row">
              <button
                className="btn secondary"
                onClick={() => handoff("human")}
              >
                Take world role manually
              </button>
              <button
                className="btn secondary"
                onClick={() => handoff("baseline")}
              >
                Hand world role to baseline
              </button>
              <button
                className="btn secondary"
                onClick={() => handoff("model")}
              >
                Hand world role to mock
              </button>
              {controller === "ollama" && (
                <button
                  className="btn secondary"
                  onClick={() => handoff("model", true)}
                >
                  Hand world role to selected local model
                </button>
              )}
            </div>
            {canHuman ? (
              <div
                role="group"
                aria-label="Human world actions"
                className="button-row"
              >
                {view?.legalActions.map((a) => (
                  <button
                    className="btn secondary"
                    key={a.type}
                    disabled={paused}
                    onClick={() =>
                      current!.world.spec.turnMode === "simultaneous"
                        ? setHumanIntents((previous) => ({
                            ...previous,
                            [actor]: a.type,
                          }))
                        : void advance({ [actor]: a.type })
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
            {current.world.spec.turnMode === "simultaneous" && (
              <div className="button-row">
                <pre translate="no" tabIndex={0}>
                  {JSON.stringify(humanIntents)}
                </pre>
                <button
                  className="btn secondary"
                  disabled={
                    paused ||
                    running ||
                    !current.actors
                      .filter(
                        (a) =>
                          session.current!.recorder.controller(a.id).family ===
                          "human",
                      )
                      .every((a) => humanIntents[a.id])
                  }
                  onClick={() => void advance(humanIntents)}
                >
                  Resolve staged human intents
                </button>
              </div>
            )}
            <details>
              <summary>Declared plan and execution</summary>
              <label className="world-field">
                Plan goal
                <input
                  aria-label="World plan goal"
                  maxLength={120}
                  value={planGoal}
                  onChange={(e) => setPlanGoal(e.target.value)}
                />
              </label>
              <label className="world-field">
                Plan steps
                <textarea
                  aria-label="World plan steps"
                  maxLength={720}
                  value={planSteps}
                  onChange={(e) => setPlanSteps(e.target.value)}
                />
              </label>
              <button
                className="btn secondary"
                onClick={() => {
                  try {
                    session.current!.setPlan(actor, {
                      schema: "world-plan@1",
                      goal: planGoal,
                      steps: planSteps.split("\n").filter(Boolean),
                      risks: [],
                      fallbacks: [],
                    });
                    persist(session.current!);
                    setNotice("Public plan recorded beside actual execution.");
                  } catch {
                    setNotice("Plan validation failed.");
                  }
                }}
              >
                Record public plan
              </button>
              <pre translate="no" tabIndex={0}>
                {JSON.stringify(
                  receipt?.artifacts.filter((a) => a.actor === actor),
                  null,
                  2,
                )}
              </pre>
            </details>
            <details>
              <summary>Role observation and public memory</summary>
              <pre translate="no" tabIndex={0}>
                {JSON.stringify(view, null, 2)}
              </pre>
              <button
                className="btn secondary"
                onClick={() =>
                  setMemoryText(
                    JSON.stringify(session.current!.memories[actor], null, 2),
                  )
                }
              >
                Inspect role notebook
              </button>
              <textarea
                aria-label="Public world notebook"
                rows={7}
                maxLength={4096}
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
              />
              <button
                className="btn secondary"
                onClick={() => {
                  try {
                    session.current!.setMemory(
                      actor,
                      validateMemory(JSON.parse(memoryText)),
                    );
                    persist(session.current!);
                    setNotice(
                      "Bounded public notebook updated. World state is unchanged.",
                    );
                  } catch {
                    setNotice("Notebook validation failed.");
                  }
                }}
              >
                Apply public notebook
              </button>
            </details>
          </section>
          <section className="academy-panel">
            <h3>Verified causal timeline</h3>
            <label>
              World replay frame
              <input
                aria-label="World replay frame"
                type="range"
                min={0}
                max={receipt?.records.length || 0}
                value={frame}
                onChange={(e) => setFrame(Number(e.target.value))}
              />
            </label>
            <div className="button-row">
              <button className="btn secondary" onClick={() => setFrame(0)}>
                Jump to start
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  setFrame(
                    receipt?.checkpoints.filter((c) => c.index < frame).at(-1)
                      ?.index || 0,
                  )
                }
              >
                Previous checkpoint
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  setFrame(
                    (receipt?.records.find(
                      (r) =>
                        r.index + 1 > frame &&
                        r.frame?.ledger.some((e) => e.kind === "triggered"),
                    )?.index ?? -1) + 1 ||
                      receipt?.records.length ||
                      0,
                  )
                }
              >
                Next event
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  setFrame(
                    (receipt?.records.find(
                      (r) =>
                        r.index + 1 > frame &&
                        r.frame?.ledger.some((e) => e.kind === "objective"),
                    )?.index ?? -1) + 1 ||
                      receipt?.records.length ||
                      0,
                  )
                }
              >
                Next objective change
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  setFrame(
                    (receipt?.records.find(
                      (r) =>
                        r.index + 1 > frame &&
                        r.frame?.ledger.some((e) => e.kind === "failure"),
                    )?.index ?? -1) + 1 ||
                      receipt?.records.length ||
                      0,
                  )
                }
              >
                Next failure
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  setFrame(
                    receipt?.handoffs.find((h) => h.index > frame)?.index ||
                      receipt?.records.length ||
                      0,
                  )
                }
              >
                Next handoff
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  try {
                    verifyWorldReceipt(receipt);
                    setNotice(
                      "Long world replay and checkpoints verified. No inference was requested.",
                    );
                  } catch (error) {
                    setNotice(String(error));
                  }
                }}
              >
                Verify long world replay
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  download("brain-sweat-world-receipt.json", receipt)
                }
              >
                Export world receipt
              </button>
            </div>
            <label>
              Filter causal ledger
              <input
                aria-label="Filter causal ledger"
                maxLength={40}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <div
              className="world-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Causal ledger table"
            >
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Source</th>
                    <th>Cause</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td translate="no">
                        {e.id} · {e.kind}
                      </td>
                      <td translate="no">{e.source}</td>
                      <td translate="no">{e.cause || "initial / rule"}</td>
                      <td translate="no">
                        {e.target}: {String(e.before)} → {String(e.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>Team proposals and action validation</summary>
              <pre translate="no" tabIndex={0}>
                {JSON.stringify(inspection?.record, null, 2)}
              </pre>
            </details>
            <details>
              <summary>Recorded role observations</summary>
              <pre translate="no" tabIndex={0}>
                {JSON.stringify(
                  inspection
                    ? Object.fromEntries(
                        inspection.environment.actors.map((a) => [
                          a.id,
                          inspection.environment.observe(a.id),
                        ]),
                      )
                    : {},
                  null,
                  2,
                )}
              </pre>
            </details>
          </section>
        </>
      ) : null}
      <section className="academy-panel">
        <h3>Frozen family comparisons</h3>
        <p>
          Same instances for every controller. Train, validation, holdout and
          transfer remain separate. Reports describe these fictional trials.
        </p>
        <div className="button-row">
          <button
            className="btn primary"
            disabled={!compiled.ok || batching || running || paused}
            onClick={() => launchBatch()}
          >
            Compare frozen world controllers
          </button>
          <button className="btn secondary" disabled={!batching} onClick={halt}>
            Stop world comparison
          </button>
          <button
            className="btn secondary"
            disabled={!compiled.ok || batching || running || paused}
            onClick={() => launchBatch(memoryExperiment(spec))}
          >
            Compare public context strategies
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              download(
                "brain-sweat-world-experiment.json",
                generateExperiment(spec, 2),
              )
            }
          >
            Export world experiment
          </button>
          <label className="btn secondary import-button">
            Import world experiment
            <input
              type="file"
              aria-label="Import world experiment"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0], "manifest");
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {batching ? (
          <p role="status">Completed trials: {trials.length}</p>
        ) : null}
        {saved.comparison && saved.manifest ? (
          <details>
            <summary>Individual frozen trials</summary>
            <p>
              Inspect recreates the selected offline trial and verifies its
              recorded hash.
            </p>
            <div
              className="world-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Individual frozen trials table"
            >
              <table>
                <thead>
                  <tr>
                    <th>Controller</th>
                    <th>Partition / seed</th>
                    <th>Recovery / blocked</th>
                    <th>Repeated rejections / delayed outages</th>
                    <th>Action costs by resource</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {saved.comparison.trials.map((t) => (
                    <tr key={`${t.instance}:${t.controller}`}>
                      <td translate="no">{t.controller}</td>
                      <td translate="no">
                        {t.partition} / {t.seed}
                      </td>
                      <td>
                        {t.recoveryTicks} / {t.blocked}
                      </td>
                      <td>
                        {t.repeatedRejections} / {t.delayedOutages}
                      </td>
                      <td translate="no">
                        {Object.entries(t.actionCosts)
                          .map(([resource, cost]) => `${resource}: ${cost}`)
                          .join(", ")}
                      </td>
                      <td>
                        <button
                          className="btn secondary"
                          disabled={batching || running || paused}
                          onClick={() =>
                            launchBatch(saved.manifest, {
                              instance: t.instance,
                              controller: t.controller,
                            })
                          }
                        >
                          Inspect frozen trial
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
        {saved.comparison ? (
          <div
            className="world-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Frozen comparison distributions"
          >
            <table>
              <thead>
                <tr>
                  <th>Controller</th>
                  <th>Partition</th>
                  <th>Completion mean / median</th>
                  <th>Range</th>
                  <th>Success rate</th>
                </tr>
              </thead>
              <tbody>
                {saved.comparison.groups.map((g) => (
                  <tr key={`${g.controller}-${g.partition}`}>
                    <td translate="no">{g.controller}</td>
                    <td translate="no">{g.partition}</td>
                    <td>
                      {g.completion.mean.toFixed(2)} /{" "}
                      {g.completion.median.toFixed(2)}
                    </td>
                    <td>
                      {g.completion.min.toFixed(2)}–
                      {g.completion.max.toFixed(2)}
                    </td>
                    <td>{Math.round(g.completion.successRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {saved.comparison ? (
          <details>
            <summary>Recorded behavior profile</summary>
            <p>
              Repeated rejections count the same role and action blocked or
              conflicted again before a successful execution. Delayed outages
              count facilities reaching zero from an earlier scheduled event.
              Action costs retain each resource unit separately.
            </p>
            <div
              className="world-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Recorded behavior distributions"
            >
              <table>
                <thead>
                  <tr>
                    <th>Controller</th>
                    <th>Partition</th>
                    <th>Reserve mean / median</th>
                    <th>Recovery ticks mean / median</th>
                    <th>Repeated rejections mean / median</th>
                    <th>Delayed outages mean / median</th>
                    <th>Action cost distributions</th>
                  </tr>
                </thead>
                <tbody>
                  {saved.comparison.groups.map((g) => (
                    <tr key={`${g.controller}-${g.partition}`}>
                      <td translate="no">{g.controller}</td>
                      <td translate="no">{g.partition}</td>
                      <td>
                        {g.reserves.mean.toFixed(2)} /{" "}
                        {g.reserves.median.toFixed(2)}
                      </td>
                      <td>
                        {g.recoveryTicks.mean.toFixed(2)} /{" "}
                        {g.recoveryTicks.median.toFixed(2)}
                      </td>
                      <td>
                        {g.repeatedRejections.mean.toFixed(2)} /{" "}
                        {g.repeatedRejections.median.toFixed(2)}
                      </td>
                      <td>
                        {g.delayedOutages.mean.toFixed(2)} /{" "}
                        {g.delayedOutages.median.toFixed(2)}
                      </td>
                      <td>
                        <details>
                          <summary>Inspect resource costs</summary>
                          <pre translate="no" tabIndex={0}>
                            {JSON.stringify(g.actionCosts, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </section>
      <section className="academy-panel">
        <label className="btn secondary import-button">
          Import world receipt
          <input
            type="file"
            aria-label="Import world receipt"
            accept=".json,application/json"
            onChange={(e) => {
              void importFile(e.target.files?.[0], "receipt");
              e.target.value = "";
            }}
          />
        </label>
        <details>
          <summary>Inspect data-only WorldSpec JSON</summary>
          <pre translate="no" tabIndex={0}>
            {JSON.stringify(spec, null, 2)}
          </pre>
        </details>
        <p>
          Saved campaigns restore stopped. Local models stay disconnected until
          explicitly connected. No game XP or intelligence score is awarded.
        </p>
      </section>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
