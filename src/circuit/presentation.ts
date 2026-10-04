import { freeze, hash } from '../runtime/data.ts';
import { createFamilyEnvironment } from '../families/runtime.ts';
import { inspectWorldReceipt } from '../worlds/receipts.ts';
import { publicEvents } from '../worlds/session.ts';
import { bindingAt } from './assets.ts';
import { familyOfNative, type CircuitEvent, type CircuitPart, type CircuitSeason } from './types.ts';

export function replayCircuitPart(part: CircuitPart, index: number, cameraRole = Object.keys(part.bindings)[0]) {
    const native = part.native;
    if (!Number.isInteger(index) || index < 0 || index > native.records.length || !part.bindings[cameraRole]) throw new Error('Choose a native replay frame and role.');
    if (native.schema === 'world-episode@1') {
        const replay = inspectWorldReceipt(native, index), view = replay.environment.observe(cameraRole);
        return { kind: 'world' as const, view, result: replay.result, events: publicEvents(view, replay.record?.frame?.ledger ?? []).map(e => e.detail), actor: bindingAt(part, cameraRole, index) };
    }
    const env = createFamilyEnvironment(native.config, native.inputs);
    for (const row of native.records.slice(0, index)) env.step(row.intents);
    return { kind: 'family' as const, view: env.observe(cameraRole), result: env.result(), events: index ? native.records[index - 1].events : [], actor: part.bindings[cameraRole] };
}
export function localProgram(event: CircuitEvent, part: CircuitPart, index: number, cameraRole = Object.keys(part.bindings)[0]) {
    const replay = replayCircuitPart(part, index, cameraRole), family = familyOfNative(part);
    const result = replay.kind === 'world' ? { ...replay.result, reserves: Object.fromEntries(Object.entries(replay.result.reserves).filter(([key]) => typeof replay.view.resources[key] === 'number')) } : { ...replay.result, public: replay.view.state };
    // Commentary is an isolated public-view template. It has no action channel,
    // hidden state, wall-clock effect, network dependency or scoring authority.
    return freeze({ schema: 'circuit-program@1', mode: 'local simulated broadcast', eventId: event.id, sourceDigest: part.native.digest, family, cameraRole, index,
        caption: `${family} · ${part.phase} · ${cameraRole} · ${index}/${part.native.records.length}`,
        commentary: replay.events.length ? replay.events.slice(-3) : [index === 0 ? 'The declared native event is ready.' : 'The recorded logical turn is complete.'],
        publicView: replay.view, result, attribution: replay.actor, inputSnapshots: part.admissions.map(a => a.snapshotHash) });
}
export function leagueTables(season: CircuitSeason, events: CircuitEvent[]) {
    const rows = events.filter(e => e.seasonHash === season.digest && e.ending === 'COMPLETE' && e.partition === 'CAREER').flatMap(e => e.parts.filter(p => p.phase === 'race' && p.native.schema === 'family-episode@1').flatMap(p => {
        if (p.native.schema !== 'family-episode@1') return [];
        const cars = p.native.result.public.cars as { id: string; finished: boolean; finishTick: number; position: number; pits: number }[], order = p.native.result.public.standings as string[];
        return cars.map((car, i) => ({ eventId: e.id, teamId: p.teamIds[i], driver: p.bindings[`driver-${i}`].agentId, constructor: car.id, place: order.indexOf(car.id) + 1, finishTick: car.finished ? car.finishTick : null, pits: car.pits, points: car.finished ? [25, 18][order.indexOf(car.id)] ?? 0 : 0 }));
    }));
    const table = (key: 'teamId' | 'driver' | 'constructor') => [...new Set(rows.map(r => r[key]))].map(id => ({ id, races: rows.filter(r => r[key] === id).length, points: rows.filter(r => r[key] === id).reduce((s, r) => s + r.points, 0) })).sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
    return { races: rows, teams: table('teamId'), drivers: table('driver'), constructors: table('constructor') };
}
export function bridgeManifest(event: CircuitEvent, part: CircuitPart) {
    const buses = ['PerformanceBus', 'VisualAssetBus', 'VoiceBus', 'MediaBus', 'AgentEnvironmentPort'].map(kind => ({ kind, status: 'interface-only', schema: 'circuit-port@1', sourceDigest: part.native.digest, publicProgramHash: hash(localProgram(event, part, part.native.records.length)), capabilities: kind === 'VoiceBus' ? ['synthetic-local-render'] : kind === 'AgentEnvironmentPort' ? ['bounded-public-observation', 'propose-legal-action'] : ['local-export'], externalConnection: false }));
    return freeze({ schema: 'circuit-bridges@1', eventId: event.id, partId: part.id, buses });
}
