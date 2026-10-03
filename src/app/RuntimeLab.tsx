import { useEffect, useMemo, useRef, useState } from 'react';
import Scene3D from '../engine/Scene3D';
import { Select, Slider } from '../games/advanced/ui';
import { Notice } from '../games/shared';
import { workedPolicy, type ArenaKind } from '../runtime/arenaRules';
import { CURRICULUM, curriculum, seedGroups, TRANSFER_NOTES } from '../runtime/curriculum';
import { canonical, parseJSON } from '../runtime/data';
import { createExperiment, experimentSteps, validateExperiment, type Experiment, type ExperimentMethod, type ExperimentOutcome, type ExperimentProgress } from '../runtime/experiments';
import { rememberExperiment, type LabSave } from '../runtime/notebook';
import { controllerFromPackage, importController, packageRules, packageRover, type ControllerPackage } from '../runtime/packages';
import { inspectTick, recordEpisode, verifyReceipt, type Receipt } from '../runtime/receipts';
import { ENVIRONMENTS, type EnvironmentId } from '../runtime/types';
import { configuration } from '../runtime/environment';
import { arenaTitles, type AcademySave } from '../training/models';

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const names = { ...arenaTitles, rover: 'Learning rover' };
export default function RuntimeLab({ academy, paused, onChange }: { academy: AcademySave; paused: boolean; onChange: (lab: LabSave) => void }) {
  const [environment, setEnvironment] = useState<EnvironmentId>(academy.lab.controller?.compatible[0].environment || 'sports');
  const [stage, setStage] = useState('builder'), [seed, setSeed] = useState(3), [method, setMethod] = useState<ExperimentMethod>('frozen');
  const [custom, setCustom] = useState<ControllerPackage | null>(academy.lab.controller), [receipt, setReceipt] = useState<Receipt | null>(academy.lab.receipt), [tick, setTick] = useState(0), [notice, setNotice] = useState('');
  const [outcome, setOutcome] = useState<ExperimentOutcome | null>(null), [progress, setProgress] = useState<ExperimentProgress | null>(null), [revision, setRevision] = useState(0);
  const run = useRef<ReturnType<typeof experimentSteps> | null>(null), imported = useRef<Experiment | null>(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; run.current = null; }; }, []);
  const pkg = useMemo(() => custom?.compatible[0].environment === environment ? custom : environment === 'rover' ? packageRover(academy.rover.q, academy.rover.mode, academy.rover.episodes) : packageRules(environment, academy.controllers[environment]?.champion || workedPolicy(environment)), [custom, environment, academy.controllers, academy.rover]);
  const currentManifest = outcome?.manifest || academy.lab.experiments[0], active = progress !== null;
  const groupSeeds = seedGroups(seed), definition = curriculum(stage);
  useEffect(() => {
    if (!active || paused) return;
    const timer = setTimeout(() => {
      try {
        const step = run.current?.next(); if (!step) return;
        if (!step.done) { setProgress(step.value); setRevision(n => n + 1); return; }
        const result = step.value;
        if (imported.current?.result && (canonical(imported.current.result) !== canonical(result.manifest.result) || canonical(imported.current.traceHashes) !== canonical(result.manifest.traceHashes))) throw new Error('Rerun differs from the imported result or trace hashes.');
        const trace = result.receipts[24]; setOutcome(result); setCustom(result.champion); setReceipt(trace); setTick(0); setProgress(null); run.current = null;
        onChange(rememberExperiment(academy.lab, result.manifest, result.champion, trace));
        setNotice(imported.current ? 'Manifest rerun verified. Results and trace hashes match.' : 'Experiment complete. Evaluation kept the controller frozen.'); imported.current = null;
      } catch (error) { run.current = null; setProgress(null); setNotice(error instanceof Error ? error.message : 'Experiment could not run.'); }
    }, 20);
    return () => clearTimeout(timer);
  }, [active, paused, revision, academy.lab, onChange]);
  const start = (spec?: Experiment) => {
    try {
      const next = spec || createExperiment(environment, pkg, stage, seed, method, method === 'q-learning' && 'trainingEpisodes' in pkg.parameters ? Math.min(1000, 100000 - pkg.parameters.trainingEpisodes) : 6);
      imported.current = spec || null; run.current = experimentSteps(next); setProgress({ phase: 'TRAIN', completed: 0, total: 1 }); setOutcome(null); setNotice(''); setRevision(n => n + 1);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Experiment could not start.'); }
  };
  const stop = () => { run.current = null; imported.current = null; setProgress(null); setNotice('Experiment stopped. Saved results stay available.'); };
  const importFile = async (type: 'controller' | 'receipt' | 'experiment', file?: File) => {
    if (!file) return;
    try {
      if (file.size > 600000) throw new Error('Choose a runtime file smaller than 600 KB.');
      const raw = parseJSON(await file.text(), 600000); if (!alive.current) return;
      if (type === 'controller') { const next = importController(raw, environment); setCustom(next); onChange({ ...academy.lab, controller: next }); setNotice('Controller imported. Inspect it before running.'); }
      else if (type === 'receipt') { const next = verifyReceipt(raw); setReceipt(next); setTick(0); onChange({ ...academy.lab, receipt: next }); setNotice('Replay verified. Every transition and result matches.'); }
      else { const next = validateExperiment(raw); setEnvironment(next.environment); setStage(next.curriculum); setSeed(next.seed); setMethod(next.method); setCustom(next.controller); start(next); }
    } catch (error) { if (alive.current) setNotice(error instanceof Error ? error.message : 'Import could not be read.'); }
  };
  const capture = () => {
    const mode = 'mode' in pkg.parameters ? pkg.parameters.mode : 'courier', next = recordEpisode(configuration(environment, groupSeeds.HOLDOUT[0], definition.difficulty, definition.trainingVariant, mode), controllerFromPackage(pkg));
    setReceipt(next); setTick(0); onChange({ ...academy.lab, receipt: next, controller: pkg }); setNotice('Episode recorded. Step through its validated actions.');
  };
  const view = receipt ? inspectTick(receipt, tick) : null, row = receipt && tick > 0 ? receipt.steps[tick - 1] : null;
  const selectedManifest = outcome?.manifest || currentManifest;
  return <div className="runtime-lab"><div className="runtime-intro"><span className="eyebrow">SAME WORLD · DIFFERENT CONTROLLERS</span><h2>Experiment lab</h2><p>Compare a frozen controller, inspect its decisions, and verify what the world actually did.</p><p className="small">Transfer measures these bounded simulation families. It does not measure general intelligence or real-world ability.</p></div>
    <div className="academy-layout"><div className="academy-work"><fieldset className="academy-panel" disabled={paused || active}><legend>Choose a repeatable run</legend>
      <Select label="Experiment environment" value={environment} options={ENVIRONMENTS.map(value => ({ value, label: names[value] }))} onChange={value => { setEnvironment(value as EnvironmentId); setCustom(null); setMethod('frozen'); setOutcome(null); }} />
      <Select label="Runtime curriculum" value={stage} options={CURRICULUM.map(s => ({ value: s.id, label: s.title }))} onChange={setStage} /><p>{definition.lesson}</p>
      <Slider label="Runtime experiment seed" value={seed} min={0} max={99} onChange={setSeed} />
      <Select label="Experiment method" value={method} options={[{ value: 'frozen', label: 'Frozen controller comparison' }, environment === 'rover' ? { value: 'q-learning', label: 'Q-learning · 1,000 TRAIN episodes' } : { value: 'rule-search', label: 'Bounded rule search · 6 generations' }]} onChange={value => setMethod(value as ExperimentMethod)} />
      <div className="button-row"><button className="btn primary" onClick={() => start()}>Run experiment</button><button className="btn secondary" onClick={capture}>Record one episode</button></div>
      {environment !== 'rover' && <button className="btn secondary" onClick={() => setCustom(packageRules(environment as ArenaKind, workedPolicy(environment as ArenaKind), true))}>Use authored baseline</button>}
      <p className="small">Controller family: {pkg.controller.family}. Runtime {pkg.runtime}; environment {pkg.compatible[0].version}.</p>
      <details><summary>Inspect controller data</summary><pre className="runtime-json" tabIndex={0}>{JSON.stringify(pkg.parameters, null, 2)}</pre></details>
      <div className="button-row"><button className="btn secondary" onClick={() => download('brain-sweat-controller.json', pkg)}>Export controller package</button><label className="btn secondary import-button">Import controller package<input type="file" accept=".json,application/json" aria-label="Import controller package" onChange={e => { void importFile('controller', e.target.files?.[0]); e.target.value = ''; }} /></label></div>
    </fieldset>
    {active && <section className="academy-panel" role="status"><h3>{paused ? 'Experiment paused' : 'Experiment running'}</h3><p>{progress.phase}: {progress.completed}/{progress.total}</p><progress max={progress.total} value={progress.completed} aria-label="Runtime experiment progress" /><button className="btn secondary" onClick={stop}>Stop experiment</button></section>}
    <section className="academy-panel"><h3>Separate trials, clear roles</h3><div className="runtime-splits">{(['TRAIN', 'VALIDATION', 'HOLDOUT'] as const).map(split => <div key={split}><strong>{split}</strong><p>{split === 'TRAIN' ? 'Only these trials update learning or searched rules.' : split === 'VALIDATION' ? 'Frozen comparison; you may use it to choose a curriculum.' : 'Frozen final check. Do not tune against this report.'}</p><details><summary>Eight distinct seeds</summary><code>{groupSeeds[split].join(', ')}</code></details></div>)}</div><h3>Transfer variant</h3><p>{TRANSFER_NOTES[environment]}</p></section>
    </div><div className="academy-stage">
      {selectedManifest?.result && <section className="academy-panel"><h3>Experiment results</h3><p className="small">Measured environment: {names[selectedManifest.environment]} · {curriculum(selectedManifest.curriculum).title} · seed {selectedManifest.seed}.</p><div className="runtime-table" tabIndex={0} role="region" aria-label="Experiment comparison results"><table><thead><tr><th scope="col">Trials</th><th scope="col">Completed</th><th scope="col">Mean score</th><th scope="col">Mean ticks</th></tr></thead><tbody>{selectedManifest.result.groups.map((g, i) => <tr key={i}><th scope="row">{g.transfer ? 'TRANSFER' : g.split}</th><td>{g.successes}/{g.episodes}</td><td>{g.score.toFixed(1)}</td><td>{g.ticks.toFixed(1)}</td></tr>)}</tbody></table></div><p>Transfer delta: {selectedManifest.result.transferDelta} percentage points from standard HOLDOUT.</p><p className="small">{selectedManifest.result.groups[3].successes === 8 ? 'All transfer trials reached the goal.' : `Transfer failures: ${Object.entries(selectedManifest.result.groups[3].failures).map(([k, n]) => `${k}: ${n}`).join(', ')}.`}</p>
      <div className="button-row"><button className="btn secondary" disabled={active || paused} onClick={() => start(selectedManifest)}>Rerun and verify experiment</button><button className="btn secondary" onClick={() => download('brain-sweat-experiment.json', selectedManifest)}>Export experiment manifest</button></div>
      {outcome && <Select label="Inspect experiment trial" value={String(outcome.receipts.indexOf(receipt!))} options={outcome.receipts.map((r, i) => ({ value: String(i), label: `${i < 8 ? 'TRAIN' : i < 16 ? 'VALIDATION' : i < 24 ? 'HOLDOUT' : 'TRANSFER'} · seed ${r.config.seed} · ${r.result.reason}` }))} onChange={value => { const trace = outcome.receipts[Number(value)]; setReceipt(trace); setTick(0); onChange({ ...academy.lab, receipt: trace }); }} />}
      </section>}
      {receipt && view ? <section className="academy-panel runtime-inspector"><h3>Verified trace inspector</h3><Scene3D kind={receipt.config.environment === 'rover' ? 'learner' : receipt.config.environment} paused={paused} label={`Recorded ${names[receipt.config.environment]} at tick ${tick}; position ${view.state.x}, ${view.state.y}.`} data={{ x: view.state.x, y: view.state.y, goalX: view.target[0], goalY: view.target[1], seed: receipt.config.seed, variant: receipt.config.variant === 'transfer' ? 2 : receipt.config.variant === 'constraints' ? 1 : 0, layout: 'layout' in view.state ? view.state.layout : 0, carrying: 'carrying' in view.state ? Number(view.state.carrying) : 0, progress: 'progress' in view.state ? view.state.progress : 0, vx: 'vx' in view.state ? view.state.vx : 0, vy: 'vy' in view.state ? view.state.vy : 0 }} />
        <div className="runtime-map" style={{ gridTemplateColumns: `repeat(${receipt.config.environment === 'rover' ? 7 : 9}, 1fr)` }} role="img" aria-label={`Recorded position ${view.state.x}, ${view.state.y}; objective ${view.target.join(', ')}.`}>{receipt.config.environment === 'space' ? <p>Position ({view.state.x}, {view.state.y}); objective ({view.target.join(', ')}).</p> : Array.from({ length: receipt.config.environment === 'rover' ? 49 : 63 }, (_, i) => { const width = receipt.config.environment === 'rover' ? 7 : 9, x = i % width, y = Math.floor(i / width), wall = view.map.some(p => p[0] === x && p[1] === y), goal = x === view.target[0] && y === view.target[1]; return <span key={i} style={{ gridColumn: x + 1 }} className={wall ? 'wall' : goal ? 'goal' : ''}>{x === view.state.x && y === view.state.y ? '●' : wall ? '■' : goal ? '★' : '·'}</span>; })}</div>
        <Slider label="Trace inspection tick" value={tick} min={0} max={receipt.steps.length} onChange={setTick} /><div className="button-row"><button className="btn secondary" disabled={tick === 0} onClick={() => setTick(n => n - 1)}>Previous tick</button><button className="btn secondary" disabled={tick === receipt.steps.length} onClick={() => setTick(n => n + 1)}>Next tick</button><button className="btn primary" onClick={() => { try { verifyReceipt(receipt); setNotice('Replay verified. Every transition and result matches.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Replay differs.'); } }}>Verify replay</button></div>
        <dl className="runtime-facts"><div><dt>World seed</dt><dd>{receipt.config.seed}</dd></div><div><dt>Chosen action</dt><dd>{row?.decision.action || 'Initial state'}</dd></div><div><dt>Executed action</dt><dd>{row?.transition.executedAction || 'Initial state'}</dd></div><div><dt>Step reward</dt><dd>{row?.transition.reward.toFixed(3) || '0'}</dd></div><div><dt>Controller reason</dt><dd>{row?.decision.reason || 'No decision at tick zero.'}{row?.decision.rule !== undefined && ` · Rule ${row.decision.rule + 1}`}</dd></div><div><dt>Termination</dt><dd>{row?.transition.result.reason || 'running'}</dd></div></dl>
        {row?.decision.values && <div><h4>Values used for this action</h4><div className="runtime-values">{row.decision.values.map((v, i) => <div key={i}><span>{['north', 'east', 'south', 'west'][i]}</span><strong>{v.toFixed(3)}</strong></div>)}</div></div>}
        <details><summary>Observation before the selected action</summary><pre className="runtime-json" tabIndex={0}>{JSON.stringify(row?.observation || view, null, 2)}</pre></details><details><summary>Available actions and events</summary><pre className="runtime-json" tabIndex={0}>{JSON.stringify({ actions: row?.actions || receipt.steps[0].actions, events: row?.transition.events || [] }, null, 2)}</pre></details><details><summary>Changed state and hash</summary><pre className="runtime-json" tabIndex={0}>{JSON.stringify({ changes: row?.changes || {}, stateHash: row?.stateHash || receipt.initialHash, finalHash: receipt.finalHash }, null, 2)}</pre></details>
        <p className="small">Stepping through a recording never changes its original episode.</p><button className="btn secondary" onClick={() => download('brain-sweat-receipt.json', receipt)}>Export episode receipt</button>
      </section> : <section className="academy-panel"><h3>Inspect a run</h3><p>Record an episode or run an experiment to see each observation, legal action, reward, and state transition.</p></section>}
      <fieldset className="academy-panel" disabled={active || paused}><legend>Bring back a local experiment</legend><div className="button-row"><label className="btn secondary import-button">Import and verify receipt<input type="file" accept=".json,application/json" aria-label="Import and verify receipt" onChange={e => { void importFile('receipt', e.target.files?.[0]); e.target.value = ''; }} /></label><label className="btn secondary import-button">Import and rerun manifest<input type="file" accept=".json,application/json" aria-label="Import and rerun manifest" onChange={e => { void importFile('experiment', e.target.files?.[0]); e.target.value = ''; }} /></label></div>{academy.lab.experiments.length > 0 && <><h4>Recent experiments</h4><ul>{academy.lab.experiments.map(e => <li key={e.experimentId}><button className="text-link" onClick={() => start(e)}>{names[e.environment]} · {curriculum(e.curriculum).title} · {e.experimentId.slice(0, 8)}</button></li>)}</ul></>}<p className="small">Three manifests and one verified receipt stay with this local profile. No upload and no game XP.</p></fieldset>
    </div></div>{notice && <Notice>{notice}</Notice>}
  </div>;
}
