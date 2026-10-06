import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { controllerSpec } from '../agents/contracts.ts';
import { addAgent, enableCircuitWorlds, evaluationInput, exportPassport, handoffRecord, portfolio, rememberRun, removeArtifact, removeNote, retainPlan, retainFamilyOutputs, updatePassport, writeNote } from '../career/operations.ts';
import { createCareerSession, type CareerSession } from '../career/session.ts';
import type { CareerSave, MemoryCondition, Partition, PublicNote } from '../career/types.ts';
import { validateCareer } from '../career/validation.ts';
import { parseJSON } from '../runtime/data.ts';
import { baselineController } from '../worlds/receipts.ts';
import { useStudio } from '../systems/StudioContext';
import { saveAcademy } from '../systems/profiles';
import { freshAcademy, validateAcademy, type AcademySave } from '../training/models';
import { translate as t } from '../i18n/translate';
import '../styles/career.css';
import { FAMILY_IDS, FAMILY_TITLES, type FamilyId, type FamilyConfig } from '../families/types';
import { familyConfig, validateFamilyConfig } from '../families/specs';
import FamilyTelemetry from './FamilyTelemetry';
import PerformanceComposer from './PerformanceComposer';
import PerformancePanel from './PerformancePanel';
function download(name: string, value: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AgentLocker() {
    const { save, profile } = useStudio();
    const [academy, setAcademy] = useState<AcademySave>(() => save.academy || freshAcademy());
    const locker = academy.career;
    const [selected, setSelected] = useState(locker.agents[0]?.id || '');
    const [name, setName] = useState('Studio agent'), [id, setId] = useState('studio-agent');
    const [world, setWorld] = useState('reserve-lesson'), [partition, setPartition] = useState<Partition>('CAREER'), [condition, setCondition] = useState<MemoryCondition>('FRESH');
    const [sharedController, setSharedController] = useState(false);
    const [seed, setSeed] = useState(17), [raceMode, setRaceMode] = useState<NonNullable<FamilyConfig['race']>['mode']>('solo'), [eventConfig, setEventConfig] = useState<FamilyConfig | null>(null);
    const familyWorld = FAMILY_IDS.includes(world as FamilyId);
    const [scope, setScope] = useState<PublicNote['scope']>('CAREER'), [note, setNote] = useState(''), [editing, setEditing] = useState<PublicNote | null>(null);
    const [notice, setNotice] = useState(''), [status, setStatus] = useState('STOPPED'), [revision, setRevision] = useState(0);
    const session = useRef<CareerSession | null>(null), admission = useRef<ReturnType<typeof handoffRecord> | undefined>(undefined), running = useRef(false), epoch = useRef(0), alive = useRef(true), latest = useRef(academy);
    const agent = locker.agents.find(a => a.id === selected);
    useLayoutEffect(() => { latest.current = academy; saveAcademy(academy, profile.id); }, [academy, profile.id]);
    const commit = (career: CareerSave) => { const next = validateAcademy({ ...latest.current, career }); latest.current = next; saveAcademy(next,profile.id); setAcademy(next); };
    const attempt = (fn: () => void) => {
        try {
            fn();
            setNotice('');
        }
        catch (e) {
            setNotice(e instanceof Error ? e.message : 'The operation was rejected.');
        }
    };
    const checkpoint = () => {
        if (session.current) {
            const receipt = session.current.receipt();
            commit(rememberRun(latest.current.career, receipt, admission.current));
            setRevision(n => n + 1);
        }
    };
    const stop = () => { running.current = false; epoch.current++; session.current?.pause(); attempt(checkpoint); setStatus('STOPPED'); };
    useEffect(() => {
        alive.current = true;
        const visibility = () => {
            if (document.hidden) {
                running.current = false;
                epoch.current++;
                session.current?.pause();
                if (session.current) {
                    try {
                        const career = rememberRun(latest.current.career, session.current.receipt(), admission.current);
                        const next = validateAcademy({ ...latest.current, career });
                        latest.current = next;
                        saveAcademy(next, profile.id);
                        setAcademy(next);
                    }
                    catch (e) {
                        setNotice(e instanceof Error ? e.message : 'The operation was rejected.');
                    }
                }
                setStatus('PAUSED');
            }
        };
        document.addEventListener('visibilitychange', visibility);
        return () => { alive.current = false; running.current = false; epoch.current++; session.current?.stop(); document.removeEventListener('visibilitychange', visibility); };
    }, [profile.id]);
    const start = () => {
        if (!agent)
            throw new Error('Create or select a passport first.');
        running.current = false;
        epoch.current++;
        session.current?.stop();
        const episode = `episode-${latest.current.career.runs.length + 1}-${Date.now().toString(36)}`;
        const input = evaluationInput(latest.current.career, agent.id, world, episode, partition, condition);
        const previous = latest.current.career.runs.filter(r => r.agentId === agent.id).at(-1)?.worldId || 'locker';
        const next = createCareerSession(agent, world, input, latest.current.career, familyWorld ? { seed, raceMode, config:eventConfig??defaultEventConfig(), sharedController } : {});
        admission.current = handoffRecord(latest.current.career, agent.id, previous, world, input);
        session.current = next;
        setStatus('READY');
        setRevision(n => n + 1);
    };
    const advance = async (action?: string) => {
        if (!session.current || document.hidden)
            return;
        const generation = epoch.current;
        setStatus('REQUESTING');
        try {
            await session.current.step(action);
            if (!alive.current || generation !== epoch.current || document.hidden)
                return;
            const nextStatus=session.current.status();
            checkpoint();
            setStatus(nextStatus);
        }
        catch (e) {
            if (alive.current && generation===epoch.current && !document.hidden) {
                setNotice(e instanceof Error ? e.message : 'The operation was rejected.');
                stop();
            }
        }
    };
    const run = async () => {
        if (!session.current || running.current)
            return;
        running.current = true;
        const generation = epoch.current;
        try {
            while (running.current && alive.current && generation === epoch.current && !document.hidden && !session.current.result().terminal) {
                for (let i = 0; i < 4 && running.current && generation===epoch.current && !document.hidden && !session.current.result().terminal; i++) {
                    const ok = await session.current.step();
                    if (!ok)
                        throw new Error('Controller halted without a world transition.');
                }
                if (!alive.current || generation !== epoch.current || document.hidden)
                    break;
                if(session.current.result().terminal){running.current=false;checkpoint();setStatus('COMPLETE');return;}
                setStatus(session.current.status());
                setRevision(n => n + 1);
                await new Promise<void>(resolve => setTimeout(resolve, 35));
            }
            if (alive.current && generation === epoch.current && !document.hidden) {
                running.current = false;
                checkpoint();
                setStatus(session.current.result().terminal ? 'COMPLETE' : session.current.status());
            }
        }
        catch (e) {
            if (alive.current && generation===epoch.current && !document.hidden) {
                setNotice(e instanceof Error ? e.message : 'The operation was rejected.');
                stop();
            }
        }
    };
    const importFile = async (file?: File) => {
        if (!file)
            return;
        try {
            if (file.size > 1350000)
                throw new Error('Choose a Locker file smaller than 1.35 MB.');
            const next = validateCareer(parseJSON(await file.text(), 1350000));
            if (!alive.current)
                return;
            validateAcademy({ ...latest.current, career: next });
            stop();
            commit(next);
            setSelected(next.agents[0]?.id || '');
            session.current = null;
            setEditing(null);
            setNote('');
            setStatus('STOPPED');
            setNotice('Locker imported. Execution is stopped.');
        }
        catch (e) {
            if (alive.current)
                setNotice(e instanceof Error ? e.message : 'The operation was rejected.');
        }
    };
    const active = !!session.current && (status === 'READY' || status === 'STOPPED' || status === 'PAUSED' || status === 'REQUESTING');
    const human = agent && (familyWorld || world === 'town-zero' || world === 'reserve-lesson' ? agent.controller.world.family === 'human' : agent.controller.garage.family === 'human');
    const recent = locker.runs.filter(r => r.agentId === selected).at(-1);
    const music = locker.runs.filter(r => r.agentId === selected && r.receipt.schema === 'family-episode@1' && r.receipt.config.family === 'ensemble-lab' && r.receipt.result.reason === 'complete').at(-1);
    function defaultEventConfig(preview=false) {
        const config=familyConfig(world as FamilyId,preview&&!(Number.isInteger(seed)&&seed>=0&&seed<=2147483647)?17:seed,raceMode);
        return ['ensemble-lab','stunt-show','stream-studio'].includes(world)?validateFamilyConfig({...config,schema:'family-config@2'}):config;
    }
    const observed = session.current?.observation();
    const portfolioRows = useMemo(() => selected ? portfolio(locker, selected) : [], [locker, selected]);
    void revision;
    return <div className="academy career"><header className="academy-heading"><div><span className="eyebrow">{t('OPERATIONAL IDENTITY · VERIFIED EVIDENCE')}</span><h1>{t('Agent Locker')}</h1><p>{t('Keep one agent across controllers and worlds. Public notes and artifacts never grant world authority.')}</p></div><a className="btn secondary" href="#/academy?tab=circuit">{t('Circuit Paddock')}</a><a className="btn secondary" href="#/academy">{t('Agent academy')}</a></header>
    <div className="career-grid"><section className="academy-panel"><h2>{t('Passports')}</h2><label>{t('Operational id')}<input aria-label={t('Operational id')} value={id} maxLength={64} onChange={e => setId(e.target.value)}/></label><label>{t('Display name')}<input aria-label={t('Display name')} value={name} maxLength={64} onChange={e => setName(e.target.value)}/></label><button className="btn primary" onClick={() => attempt(() => { commit(addAgent(locker, id, name)); setSelected(id); })}>{t('Create passport')}</button>
      <label>{t('Selected agent')}<select aria-label={t('Selected agent')} value={selected} onChange={e => { const value = e.target.value; stop(); session.current = null; setSelected(value); setEditing(null); setNote(''); }}><option value="">{t('Choose an agent')}</option>{locker.agents.map(a => <option key={a.id} value={a.id}>{a.displayName} · {a.id}</option>)}</select></label>
      {agent && <><dl><dt>{t('Operational id')}</dt><dd>{agent.id}</dd><dt>{t('Controller family')}</dt><dd>{agent.controller.world.family} / {agent.controller.garage.family}</dd><dt>{t('Public capabilities')}</dt><dd>{agent.publicCapabilities.join(', ')}</dd><dt>{t('Verified vehicle')}</dt><dd>{agent.vehicleRef||t('None assigned')}</dd><dt>{t('Verified media')}</dt><dd>{agent.mediaRefs.join(', ')||t('None assigned')}</dd></dl>
        <label>{t('Controller selection')}<select aria-label={t('Controller selection')} value={agent.controller.world.family === 'model' ? 'mock' : agent.controller.world.family} onChange={e => { const value = e.target.value; if(value==='human')setSharedController(false); attempt(() => { stop(); session.current = null; const current = latest.current.career.agents.find(a => a.id === selected)!; const worldController = { ...baselineController('career-controller'), context: 'BOUNDED_NOTEBOOK' as const, ...(value === 'mock' ? { family: 'model' as const, provider: 'mock' as const, model: 'mock-policy' } : value === 'human' ? { family: 'human' as const } : {}) }; commit(updatePassport(latest.current.career, { ...current, controller: { world: worldController, garage: controllerSpec(value === 'mock' ? 'model' : value === 'human' ? 'human' : 'reference') } })); }); }}><option value="baseline">{t('Public baseline')}</option><option value="mock">{t('Deterministic mock')}</option><option value="human">{t('Human operator')}</option></select></label>
        <button className="btn secondary" disabled={agent.publicCapabilities.includes('family-artifacts')} onClick={() => attempt(() => { stop(); session.current=null; commit(enableCircuitWorlds(latest.current.career, selected)); })}>{t('Enable circuit families')}</button><p>{t('Identity is operator-declared. Receipt replay verifies simulation evidence, not provider identity or intelligence.')}</p><a href="#/academy?tab=garage">{t('Optional local model connection')}</a></>}
    </section>
    <section className="academy-panel"><h2>{t('World handoff')}</h2><label>{t('Destination world')}<select aria-label={t('Destination world')} value={world} onChange={e => { const value = e.target.value; stop(); session.current = null; setWorld(value); setEventConfig(null); setCondition('FRESH'); }}><option value="reserve-lesson">{t('Reserve Lesson')}</option><option value="town-zero">Town Zero</option><option value="survey">{t('Hidden-site survey')}</option><option value="community">{t('Community restoration')}</option><option value="signal-maze">{t('Signal maze')}</option>{FAMILY_IDS.map(f => <option key={f} value={f}>{t(FAMILY_TITLES[f])}</option>)}</select></label>
      <label>{t('Evaluation partition')}<select aria-label={t('Evaluation partition')} value={partition} onChange={e => { const value = e.target.value; stop(); session.current = null; setPartition(value as Partition); setSeed(({CAREER:17,TRAIN:1001,HOLDOUT:2001,TRANSFER:3001})[value as Partition]); setEventConfig(null); setCondition('FRESH'); }}>{['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].map(v => <option key={v} value={v}>{v}</option>)}</select></label><label>{t('Memory condition')}<select aria-label={t('Memory condition')} value={condition} onChange={e => { const value = e.target.value; stop(); session.current = null; setCondition(value as MemoryCondition); }}><option value="FRESH">{t('Fresh memory')}</option><option value="FROZEN" disabled={partition === 'HOLDOUT' || (!familyWorld && !['reserve-lesson', 'town-zero'].includes(world))}>{t('Frozen snapshot')}</option><option value="PRIOR" disabled={partition === 'HOLDOUT' || (!familyWorld && !['reserve-lesson', 'town-zero'].includes(world))}>{t('Declared prior memory')}</option></select></label>{partition === 'HOLDOUT' && <p><strong>{t('HOLDOUT context policy')}:</strong> {t('Fresh only. Prior notes and artifacts are blocked before execution and cannot become verified HOLDOUT evidence.')}</p>}
      {familyWorld && <><label className="family-team-toggle"><input type="checkbox" checked={sharedController} disabled={!agent||agent.controller.world.family==='human'} onChange={e=>{const value=e.target.checked;stop();session.current=null;setSharedController(value);}}/>{t('Match controller descriptor for every role')}</label><p>{t('Public teammates are used by default. Every role proposes before the turn advances.')}</p><label>{t('Scenario seed')}<input aria-label={t('Scenario seed')} type="number" min={0} max={2147483647} value={seed} onChange={e => { const value=Number(e.target.value); stop(); session.current=null; setSeed(value); setEventConfig(null); }}/></label>{world==='auto-circuit' && <label>{t('Race format')}<select aria-label={t('Race format')} value={raceMode} onChange={e => { const value=e.target.value; stop(); session.current=null; setRaceMode(value as typeof raceMode); setEventConfig(null); }}>{['solo','head-to-head','multi-car','endurance'].map(v=><option key={v} value={v}>{t(({'solo':'Solo time trial','head-to-head':'Head-to-head race','multi-car':'Multi-car race','endurance':'Team endurance'} as Record<string,string>)[v])}</option>)}</select></label>}<details><summary>{t('Data-defined event configuration')}</summary><p>{t('Import bounded vehicle, track or original score data for this family.')}</p><pre>{JSON.stringify(eventConfig || defaultEventConfig(true),null,2)}</pre><button className="btn secondary" onClick={() => attempt(() => download('brain-sweat-event-config.json',eventConfig||defaultEventConfig()))}>{t('Export event configuration')}</button><label className="btn secondary import-button">{t('Import event configuration')}<input type="file" aria-label={t('Import event configuration')} accept=".json,application/json" onChange={e => { const file=e.target.files?.[0]; e.target.value=''; if(file) {const generation=epoch.current;void file.text().then(text=>{if(!alive.current||generation!==epoch.current)return;attempt(()=>{const config=validateFamilyConfig(parseJSON(text,45000));if(config.family!==world)throw new Error('Configuration belongs to another family.');stop();session.current=null;setEventConfig(config);setSeed(config.seed);if(config.race)setRaceMode(config.race.mode);});}).catch(error=>{if(alive.current)setNotice(error instanceof Error?error.message:'The operation was rejected.');});} }}/></label></details></>}
      {world==='ensemble-lab' && <PerformanceComposer seed={seed} onConfig={config=>{stop();session.current=null;setEventConfig(config);}}/>}
      <div className="button-row"><button className="btn primary" disabled={!agent || status === 'REQUESTING'} onClick={() => attempt(start)}>{t('Prepare handoff')}</button><button className="btn secondary" disabled={!active || running.current || human && session.current?.actions().length !== 0 || status === 'REQUESTING'} onClick={() => void advance()}>{t('Advance one tick')}</button><button className="btn secondary" disabled={!active || running.current || human || status === 'REQUESTING'} onClick={() => void run()}>{t('Run episode')}</button><button className="btn secondary" disabled={!active} onClick={stop}>{t('Stop and save')}</button></div>
      <p role="status">{t('Execution status')}: {status}</p>{session.current?.kind==='family' && <FamilyTelemetry view={session.current.observation()} result={session.current.result()}/>}{session.current?.kind==='family'&&<details><summary>{t('Inspect role controllers')}</summary><pre>{JSON.stringify(session.current.controllers(),null,2)}</pre></details>}{observed && <><h3>{t('Public observation')}</h3><pre tabIndex={0}>{JSON.stringify(observed, null, 2)}</pre>{human && <div className="button-row">{session.current?.actions().map(action => <button className="btn secondary" disabled={status === 'REQUESTING' || session.current?.result().terminal} key={action} onClick={() => void advance(action)}>{action}</button>)}</div>}</>}
      {admission.current && <details><summary>{t('Inspect admission')}</summary><pre>{JSON.stringify(admission.current, null, 2)}</pre></details>}
      <button className="btn secondary" disabled={!session.current || session.current.kind !== 'world' || running.current || status === 'REQUESTING'} onClick={() => attempt(() => { session.current!.recordPlan(); checkpoint(); })}>{t('Record public plan')}</button>
    </section>
    <section className="academy-panel"><h2>{t('Scoped public memory')}</h2><p>{t('Episode notes expire at handoff. World notes stay in their world. Career notes are portable. Holdout and transfer notes never become automatic context.')}</p><label>{t('Note scope')}<select aria-label={t('Note scope')} value={scope} disabled={!!editing} onChange={e => setScope(e.target.value as PublicNote['scope'])}>{['CAREER', 'WORLD', 'EPISODE'].map(v => <option key={v} value={v}>{v}</option>)}</select></label><label>{t('Public note')}<textarea aria-label={t('Public note')} value={note} maxLength={120} onChange={e => setNote(e.target.value)}/></label><button className="btn secondary" disabled={!agent || !note.trim() || scope === 'EPISODE' && !recent} onClick={() => attempt(() => { commit(writeNote(locker, selected, editing ? { ...editing, text: note } : { id: `note-${Date.now().toString(36)}`, scope, worldId: scope === 'CAREER' ? null : world, episode: scope === 'EPISODE' ? recent!.evaluation.episode : null, sourceRun: null, partition: 'CAREER', text: note })); setNote(''); setEditing(null); })}>{t('Save public note')}</button>
      {editing && <button className="btn secondary" onClick={() => { setEditing(null); setNote(''); }}>{t('Cancel note edit')}</button>}
      {(locker.notes[selected] || []).map(n => <div className="career-note" key={n.id}><span>{n.scope} · {n.worldId || 'all'} · {n.partition}</span><p>{n.text}</p><button className="btn secondary" onClick={() => { setEditing(n); setScope(n.scope); setNote(n.text); }}>{t('Edit note')}</button><button className="btn secondary" onClick={() => attempt(() => commit(removeNote(locker, selected, n.id)))}>{t('Delete note')}</button></div>)}
    </section>
    <section className="academy-panel"><h2>{t('Verified portfolio')}</h2>{agent && portfolioRows.map(row => <div key={row.family}><h3>{row.family}</h3><details><summary>{t('Observed measures')}</summary><pre>{JSON.stringify(row.skills, null, 2)}</pre><p>{t('World outcomes include the recorded team actions. These measures describe this scenario and controller.')}</p></details><p>{t('Recorded runs')}: {row.runs} · {t('Completed runs')}: {row.completed}</p></div>)}
      <p>{t('Evidence is family-specific. Counts describe these retained receipts, not a universal ability score.')}</p>
      <div className="career-table"><table><thead><tr>{['World', 'Role', 'Controller', 'Partition', 'Memory', 'Ticks'].map(v => <th key={v} scope="col">{t(v)}</th>)}</tr></thead><tbody>{locker.runs.filter(r => r.agentId === selected).map(r => <tr key={r.digest}><td>{r.worldId}</td><td>{r.actor}</td><td>{r.controller.family}</td><td>{r.evaluation.partition}</td><td>{r.evaluation.condition}</td><td>{r.receipt.schema === 'world-episode@1' ? r.receipt.result.tick : r.receipt.result.ticks}</td></tr>)}</tbody></table></div>
      {recent && <details><summary>{t('Inspect verified receipt')}</summary><p>{recent.digest}</p><pre tabIndex={0}>{JSON.stringify(recent.receipt.records.slice(-12), null, 2)}</pre><button className="btn secondary" onClick={() => download('brain-sweat-career-receipt.json', recent)}>{t('Export receipt')}</button></details>}
      <h3>{t('Portable artifacts')}</h3>{locker.artifacts.filter(a => a.creator === selected).map(a => <details key={a.id}><summary>{a.id} · {a.type}</summary><pre>{JSON.stringify(a, null, 2)}</pre><button className="btn secondary" onClick={() => attempt(() => commit(removeArtifact(locker, a.id)))}>{t('Delete artifact')}</button></details>)}
      <button className="btn secondary" disabled={!recent || recent.receipt.schema !== 'world-episode@1'} onClick={() => attempt(() => commit(retainPlan(locker, recent!.digest, `plan-${Date.now().toString(36)}`, ['reserve-lesson', 'town-zero'])))}>{t('Retain verified plan')}</button>
      <button className="btn secondary" disabled={!recent || recent.receipt.schema!=='family-episode@1' || !['CAREER','TRAIN'].includes(recent.evaluation.partition) || !recent.receipt.outputs.some(o=>o.actor===recent.actor)} onClick={() => attempt(() => commit(retainFamilyOutputs(locker,recent!.digest,`asset-${Date.now().toString(36)}`)))}>{t('Retain verified family outputs')}</button><h3>{t('Recent handoffs')}</h3>{locker.handoffs.filter(h => h.agentId === selected).map((h, i) => <p key={`${h.snapshotHash}-${i}`}>{h.source} → {h.destination} · {t('Accepted artifacts')}: {h.accepted.length} · {t('Rejected artifacts')}: {h.rejected.length}</p>)}
    </section></div>
    {music && music.receipt.schema==='family-episode@1' && <PerformancePanel key={`${profile.id}-${music.digest}`} receipt={music.receipt} muted={save.settings.muted} onReview={text=>commit(writeNote(latest.current.career,selected,{id:`listen-${Date.now().toString(36)}`,scope:'EPISODE',worldId:music.worldId,episode:music.evaluation.episode,sourceRun:music.digest,partition:music.evaluation.partition,text}))}/>}
    <footer className="academy-save"><p>{t('Bounded local archive: eight passports, eight retained runs, twelve notes per agent and twenty-four artifacts. Export before replacing older evidence. No game XP is awarded.')}</p><div className="button-row"><button className="btn secondary" onClick={() => download('brain-sweat-locker.json', locker)}>{t('Export Locker')}</button><button className="btn secondary" disabled={!agent} onClick={() => attempt(() => download('brain-sweat-passport.json', exportPassport(locker, selected)))}>{t('Export passport and evidence')}</button><label className="btn secondary import-button">{t('Import Locker')}<input type="file" aria-label={t('Import Locker')} accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }}/></label></div></footer>{notice && <p role="alert">{t(notice)}</p>}
  </div>;
}
