import { useEffect, useMemo, useRef, useState } from 'react';
import { parseJSON } from '../runtime/data';
import { useStudio } from '../systems/StudioContext';
import { getWarning, saveAcademy } from '../systems/profiles';
import { freshAcademy, validateAcademy, type AcademySave } from '../training/models';
import { validatePassport } from '../career/validation';
import { validateCircuit } from '../circuit/evidence';
import { addCircuitAgents, addCircuitSeason, addCircuitTeam, careerTimeline, importCircuitWorldPack, nextCircuitRound, rememberCircuitEvent, reviewCircuitPerformance, revokeCircuitAssetGrant, shareCircuitAsset, starterCircuit, updateCircuitAgent, writeCircuitNote } from '../circuit/operations';
import { CircuitSession } from '../circuit/session';
import { makeSeason, validateSeason } from '../circuit/specs';
import { eventAssets } from '../circuit/assets';
import { bridgeManifest, circuitOperatorStatus, groupCircuitAssets, leagueTables, localProgram } from '../circuit/presentation';
import { generalizationMatrix, standings } from '../circuit/scoring';
import { validateCircuitBatch } from '../circuit/cli';
import { CIRCUIT_FAMILIES, CIRCUIT_LIMITS, CIRCUIT_METRICS, type CircuitBatch, type CircuitEvent, type CircuitSave } from '../circuit/types';
import { ollamaAdapter } from '../agents/ollama';
import { baselineController } from '../worlds/receipts';
import { cast } from '../fork-thirty/cast';
import { bindCastLocalModel, createCastPassport, createLocalModelBinding, isForkThirtyPassport } from '../fork-thirty/runtime/local-model';
import { translate as t } from '../i18n/translate';
import CircuitReplay from './CircuitReplay';
import PerformancePanel from './PerformancePanel';
import PerformanceComposer from './PerformanceComposer';
import type { FamilyConfig } from '../families/types';
import '../styles/career.css';
import '../styles/circuit.css';

function download(name: string, data: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function controllerLabel(controller: { family: string; provider: string; model: string }) {
    if (controller.family === 'baseline') return 'baseline';
    if (controller.family === 'human') return 'human';
    if (controller.provider === 'mock') return 'mock';
    if (controller.provider === 'ollama') return `local · ${controller.model}`;
    return `${controller.family} · ${controller.provider} · ${controller.model}`;
}
export default function CircuitPaddock() {
    const { save, profile } = useStudio();
    const [academy, setAcademy] = useState<AcademySave>(() => save.academy || freshAcademy()), latest = useRef(academy);
    const circuit = academy.circuit, [seasonId, setSeasonId] = useState(circuit.seasons[0]?.spec.id ?? ''), [partition, setPartition] = useState<CircuitEvent['partition']>('CAREER');
    const [length, setLength] = useState<6 | 12>(6), [mode, setMode] = useState<'CAREER' | 'GAUNTLET'>('CAREER'), [seedIndex, setSeedIndex] = useState(0), [notice, setNotice] = useState(''), [status, setStatus] = useState('STOPPED'), [revision, setRevision] = useState(0);
    const [openingConfig, setOpeningConfig] = useState<FamilyConfig | null>(null);
    const [replayId, setReplayId] = useState(''), [partId, setPartId] = useState('part-1'), [note, setNote] = useState(''), [noteTeam, setNoteTeam] = useState('comet'), [noteFamily, setNoteFamily] = useState('TEAM');
    const [teamId, setTeamId] = useState('new-crew'), [teamTitle, setTeamTitle] = useState('New crew'), [members, setMembers] = useState<string[]>([]), [shareTo, setShareTo] = useState('aurora');
    const [batch, setBatch] = useState<CircuitBatch | null>(null), [batchProgress, setBatchProgress] = useState(0), [batchRunning, setBatchRunning] = useState(false);
    const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:8787'), [models, setModels] = useState<string[]>([]), [model, setModel] = useState('');
    const [castId, setCastId] = useState('al');
    const provider = useRef<ReturnType<typeof ollamaAdapter> | null>(null), connectAbort = useRef<AbortController | null>(null), worker = useRef<Worker | null>(null);
    const session = useRef<CircuitSession | null>(null), running = useRef(false), busy = useRef(false), epoch = useRef(0), alive = useRef(true), persist = useRef<() => void>(() => {});
    const season = circuit.seasons.find(s => s.spec.id === seasonId), next = season && nextCircuitRound(circuit, season, partition, seedIndex);
    const event = circuit.events.find(e => e.id === replayId) ?? circuit.events.at(-1), part = event?.parts.find(p => p.id === partId) ?? event?.parts[0];
    const rows = useMemo(() => season ? standings(season, circuit.events, partition) : [], [season, circuit.events, partition]);
    const league = useMemo(() => season ? leagueTables(season, circuit.events) : null, [season, circuit.events]);
    const assets = useMemo(() => [...circuit.operators, ...circuit.events.flatMap(eventAssets)], [circuit]);
    const assetGroups = useMemo(() => groupCircuitAssets(assets), [assets]);
    const displayStatus = circuitOperatorStatus(status, Boolean(next));
    const music = circuit.events.flatMap(e => e.parts.map(p => ({ e, p }))).filter(({ p }) => p.native.schema === 'family-episode@1' && p.native.config.family === 'ensemble-lab' && p.native.result.terminal).at(-1);
    const commit = (value: CircuitSave) => { const updated = validateAcademy({ ...latest.current, circuit: value }); saveAcademy(updated, profile.id); latest.current = updated; setAcademy(updated); if (getWarning()) setNotice(getWarning()); };
    const attempt = (fn: () => void) => { try { setNotice(''); fn(); } catch (e) { setNotice(e instanceof Error ? e.message : 'The operation was rejected.'); } };
    const checkpoint = () => { if (session.current) { commit(rememberCircuitEvent(latest.current.circuit, session.current.receipt())); setRevision(n => n + 1); } };
    persist.current = checkpoint;
    const halt = () => { epoch.current++; running.current = false; session.current?.stop(); worker.current?.terminate(); worker.current = null; setBatchRunning(false); attempt(checkpoint); setStatus('STOPPED'); };
    useEffect(() => {
        alive.current = true;
        const hidden = () => { if (document.hidden) { epoch.current++; running.current = false; session.current?.pause(); worker.current?.terminate(); worker.current = null; setBatchRunning(false); try { persist.current(); } catch (e) { setNotice(e instanceof Error ? e.message : 'The operation was rejected.'); } setStatus('PAUSED'); } };
        const unloading = () => { running.current = false; session.current?.stop(); try { persist.current(); } catch { /* Existing archive remains intact; export stays available. */ } };
        document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', unloading);
        return () => { unloading(); alive.current = false; epoch.current++; worker.current?.terminate(); connectAbort.current?.abort(); provider.current?.disconnect(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', unloading); };
    }, [profile.id]);
    const prepare = () => {
        if (!season || !next) throw new Error('Choose a season with a pending event.');
        if (!session.current || session.current.round.id !== next.id || session.current.season.spec.id !== seasonId || session.current.partition !== partition || session.current.seedIndex !== seedIndex) {
            session.current = new CircuitSession(latest.current.circuit, seasonId, next.id, partition, seedIndex, provider.current ? { ollama: provider.current } : {});
        }
        session.current.resume(); return session.current;
    };
    const advance = async (automatic: boolean) => {
        if (busy.current || running.current || document.hidden) return;
        const generation = epoch.current; busy.current = true; running.current = automatic;
        try {
            const active = prepare(); setStatus('REQUESTING'); let turns = 0;
            do {
                const human = active.humanRoles();
                if (human.length) { setStatus('READY'); setNotice('Choose every human role action before advancing.'); break; }
                if (!await active.step()) throw new Error(active.error || 'Circuit event halted.');
                turns++; if (!alive.current || generation !== epoch.current || document.hidden) return;
                if (turns % 16 === 0) { setRevision(n => n + 1); if (turns % 64 === 0) checkpoint(); await new Promise<void>(resolve => setTimeout(resolve, 15)); }
            } while (automatic && running.current && active.status === 'READY');
            if (generation === epoch.current && alive.current) { checkpoint(); setStatus(active.status); if (active.status === 'COMPLETE') { setReplayId(active.id); setPartId('part-1'); setNotice('Event complete. Native receipts verified. Advance the next event when ready.'); } }
        } catch (e) { if (alive.current && generation === epoch.current) { session.current?.stop(); setStatus('ERROR'); setNotice(e instanceof Error ? e.message : 'The operation was rejected.'); } }
        finally { busy.current = false; running.current = false; }
    };
    const [humanActions, setHumanActions] = useState<Record<string, string>>({});
    const humanTurn = async () => {
        if (busy.current || document.hidden || !session.current) return;
        const active = session.current, generation = epoch.current; busy.current = true;
        try { active.resume(); if (!await active.step(humanActions)) throw new Error(active.error || 'Choose every human role action before advancing.'); if (alive.current && generation === epoch.current) { checkpoint(); setHumanActions({}); setStatus(active.status); } }
        catch (e) { if (alive.current && generation === epoch.current) setNotice(e instanceof Error ? e.message : 'The operation was rejected.'); } finally { busy.current = false; }
    };
    const importFile = async (file: File | undefined, kind: 'archive' | 'season' | 'batch' | 'pack') => {
        if (!file) return; const generation = epoch.current;
        try {
            const limit = kind === 'batch' ? CIRCUIT_LIMITS.batchBytes : kind === 'season' || kind === 'pack' ? 300000 : CIRCUIT_LIMITS.bytes;
            if (file.size > limit) throw new Error('Circuit import exceeds its declared limit.'); const raw = parseJSON(await file.text(), limit);
            let value: CircuitSave | null = null, report: CircuitBatch | null = null;
            if (kind === 'batch') report = validateCircuitBatch(raw);
            else if (kind === 'season') value = addCircuitSeason(latest.current.circuit, validateSeason(raw));
            else if (kind === 'pack') { const team = latest.current.circuit.teams.find(t => t.id === noteTeam); if (!team) throw new Error('Choose a retained Circuit team.'); value = importCircuitWorldPack(latest.current.circuit, team.id, team.members[0], raw); }
            else value = validateCircuit(raw);
            if (value) validateAcademy({ ...latest.current, circuit: value });
            if (!alive.current || generation !== epoch.current) return;
            halt(); session.current = null;
            if (value) { commit(value); setSeasonId(value.seasons.at(-1)?.spec.id ?? ''); setPartition(value.seasons.at(-1)?.spec.mode === 'GAUNTLET' ? 'TRAIN' : 'CAREER'); setReplayId(''); }
            if (report) setBatch(report); setNotice('Circuit imported and replay verified. Execution is stopped.');
        } catch (e) { if (alive.current && generation === epoch.current) setNotice(e instanceof Error ? e.message : 'The operation was rejected.'); }
    };
    const startBatch = () => attempt(() => {
        if (!season || season.spec.mode !== 'GAUNTLET') throw new Error('Choose a frozen gauntlet first.'); halt(); const generation = epoch.current;
        const active = new Worker(new URL('../circuit/batch.worker.ts', import.meta.url), { type: 'module' }); worker.current = active; setBatchRunning(true); setBatchProgress(0);
        active.onmessage = (message: MessageEvent<{ type: string; count?: number; result?: CircuitBatch; error?: string }>) => {
            if (!alive.current || generation !== epoch.current || document.hidden) return;
            if (message.data.type === 'progress') setBatchProgress(message.data.count ?? 0);
            else { active.terminate(); worker.current = null; setBatchRunning(false); try { if (message.data.result) { setBatch(validateCircuitBatch(message.data.result)); setNotice('Frozen batch verified. Export the report to keep its full evidence.'); } else setNotice(message.data.error ?? 'Circuit batch rejected.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Circuit batch rejected.'); } }
        };
        active.onerror = () => { if (generation === epoch.current && alive.current) { active.terminate(); worker.current = null; setBatchRunning(false); setNotice('Circuit worker failed.'); } };
        active.postMessage({ save: latest.current.circuit, seasonId, seeds: 1 });
    });
    const connect = async () => {
        connectAbort.current?.abort(); const abort = new AbortController(); connectAbort.current = abort;
        try { const bridge = ollamaAdapter(bridgeUrl); await bridge.connect(abort.signal); const list = await bridge.models(abort.signal); if (!alive.current || abort.signal.aborted) { bridge.disconnect(); return; } provider.current?.disconnect(); provider.current = bridge; setModels(list.map(m => m.id)); setModel(list[0]?.id ?? ''); setNotice('Local bridge connected. Model runs require explicit passport selection.'); }
        catch (e) { if (alive.current && !abort.signal.aborted) setNotice(e instanceof Error ? e.message : 'Local connection failed.'); }
    };
    const changeController = (id: string, value: string) => attempt(() => {
        const agent = circuit.agents.find(a => a.id === id)!;
        if (value === 'local' && (!provider.current || !model)) throw new Error('Connect the local bridge and select an installed model first.');
        if (value === 'local' && isForkThirtyPassport(agent)) {
            const binding = createLocalModelBinding(id, model);
            commit(updateCircuitAgent(latest.current.circuit, bindCastLocalModel(agent, binding)));
        } else {
            const nextController = value === 'baseline' ? baselineController(agent.controller.world.id) : { ...agent.controller.world, family: value === 'human' ? 'human' as const : 'model' as const, provider: value === 'mock' ? 'mock' as const : value === 'local' ? 'ollama' as const : 'none' as const, model: value === 'local' ? model : value === 'mock' ? 'mock-policy' : 'public-baseline' };
            commit(updateCircuitAgent(latest.current.circuit, { ...agent, controller: { ...agent.controller, world: nextController } }));
        }
        setNotice(value === 'local' && isForkThirtyPassport(agent)
            ? `${agent.displayName} is bound to local model ${model}. The model proposes; native rules still own mutation and scoring.`
            : season?.agents.some(frozen => frozen.id === id)
                ? 'Passport controller updated for future seasons. The active season keeps its frozen controller snapshot.'
                : 'Passport controller updated. Freeze a season to capture it.');
    });
    const humans = session.current?.humanRoles() ?? [], matrix = batch ? generalizationMatrix(batch.season, batch.trials) : season?.spec.mode === 'GAUNTLET' ? generalizationMatrix(season, circuit.events) : [];
    void revision;
    return <div className="circuit-paddock" data-circuit-status={displayStatus}>
        <header className="circuit-hero"><span className="eyebrow">{t('THE AGENT CIRCUIT')}</span><h1>{t('Circuit Paddock')}</h1><p>{t('Keep a crew. Run a season. Bring the receipts.')}</p><div className="button-row"><a className="btn secondary" href="#/academy">{t('Agent academy')}</a><a className="btn secondary" href="#/academy?tab=locker">{t('Agent Locker')}</a><button className="btn secondary" onClick={() => download('brain-sweat-circuit.json', circuit)}>{t('Export Circuit')}</button><label className="btn secondary import-button">{t('Import Circuit')}<input type="file" aria-label={t('Import Circuit')} accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'archive'); e.target.value = ''; }}/></label></div></header>
        <p role="status" className="circuit-notice">{t(notice || 'Every event advances in logical time. Reloads and imports start stopped.')}</p>{getWarning() && <p role="alert">{t(getWarning())}</p>}
        <div className="circuit-grid"><section className="academy-panel"><h2>{t('Persistent teams')}</h2>{!circuit.agents.length && <button className="btn primary" onClick={() => attempt(() => commit(starterCircuit(circuit)))}>{t('Create two starter teams')}</button>}
            <div className="circuit-controls"><label>{t('Fork-Thirty resident')}<select aria-label={t('Fork-Thirty resident')} value={castId} onChange={e => setCastId(e.target.value)}>{cast.filter(resident => !circuit.agents.some(agent => agent.id === resident.id)).map(resident => <option key={resident.id} value={resident.id}>{resident.displayName} · {resident.role}</option>)}</select></label><button className="btn secondary" disabled={circuit.agents.length >= CIRCUIT_LIMITS.agents || circuit.agents.some(agent => agent.id === castId)} onClick={() => attempt(() => { commit(addCircuitAgents(latest.current.circuit, [createCastPassport(castId)])); const nextResident = cast.find(resident => resident.id !== castId && !latest.current.circuit.agents.some(agent => agent.id === resident.id)); if (nextResident) setCastId(nextResident.id); setNotice('Fork-Thirty resident added as a governed Circuit passport. Choose a controller, then freeze a season to capture it.'); })}>{t('Add Fork-Thirty resident')}</button></div>
            <p>{t('Fork-Thirty residents start as bounded passports with zero authority. Local models require an explicit loopback connection and remain proposal-only.')}</p>
            {!!academy.career.agents.length && <button className="btn secondary" onClick={() => attempt(() => commit(addCircuitAgents(circuit, academy.career.agents.filter(a => !circuit.agents.some(p => p.id === a.id)).map(a => validatePassport({ ...a, compatibleWorlds: [...new Set([...a.compatibleWorlds, ...CIRCUIT_FAMILIES])], publicCapabilities: [...new Set([...a.publicCapabilities, 'family-artifacts'])] })))))}>{t('Copy Locker passports')}</button>}<p>{t('Circuit passports are copied snapshots. Locker edits and later controller changes do not rewrite a frozen season.')}</p>
            {circuit.teams.map(team => <article className="circuit-team" key={team.id}><h3>{team.title}</h3><p>{team.members.map(id => circuit.agents.find(a => a.id === id)?.displayName ?? id).join(' · ')}</p><details><summary>{t('Role preferences')}</summary><pre tabIndex={0}>{JSON.stringify(team.preferences, null, 2)}</pre></details></article>)}
            {circuit.agents.map(a => <div className="circuit-agent" key={a.id}><strong>{a.displayName}</strong>{isForkThirtyPassport(a) && <p>{t('Fork-Thirty resident')} · {cast.find(resident => resident.id === a.id)?.role}</p>}<label>{t('Passport controller')}<select aria-label={`${t('Passport controller')} ${a.id}`} value={a.controller.world.family === 'model' ? a.controller.world.provider === 'mock' ? 'mock' : 'local' : a.controller.world.family} onChange={e => changeController(a.id, e.target.value)} disabled={running.current || busy.current}>{['baseline', 'mock', 'human', 'local'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></label>{season?.agents.find(frozen => frozen.id === a.id) && <p>{t('Active season frozen controller')}: <strong>{controllerLabel(season.agents.find(frozen => frozen.id === a.id)!.controller.world)}</strong></p>}<details><summary>{t('Career evidence')}</summary>{careerTimeline(circuit, a.id).map((entry, i) => <p key={i}>{entry.roundId} · {entry.partition} · {entry.roles.join(', ')} · {entry.shifts.length} {t('Role shifts')}<span className="circuit-hash">{entry.nativeDigest}</span></p>)}</details></div>)}
            <details><summary>{t('Form another team')}</summary><label>{t('Team id')}<input aria-label={t('Team id')} value={teamId} maxLength={64} onChange={e => setTeamId(e.target.value)}/></label><label>{t('Team title')}<input aria-label={t('Team title')} value={teamTitle} maxLength={64} onChange={e => setTeamTitle(e.target.value)}/></label><fieldset><legend>{t('Team members')}</legend>{circuit.agents.map(a => <label key={a.id}><input type="checkbox" checked={members.includes(a.id)} onChange={e => setMembers(e.target.checked ? [...members, a.id] : members.filter(id => id !== a.id))}/>{a.displayName}</label>)}</fieldset><button className="btn secondary" onClick={() => attempt(() => commit(addCircuitTeam(circuit, teamId, teamTitle, members)))}>{t('Create team')}</button></details>
        </section><section className="academy-panel"><h2>{t('Frozen season schedule')}</h2><p>{t('Season manifests freeze teams, controllers, seeds, memory rules and scoring before the first event.')}</p><div className="circuit-controls"><label>{t('Season length')}<select aria-label={t('Season length')} value={length} onChange={e => setLength(Number(e.target.value) as 6 | 12)}><option value={6}>{t('Six events')}</option><option value={12}>{t('Twelve events')}</option></select></label><label>{t('Season mode')}<select aria-label={t('Season mode')} value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="CAREER">{t('Career season')}</option><option value="GAUNTLET">{t('Frozen gauntlet')}</option></select></label></div>
            <details><summary>{t('Prepare the original opening score')}</summary><PerformanceComposer seed={17} onConfig={config => { setOpeningConfig(config); setNotice('Opening score prepared. Freeze a new season to include it.'); }}/></details>
            <button className="btn primary" disabled={!circuit.teams.length || running.current || batchRunning} onClick={() => attempt(() => { halt(); session.current = null; const activeBefore = seasonId; const id = `season-${circuit.seasons.length + 1}`, spec = makeSeason(circuit.teams.slice(0, 2).map(t => t.id), length, mode, id); const prepared = openingConfig ? { ...spec, rounds: spec.rounds.map((r, i) => i === 0 ? { ...r, config: openingConfig } : r) } : spec; commit(addCircuitSeason(latest.current.circuit, prepared)); if (!activeBefore) { setSeasonId(id); setPartition(mode === 'GAUNTLET' ? 'TRAIN' : 'CAREER'); setSeedIndex(0); setNotice(`Frozen ${id} and made it active.`); } else setNotice(`Frozen ${id}. Active season remains ${activeBefore}; select the new season explicitly to switch.`); })}>{t('Freeze new season')}</button>
            <label className="btn secondary import-button">{t('Import SeasonSpec')}<input type="file" aria-label={t('Import SeasonSpec')} accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'season'); e.target.value = ''; }}/></label>
            {!!circuit.seasons.length && <><label>{t('Active season')}<select aria-label={t('Active season')} value={seasonId} onChange={e => { halt(); session.current = null; setSeasonId(e.target.value); setSeedIndex(0); setPartition(circuit.seasons.find(s => s.spec.id === e.target.value)?.spec.mode === 'GAUNTLET' ? 'TRAIN' : 'CAREER'); }}>{circuit.seasons.map(s => <option key={s.spec.id} value={s.spec.id}>{s.spec.title} · {s.spec.id}</option>)}</select></label>{season && <><div className="circuit-controls"><label>{t('Evaluation partition')}<select aria-label={t('Evaluation partition')} value={partition} onChange={e => { halt(); session.current = null; setPartition(e.target.value as CircuitEvent['partition']); }}>{(season.spec.mode === 'CAREER' ? ['CAREER'] : ['TRAIN', 'HOLDOUT', 'TRANSFER']).map(p => <option key={p}>{p}</option>)}</select></label><label>{t('Frozen seed index')}<select aria-label={t('Frozen seed index')} value={seedIndex} onChange={e => { halt(); session.current = null; setSeedIndex(Number(e.target.value)); }}><option value={0}>0</option><option value={1}>1</option><option value={2}>2</option></select></label></div><ol className="circuit-schedule">{season.spec.rounds.map(r => {
                const archived = circuit.events.find(e => e.seasonHash === season.digest && e.roundId === r.id && e.partition === partition && e.seedIndex === seedIndex);
                const live = session.current?.season.spec.id === seasonId && session.current?.round.id === r.id && session.current.partition === partition && session.current.seedIndex === seedIndex;
                const rowStatus = live && ['REQUESTING', 'READY', 'PAUSED'].includes(status) ? status : archived?.ending ?? 'PENDING';
                return <li key={r.id} className={next?.id === r.id ? 'is-next' : ''}><strong>{t(r.title)}</strong><span>{t(r.family)} · {rowStatus}</span></li>;
            })}</ol><button className="btn secondary" onClick={() => download(`${season.spec.id}-manifest.json`, season.spec)}>{t('Export season manifest')}</button></> }</>}
        </section></div>
        {season && <section className="academy-panel circuit-event" aria-label={t('Event operator')}><h2>{next ? t(next.title) : t('Season complete')}</h2><p>{t('Circuit status')}: <strong data-testid="circuit-status">{displayStatus}</strong> · {t('Next event')}: {next?.id ?? '—'}</p><div className="button-row"><button className="btn primary" disabled={!next || status === 'REQUESTING' || batchRunning} onClick={() => void advance(true)}>{t('Run next event')}</button><button className="btn secondary" disabled={!next || status === 'REQUESTING' || batchRunning} onClick={() => void advance(false)}>{t('One logical turn')}</button><button className="btn secondary" onClick={halt}>{t('Stop Circuit')}</button></div>
            {session.current && <p>{t('Native phase')}: {session.current.observation()?.phase ?? 'COMPLETE'} · {t('Completed phases')}: {session.current.completed.length}</p>}
            {!!humans.length && <fieldset><legend>{t('Human role actions')}</legend>{humans.map(h => <label key={h.role}>{h.role} · {h.agentId}<select aria-label={`${t('Human action')} ${h.role}`} value={humanActions[h.role] ?? ''} onChange={e => setHumanActions(a => ({ ...a, [h.role]: e.target.value }))}><option value="">{t('Choose action')}</option>{h.legal.map(a => <option key={a}>{a}</option>)}</select></label>)}<button className="btn primary" disabled={!humans.every(h => h.legal.includes(humanActions[h.role]))} onClick={() => void humanTurn()}>{t('Advance human turn')}</button></fieldset>}
        </section>}
        {!!rows.length && <section className="academy-panel"><h2>{t('Multidimensional standings')}</h2><p>{t('Circuit points are entertainment rules for these simulations. Unmeasured skills remain blank. Artistic review is separate.')}</p><div className="career-table" tabIndex={0} role="region" aria-label={t('Scrollable results')}><table><caption>{t('Team Circuit standings')}</caption><thead><tr><th scope="col">{t('Team')}</th><th scope="col">{t('Events')}</th><th scope="col">{t('Circuit points')}</th>{CIRCUIT_METRICS.map(k => <th scope="col" key={k}>{t(k)}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.teamId}><th scope="row">{row.title}</th><td>{row.events}</td><td>{row.points.toFixed(2)}</td>{CIRCUIT_METRICS.map(k => <td key={k}>{row.measures[k]?.toFixed(2) ?? '—'}</td>)}</tr>)}</tbody></table></div>
            {league && !!league.races.length && <details><summary>{t('Racing league standings')}</summary>{(['teams', 'drivers', 'constructors'] as const).map(key => <div key={key}><h3>{t(key)}</h3><ol>{league[key].map(r => <li key={r.id}>{r.id} · {r.points} {t('Race points')} · {r.races} {t('Races')}</li>)}</ol></div>)}<p>{t('Constructors identify fictional vehicle entries. Grid order comes from the native qualifying runs.')}</p><pre tabIndex={0}>{JSON.stringify(league.races, null, 2)}</pre></details>}
        </section>}
        <div className="circuit-grid"><section className="academy-panel"><h2>{t('Team public memory')}</h2><label>{t('Memory team')}<select aria-label={t('Memory team')} value={noteTeam} onChange={e => setNoteTeam(e.target.value)}>{circuit.teams.map(team => <option key={team.id} value={team.id}>{team.title}</option>)}</select></label><label>{t('Memory scope')}<select aria-label={t('Memory scope')} value={noteFamily} onChange={e => setNoteFamily(e.target.value)}><option value="TEAM">{t('Team')}</option>{CIRCUIT_FAMILIES.map(f => <option key={f}>{f}</option>)}</select></label><label>{t('Public note')}<textarea aria-label={t('Public note')} value={note} maxLength={120} onChange={e => setNote(e.target.value)}/></label><button className="btn secondary" disabled={!note.trim() || !circuit.teams.length} onClick={() => attempt(() => { commit(writeCircuitNote(circuit, { id: `note-${circuit.notes.length + 1}`, teamId: noteTeam, scope: noteFamily === 'TEAM' ? 'TEAM' : 'WORLD', family: noteFamily === 'TEAM' ? null : noteFamily as typeof CIRCUIT_FAMILIES[number], partition: 'CAREER', sourceEvent: null, text: note })); setNote(''); })}>{t('Save team note')}</button>{circuit.notes.map(n => <p key={n.id}>{n.teamId} · {n.scope} · {n.partition}: {n.text}</p>)}<p>{t('Frozen gauntlets admit no prior notes or artifacts. HOLDOUT and TRANSFER evidence never becomes automatic context.')}</p></section>
        <section className="academy-panel"><h2>{t('Verified artifact shelf')}</h2><label>{t('Share with team')}<select aria-label={t('Share with team')} value={shareTo} onChange={e => setShareTo(e.target.value)}>{circuit.teams.map(team => <option key={team.id} value={team.id}>{team.title}</option>)}</select></label><label className="btn secondary import-button">{t('Import WorldPack')}<input type="file" aria-label={t('Import WorldPack')} accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'pack'); e.target.value = ''; }}/></label><p>{t('Sharing is local and explicit. A round must declare SHARED before another team can admit an asset. WorldPacks can be exported into the World authoring lab.')}</p>
            <div className="circuit-shelf">{assetGroups.slice(-30).map(group => {
                const asset = group.asset;
                const exchangeReason = asset.teamId === shareTo ? 'Selected team already owns this artifact.' : !['CAREER', 'TRAIN'].includes(asset.partition) ? 'Only CAREER or TRAIN artifacts can be declared for exchange.' : circuit.grants.some(g => g.contentHash === asset.contentHash && g.fromTeam === asset.teamId && g.toTeam === shareTo) ? 'This verified content is already granted to that team.' : '';
                return <article key={`${asset.teamId}-${asset.type}-${asset.contentHash}`}><strong>{asset.type}</strong><p>{asset.teamId} · {asset.creator} · {asset.partition}</p><span className="circuit-hash">{asset.contentHash}</span>{group.occurrences > 1 && <p>{t('Receipt trail')}: {group.occurrences} {t('verified occurrences')}</p>}<details><summary>{t('Receipt sources')}</summary><ol>{group.sources.map((source, i) => <li key={`${source.eventId}-${source.partId}-${i}`}>{source.eventId ?? 'operator'} · {source.partId ?? 'source'}<span className="circuit-hash">{source.digest ?? asset.contentHash}</span></li>)}</ol></details><div className="button-row"><button className="btn secondary" onClick={() => download(`${asset.id}.json`, asset.type === 'world-pack' ? asset.content : asset)}>{t('Export asset')}</button><button className="btn secondary" title={exchangeReason || t('Declare an explicit local artifact grant.')} disabled={Boolean(exchangeReason)} onClick={() => attempt(() => commit(shareCircuitAsset(circuit, asset.id, shareTo)))}>{t('Declare exchange')}</button></div>{exchangeReason && <p>{t(exchangeReason)}</p>}</article>;
            })}</div><p>{t('Retained receipts')}: {assets.length} · {t('Unique artifact groups')}: {assetGroups.length} · {t('Declared exchanges')}: {circuit.grants.length}</p>{!!circuit.grants.length && <details><summary>{t('Declared grant ledger')}</summary><ol>{circuit.grants.map(grant => { const source = assets.find(asset => asset.id === grant.assetId); return <li key={grant.id}><strong>{grant.fromTeam} → {grant.toTeam}</strong> · {source?.type ?? 'artifact'} · {source?.sourceEvent ?? 'operator'} / {source?.sourcePart ?? 'source'}<span className="circuit-hash">{grant.contentHash}</span><button className="btn secondary" onClick={() => attempt(() => commit(revokeCircuitAssetGrant(circuit, grant.id)))}>{t('Revoke exchange')}</button></li>; })}</ol></details>}
        </section></div>
        {!!circuit.events.length && <section className="academy-panel"><h2>{t('Local event archive')}</h2><div className="circuit-controls"><label>{t('Archived event')}<select aria-label={t('Archived event')} value={event?.id ?? ''} onChange={e => { setReplayId(e.target.value); setPartId('part-1'); }}>{circuit.events.map(e => <option key={e.id} value={e.id}>{e.roundId} · {e.partition} · {e.ending}</option>)}</select></label>{event && <label>{t('Native replay part')}<select aria-label={t('Native replay part')} value={part?.id ?? ''} onChange={e => setPartId(e.target.value)}>{event.parts.map(p => <option key={p.id} value={p.id}>{p.id} · {p.phase} · {p.teamIds.join(', ')}</option>)}</select></label>}</div>{event && part && <div className="button-row"><button className="btn secondary" onClick={() => download(`${event.id}-${part.id}-native.json`, part.native)}>{t('Export native receipt')}</button><button className="btn secondary" onClick={() => download(`${event.id}-${part.id}-program.json`, localProgram(event, part, part.native.records.length))}>{t('Export local program')}</button><button className="btn secondary" onClick={() => download(`${event.id}-${part.id}-bridges.json`, bridgeManifest(event, part))}>{t('Export bridge interfaces')}</button></div>}<p>{t('Archive limits: 8 agents, 4 teams, 3 seasons, 36 events and 6 MB of replay evidence. Export before starting a fresh archive.')}</p><details><summary>{t('Start a fresh Circuit archive')}</summary><button className="btn secondary" onClick={() => attempt(() => { download('brain-sweat-circuit-backup.json', circuit); halt(); session.current = null; commit(validateCircuit(undefined)); setSeasonId(''); setReplayId(''); setBatch(null); })}>{t('Export and clear Circuit')}</button></details></section>}
        {event && part && <CircuitReplay key={`${event.digest}-${part.id}`} event={event} part={part} season={circuit.seasons.find(s => s.digest === event.seasonHash)!}/>}
        {music && music.p.native.schema === 'family-episode@1' && <PerformancePanel key={`${music.e.id}-${music.p.id}`} receipt={music.p.native} muted={save.settings.muted} onReview={text => attempt(() => commit(reviewCircuitPerformance(latest.current.circuit, music.e.id, music.p.id, text)))}/>}
        {!!circuit.reviews.length && <section className="academy-panel"><h2>{t('Human listening reviews')}</h2>{circuit.reviews.map(r => <p key={`${r.eventId}-${r.partId}`}>{r.text}</p>)}</section>}
        <section className="academy-panel"><h2>{t('Frozen generalization matrix')}</h2><p>{t('Compare recorded TRAIN, HOLDOUT and TRANSFER outcomes under identical logical world rules. Counts, ranges and variance describe these trials; they do not establish general intelligence.')}</p><div className="button-row"><button className="btn primary" disabled={season?.spec.mode !== 'GAUNTLET' || batchRunning || status === 'REQUESTING'} onClick={startBatch}>{t('Run frozen batch')}</button><button className="btn secondary" onClick={halt}>{t('Cancel batch')}</button><label className="btn secondary import-button">{t('Import batch evidence')}<input type="file" aria-label={t('Import batch evidence')} accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'batch'); e.target.value = ''; }}/></label>{batch && <button className="btn secondary" onClick={() => download('brain-sweat-circuit-batch.json', batch)}>{t('Export batch evidence')}</button>}</div>{batchRunning && <p role="status">{t('Verified event trials')}: {batchProgress}</p>}
            {!!matrix.length && <div className="career-table" tabIndex={0} role="region" aria-label={t('Scrollable results')}><table><caption>{t('Observed generalization')}</caption><thead><tr><th scope="col">{t('Round')}</th><th scope="col">{t('Partition')}</th><th scope="col">{t('Samples')}</th><th scope="col">{t('Mean')}</th><th scope="col">{t('Range')}</th><th scope="col">{t('Variance')}</th></tr></thead><tbody>{matrix.flatMap(row => Object.entries(row.partitions).map(([p, n]) => <tr key={`${row.roundId}-${p}`}><th scope="row">{row.roundId} · {row.family}</th><td>{p}</td><td>{n.count}</td><td>{n.mean?.toFixed(2) ?? '—'}</td><td>{n.minimum === null ? '—' : `${n.minimum.toFixed(2)}–${n.maximum!.toFixed(2)}`}</td><td>{n.variance?.toFixed(2) ?? '—'}</td></tr>))}</tbody></table></div>}
        </section><details className="academy-panel"><summary>{t('Optional local model bridge')}</summary><p>{t('Circuit uses existing installed models only after you connect a loopback bridge. No account, download or cloud service is required.')}</p><label>{t('Local bridge address')}<input aria-label={t('Local bridge address')} value={bridgeUrl} onChange={e => setBridgeUrl(e.target.value)}/></label><button className="btn secondary" onClick={() => void connect()}>{t('Connect local bridge')}</button><label>{t('Installed model')}<select aria-label={t('Installed model')} value={model} onChange={e => setModel(e.target.value)}>{models.map(m => <option key={m}>{m}</option>)}</select></label><button className="btn secondary" onClick={() => { halt(); connectAbort.current?.abort(); provider.current?.disconnect(); provider.current = null; setModels([]); setModel(''); }}>{t('Disconnect local bridge')}</button><p>{t('Frozen seasons keep their controller snapshots. Change a passport before freezing a new season. Imported local-model replays are reviewable without contacting a provider.')}</p><p>{t('Bridge exports are interface contracts. Commonline, Domistika, Auralith, KaoticFX and Aetherion are not connected services here.')}</p></details>
    </div>;
}
