import { useEffect, useMemo, useState } from 'react';
import { controllerAt, localProgram, replayCircuitPart } from '../circuit/presentation';
import type { CircuitEvent, CircuitPart, CircuitSeason } from '../circuit/types';
import { translate as t } from '../i18n/translate';
import FamilyTelemetry from './FamilyTelemetry';

export default function CircuitReplay({ event, part, season }: { event: CircuitEvent; part: CircuitPart; season: CircuitSeason }) {
    const [frame, setFrame] = useState(0), [playing, setPlaying] = useState(false), [role, setRole] = useState(Object.keys(part.bindings)[0]);
    const view = useMemo(() => replayCircuitPart(part, frame, role), [part, frame, role]);
    const program = useMemo(() => localProgram(event, part, frame, role), [event, part, frame, role]);
    const controller = useMemo(() => controllerAt(part, role, frame), [part, role, frame]);
    const active = playing && frame < part.native.records.length;
    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setFrame(n => Math.min(part.native.records.length, n + 1)), 120);
        const hidden = () => { if (document.hidden) setPlaying(false); };
        document.addEventListener('visibilitychange', hidden);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); };
    }, [active, part]);
    return <section className="academy-panel circuit-theater" aria-label={t('Replay theater')}>
        <span className="eyebrow">{t('LOCAL REPLAY THEATER')}</span><h2>{t('Every frame has a receipt.')}</h2>
        <div className="circuit-controls"><label>{t('Replay camera')}<select aria-label={t('Replay camera')} value={role} onChange={e => setRole(e.target.value)}>{Object.keys(part.bindings).map(r => <option key={r}>{r}</option>)}</select></label><label>{t('Replay frame')}<input aria-label={t('Replay frame')} type="range" min={0} max={part.native.records.length} value={frame} onChange={e => { setPlaying(false); setFrame(Number(e.target.value)); }}/></label><output>{frame} / {part.native.records.length}</output><button className="btn secondary" disabled={!part.native.records.length} onClick={() => { if (!active && frame === part.native.records.length) setFrame(0); setPlaying(!active); }}>{t(active ? 'Pause replay' : 'Play replay')}</button></div>
        <p className="circuit-caption">{program.caption}</p><div className="circuit-attribution">{t('Passport')}: {view.actor.agentId} · {t('Team')}: {view.actor.teamId}</div>
        <div className="circuit-attribution">{t('Controller at this frame')}: {controller.family} · {controller.provider} · {controller.model} · {controller.id}</div>
        <p>{t('The controller proposes. Native world rules own legal mutation, scoring and completion.')}</p>
        {view.kind === 'family' ? <FamilyTelemetry view={view.view} result={view.result} vehicleNames={Object.fromEntries(((view.result.public.cars as {id:string}[] | undefined) ?? []).map((car,i) => [car.id, `${i+1} · ${season.teams.find(team => team.id === part.teamIds[i])?.title ?? part.teamIds[i]}`]))}/> : <div className="circuit-town"><svg role="img" aria-label={t('Town resource replay')} viewBox="0 0 440 220"><title>{t('Town resource replay')}</title>{Object.entries(view.view.resources).filter(([, value]) => typeof value === 'number').slice(0, 6).map(([name, value], i) => <g key={name}><text x="8" y={i * 33 + 23} fill="currentColor" fontSize="13">{name}</text><rect x="145" y={i * 33 + 8} width={Math.max(1, Math.min(260, Number(value) * 2))} height="20" fill="#665bd5" rx="4"/><text x="415" y={i * 33 + 23} fill="currentColor" textAnchor="end" fontSize="13">{value}</text></g>)}</svg><p>{t('Logical tick')}: {view.result.tick} · {t('Completion')}: {Math.round(view.result.completion * 100)}%</p><details><summary>{t('Visible Town state')}</summary><pre tabIndex={0}>{JSON.stringify(view.view, null, 2)}</pre></details></div>}
        <h3>{t('Template commentary')}</h3><ol>{program.commentary.map((line, i) => <li key={i}>{t(line)}</li>)}</ol><p>{t('Commentary reads this public replay frame. It cannot control the world or award points.')}</p>
        <details><summary>{t('Causal ledger and handoffs')}</summary>{view.kind === 'world' ? <><pre tabIndex={0}>{JSON.stringify(part.native.schema === 'world-episode@1' ? part.native.records[frame - 1]?.frame?.ledger ?? [] : [], null, 2)}</pre><ol>{part.shifts.filter(s => s.index <= frame).map((s, i) => <li key={i}>{s.tick} · {s.role} → {s.agentId}</li>)}</ol></> : <pre tabIndex={0}>{JSON.stringify(part.native.records[frame - 1] ?? {}, null, 2)}</pre>}</details>
        <details><summary>{t('Admitted public inputs')}</summary>{part.admissions.map(a => <div key={a.role}><strong>{a.role}</strong><p className="circuit-hash">{a.snapshotHash}</p><ul>{a.assets.map(s => <li key={s.id}>{s.type} · {s.teamId} · {s.partition}<span className="circuit-hash">{s.sourceDigest ?? s.contentHash}</span></li>)}</ul>{a.notes.map(n => <p key={n.id}>{n.text}</p>)}</div>)}</details><p className="circuit-hash">{part.native.digest}</p>
    </section>;
}
