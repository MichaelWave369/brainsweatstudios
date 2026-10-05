import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import v11Native from './fixtures/v11-native-receipts.json';
import { canonical, clone, freeze, hash, sha256 } from '../src/runtime/data';
import { freshCircuit, validateCircuit, verifyCircuitEvent } from '../src/circuit/evidence';
import { addCircuitSeason, importCircuitWorldPack, rememberCircuitEvent, reviewCircuitPerformance, revokeCircuitAssetGrant, shareCircuitAsset, starterCircuit, updateCircuitAgent, writeCircuitNote } from '../src/circuit/operations';
import { makeSeason, validateSeason } from '../src/circuit/specs';
import { CircuitSession } from '../src/circuit/session';
import { runCircuitBatch, runCircuitEvent, runCircuitSeason, validateCircuitBatch } from '../src/circuit/cli';
import { eventAssets } from '../src/circuit/assets';
import { generalizationMatrix, standings } from '../src/circuit/scoring';
import { bridgeManifest, circuitOperatorStatus, controllerAt, groupCircuitAssets, leagueTables, localProgram, replayCircuitPart } from '../src/circuit/presentation';
import { decodeCircuitStorage, encodeCircuitStorage } from '../src/circuit/storage';
import { portData, prepareCircuitPort, validatePortData } from '../src/circuit/ports';
import { familyConfig, validateFamilyConfig } from '../src/families/specs';
import { chooseFamilyAction, createFamilyEnvironment } from '../src/families/runtime';
import { FamilySession } from '../src/families/session';
import { verifyFamilyReceipt } from '../src/families/receipts';
import { WorldSession } from '../src/worlds/session';
import { mockAdapter } from '../src/agents/mock';
import { townPack } from '../src/worlds/townZero';
import { freshAcademy, validateAcademy } from '../src/training/models';
import type { CircuitSave } from '../src/circuit/types';

const setup = (length: 6 | 12 = 6, controller: 'baseline' | 'mock' = 'baseline') => addCircuitSeason(starterCircuit(freshCircuit(), controller), makeSeason(['comet', 'aurora'], length));
const rehash = <T extends { digest: string }>(raw: T): T => { const body = { ...raw } as Partial<T>; delete body.digest; return { ...raw, digest: hash(body) }; };
let complete: CircuitSave;
beforeAll(async () => { complete = await runCircuitSeason(setup(), 'first-circuit'); }, 60000);
describe('V12 Circuit evidence and scheduling', () => {
    it('two persistent teams finish all seven native families in a six-event season', () => {
        expect(complete.events).toHaveLength(6); expect(complete.events.every(e => e.ending === 'COMPLETE' && e.parts.every(p => p.native.result.success))).toBe(true);
        expect(new Set(complete.events.flatMap(e => e.parts.map(p => p.native.schema === 'world-episode@1' ? 'town-zero' : p.native.config.family))).size).toBe(7);
        const race = complete.events[1]; expect(race.parts.map(p => p.phase)).toEqual(['qualifying', 'qualifying', 'race']);
        expect(race.parts[2].native.initialControllers && Object.keys(race.parts[2].native.initialControllers)).toHaveLength(8);
        expect(leagueTables(complete.seasons[0], complete.events).drivers).toHaveLength(2);
        expect(standings(complete.seasons[0], complete.events).map(r => r.events)).toEqual([6, 6]);
        expect(complete.events[0].measures.comet.racing).toBeNull();
    });
    it('score, qualifying setup, route, research and choreography have retained native source hashes', () => {
        const race = complete.events[1].parts[2], cache = complete.events[2].parts[1], festival = complete.events[5];
        expect(race.admissions[0].assets.some(a => a.type === 'vehicle-setup' && a.sourcePart === 'part-1')).toBe(true);
        expect(cache.admissions[0].assets.some(a => a.type === 'cache-route')).toBe(true);
        expect(festival.parts[0].admissions[0].assets.some(a => a.type === 'music-score' && a.sourceEvent === complete.events[0].id)).toBe(true);
        const show = festival.parts[1]; expect(show.native.schema).toBe('family-episode@1');
        if (show.native.schema === 'family-episode@1') expect(show.native.result.measures.sourceReferences).toBe(2);
        expect(show.admissions[0].assets.map(a => a.type)).toEqual(expect.arrayContaining(['music-score', 'research-dossier', 'performance-plan']));
        expect(eventAssets(festival).every(a => a.sourceDigest && a.creator && a.contentHash === hash(a.content))).toBe(true);
    });
    it('a rehashed official score, seed, binding or input cannot replace replay evidence', () => {
        for (const change of ['score', 'seed', 'binding', 'input']) {
            const e = clone(complete.events[1]);
            if (change === 'score') e.measures.comet.racing = 100;
            if (change === 'seed') e.seedIndex = 1;
            if (change === 'binding') e.parts[2].bindings['driver-0'].agentId = 'aurora-one';
            if (change === 'input') e.parts[2].admissions[0].assets[0].contentHash = '0'.repeat(64);
            expect(() => verifyCircuitEvent(rehash(e), complete.seasons[0], complete)).toThrow();
        }
    });
    it('cached verified events still require their source evidence in a different context', () => {
        const stripped = { ...complete, events: complete.events.slice(1, 5) };
        expect(() => verifyCircuitEvent(complete.events[5], complete.seasons[0], stripped)).toThrow(/retained eligible|schedule/);
        expect(() => validateCircuit({ ...complete, events: [complete.events[1], complete.events[0]] })).toThrow(/schedule/);
        expect(() => validateCircuit({ ...complete, events: [...complete.events, complete.events[0]] })).toThrow(/twice/);
    });
    it('Town Zero performs and attributes 24 native role handoffs per seven-day team shift', async () => {
        const e = complete.events[3], p = e.parts[0]; expect(p.shifts).toHaveLength(24);
        expect(new Set(p.shifts.map(s => s.agentId))).toEqual(new Set(['comet-one', 'comet-two']));
        const native = p.native; if (native.schema !== 'world-episode@1') throw new Error('Missing native Town.');
        const fixed = new WorldSession(native.pack, native.worldId, native.masterSeed, native.initialControllers);
        while (!fixed.env.result().terminal) expect(await fixed.step()).not.toBeNull();
        const forged = clone(e); forged.parts[0].native = fixed.receipt(); forged.parts[0].shifts = [];
        expect(() => verifyCircuitEvent(rehash(forged), complete.seasons[0], complete)).toThrow(/rotation/);
    });
    it('stopped restoration uses native replay and resumes the same exact deterministic season event', async () => {
        const start = setup(), s = new CircuitSession(start, 'first-circuit', 'round-1'); s.resume();
        for (let i = 0; i < 5; i++) expect(await s.step()).toBe(true); s.stop();
        const saved = rememberCircuitEvent(start, s.receipt()), restored = new CircuitSession(saved, 'first-circuit', 'round-1'); expect(restored.status).toBe('STOPPED');
        expect(restored.fingerprint()).toBe(s.fingerprint());
        const end = await runCircuitEvent(saved, 'first-circuit', 'round-1'); expect(end.events[0].digest).toBe(complete.events[0].digest);
        const family = FamilySession.restore(complete.events[1].parts[2].native); expect(family.status).toBe('STOPPED'); expect(family.receipt().records).toEqual(complete.events[1].parts[2].native.records); expect(family.receipt().result).toEqual(complete.events[1].parts[2].native.result);
    });
    it('late mock proposals and overlapping turns cannot commit after pause', async () => {
        const mock = mockAdapter(), s = new CircuitSession(setup(6, 'mock'), 'first-circuit', 'round-1', 'CAREER', 0, { mock: { ...mock, async propose(r, signal) { await new Promise(resolve => setTimeout(resolve, 20)); return mock.propose(r, signal); } } });
        const before = s.fingerprint(); s.resume(); const turn = s.step(); await expect(s.step()).rejects.toThrow(); s.pause(); expect(await turn).toBe(false); expect(s.status).toBe('PAUSED'); expect(s.fingerprint()).toBe(before);
    });
    it('keeps frozen season controllers immutable while passport edits target future seasons', () => {
        const source = setup(), agent = source.agents[0], frozen = source.seasons[0].agents.find(a => a.id === agent.id)!;
        const changed = updateCircuitAgent(source, { ...agent, controller: { ...agent.controller, world: { ...agent.controller.world, family: 'model', provider: 'mock', model: 'mock-policy' } } });
        expect(changed.agents.find(a => a.id === agent.id)?.controller.world.provider).toBe('mock');
        expect(changed.seasons[0].agents.find(a => a.id === agent.id)?.controller.world).toEqual(frozen.controller.world);
    });
    it('reports controller provenance at the selected replay frame including Town handoffs', () => {
        const part = complete.events[3].parts[0], role = Object.keys(part.bindings)[0];
        expect(controllerAt(part, role, 0)).toEqual(part.native.initialControllers[role]);
        const shift = part.shifts.find(row => row.role === role);
        expect(shift).toBeDefined();
        expect(controllerAt(part, role, shift!.index)).toEqual(shift!.controller);
    });
    it('distinguishes event completion from season completion in operator status', () => {
        expect(circuitOperatorStatus('COMPLETE', true)).toBe('READY_FOR_NEXT');
        expect(circuitOperatorStatus('COMPLETE', false)).toBe('SEASON_COMPLETE');
        expect(circuitOperatorStatus('REQUESTING', true)).toBe('REQUESTING');
    });
    it('groups repeated artifact hashes into a receipt trail without rewriting evidence', () => {
        const asset = eventAssets(complete.events[0])[0];
        const duplicate = { ...clone(asset), id: 'duplicate-artifact', sourceEvent: 'event-copy', sourcePart: 'part-copy' };
        const grouped = groupCircuitAssets([asset, duplicate]);
        expect(grouped).toHaveLength(1);
        expect(grouped[0].occurrences).toBe(2);
        expect(grouped[0].sources.map(source => source.eventId)).toEqual([asset.sourceEvent, 'event-copy']);
        expect(asset.id).not.toBe(duplicate.id);
    });
    it('shared assets require explicit grants, semantic dedupe and explicit revocation', () => {
        const asset = eventAssets(complete.events[0])[0]; const shared = shareCircuitAsset(complete, asset.id, 'aurora'); expect(shared.grants[0].contentHash).toBe(asset.contentHash);
        expect(() => validateCircuit({ ...shared, events: [] })).toThrow();
        expect(() => shareCircuitAsset(complete, asset.id, 'comet')).toThrow();
        const sameContent = complete.events.flatMap(eventAssets).find(a => a.id !== asset.id && a.teamId === asset.teamId && a.contentHash === asset.contentHash);
        if (sameContent) expect(() => shareCircuitAsset(shared, sameContent.id, 'aurora')).toThrow(/already granted/);
        const revoked = revokeCircuitAssetGrant(shared, shared.grants[0].id);
        expect(revoked.grants).toHaveLength(0);
        expect(() => revokeCircuitAssetGrant(revoked, shared.grants[0].id)).toThrow(/retained exchange/);
        const spec = clone(makeSeason(['comet', 'aurora'], 6, 'GAUNTLET')); spec.rounds[0].artifacts = 'SHARED'; expect(() => validateSeason(spec)).toThrow(/gauntlet/);
    });
    it('declared team notes become immutable input snapshots without altering frozen rosters', async () => {
        const source = setup(), noted = writeCircuitNote(source, { id: 'team-note', teamId: 'comet', scope: 'TEAM', family: null, partition: 'CAREER', sourceEvent: null, text: 'Public rehearsal convention.' });
        const s = new CircuitSession(noted, 'first-circuit', 'round-1'); expect(s.receipt().parts[0].admissions.every(a => a.notes[0]?.text === 'Public rehearsal convention.')).toBe(true);
        expect(noted.seasons[0].digest).toBe(source.seasons[0].digest);
        expect(() => validateCircuit({ ...noted, notes: [{ ...noted.notes[0], partition: 'HOLDOUT' }] })).toThrow();
    });
    it('strict season and pack boundaries reject getters before invoking them', () => {
        let calls = 0; const hostile = Object.defineProperty({}, 'teamIds', { enumerable: true, get() { calls++; return ['comet']; } });
        expect(() => addCircuitSeason(setup(), hostile)).toThrow(); expect(() => importCircuitWorldPack(setup(), 'comet', 'comet-one', hostile)).toThrow(); expect(calls).toBe(0);
        const invalid = clone(makeSeason(['comet'])); invalid.rounds[0].seeds.HOLDOUT = [17]; expect(() => validateSeason(invalid)).toThrow();
        expect(() => validateSeason({ ...invalid, script: 'execute' })).toThrow();
        expect(importCircuitWorldPack(setup(), 'comet', 'comet-one', townPack()).operators).toHaveLength(1);
    });
    it('local presentation reads native public frames and exports interface-only bridges', () => {
        const event = complete.events[2], part = event.parts[0], opening = localProgram(event, part, 0);
        expect(JSON.stringify(opening.publicView)).not.toContain('seed'); expect(opening.publicView).toMatchObject({ state: { routeHints: [] } });
        expect(opening.publicView).toMatchObject({ state: { clue: null, puzzle: null } });
        expect(replayCircuitPart(part, part.native.records.length).result.success).toBe(true);
        expect(bridgeManifest(event, part).buses.every(b => b.externalConnection === false && b.status === 'interface-only')).toBe(true);
    });
    it('human listening reviews cannot change mechanical scores or official digests', () => {
        const next = reviewCircuitPerformance(complete, complete.events[0].id, 'part-1', 'I prefer a softer ending.');
        expect(next.events.map(e => e.digest)).toEqual(complete.events.map(e => e.digest)); expect(next.reviews[0].text).toContain('softer');
    });
    it('optional public presentation ports require exact acknowledgements and stop on rejection', async () => {
        const packet = portData('MediaBus', complete.events[2], complete.events[2].parts[0], 0);
        expect(JSON.stringify(packet.publicProgram.result)).not.toContain('mapHash');
        let stops = 0; const signal = new AbortController();
        const bus = { id: 'local-test-port', kind: 'MediaBus' as const, async prepare() { return { accepted: true as const, packetHash: '0'.repeat(64) }; }, stop() { stops++; } };
        await expect(prepareCircuitPort(bus, packet, signal.signal)).rejects.toThrow(/acknowledgement/); expect(stops).toBe(1);
        expect(() => validatePortData({ ...packet, script: 'execute' })).toThrow();
        const accepted = await prepareCircuitPort({ ...bus, async prepare(p) { return { accepted: true, packetHash: hash(p) }; } }, packet, signal.signal); expect(accepted.accepted).toBe(true);
        signal.abort(); await expect(prepareCircuitPort(bus, packet, signal.signal)).rejects.toThrow(/unavailable/);
    });
    it('public event verification rejects a forged source context rather than trusting typed input', () => {
        const forged = clone(complete); forged.events[0].measures.comet.creative = 0; forged.events[0] = rehash(forged.events[0]);
        expect(() => verifyCircuitEvent(complete.events[5], complete.seasons[0], forged)).toThrow(/standings/);
    });
    it('twelve events and lossless bounded local encoding preserve every native digest', async () => {
        const season = await runCircuitSeason(setup(12), 'first-circuit'), encoded = encodeCircuitStorage(season), decoded = decodeCircuitStorage(encoded);
        expect(season.events).toHaveLength(12); expect(decoded.events.map(e => e.digest)).toEqual(season.events.map(e => e.digest)); expect(JSON.stringify(encoded).length).toBeLessThan(1500000);
        expect(validateAcademy({ ...freshAcademy(), circuit: decoded }).circuit.events).toHaveLength(12);
        expect(() => decodeCircuitStorage({ schema: 'circuit-storage@1', data: '////' })).toThrow();
        expect(() => decodeCircuitStorage({ ...encoded, extra: true })).toThrow();
    }, 120000);
    it('old Academy files migrate with an empty Circuit while preserving the legacy size budget', () => {
        const old = { ...freshAcademy() } as Partial<ReturnType<typeof freshAcademy>>; delete old.circuit;
        expect(validateAcademy(old).circuit).toEqual(freshCircuit());
        expect(() => validateAcademy({ ...old, unknown: 'x'.repeat(3000001) })).toThrow();
    });
});
describe('versioned V12 native authority and frozen comparisons', () => {
    it('league roles, grid and pit windows are native and do not enter legacy schemas', () => {
        const config = familyConfig('auto-circuit', 17, 'league'), env = createFamilyEnvironment(config);
        expect(env.roles).toHaveLength(8); expect(env.observe('pit-0').legal).toEqual(['wait']);
        const state = env.stateHash(); expect(() => env.step(Object.fromEntries(env.roles.map(r => [r, r === 'pit-0' ? 'service-refuel' : 'wait'])))).toThrow(); expect(env.stateHash()).toBe(state);
        env.step(Object.fromEntries(env.roles.map(r => [r, chooseFamilyAction(env.observe(r))])));
        const cars = env.result().public.cars as { gridSlot: number; position: number }[]; expect(cars[0].position).toBeGreaterThan(cars[1].position);
        expect(() => validateFamilyConfig({ ...config, schema: 'family-config@1' })).toThrow();
        expect(() => validateFamilyConfig({ ...config, race: { ...config.race!, grid: ['car-0', 'car-0'] } })).toThrow();
    });
    it('limited Cache communication respects the declared native cadence', () => {
        const c = validateFamilyConfig({ ...familyConfig('cache-quest'), schema: 'family-config@3', cache: { communication: 'limited', signalEvery: 3 } }), env = createFamilyEnvironment(c);
        env.step({ explorer: 'inspect', navigator: 'wait' }); expect(env.observe('navigator').state.clue).toBeNull(); expect(env.observe('navigator').legal).not.toContain('share-route');
        env.step({ explorer: 'wait', navigator: 'wait' }); env.step({ explorer: 'wait', navigator: 'wait' }); expect(env.observe('navigator').legal).toContain('share-route');
        env.step({ explorer: 'wait', navigator: 'share-route' }); expect(env.observe('navigator').state.clue).not.toBeNull();
    });
    it('baseline and offline mock batches use disjoint frozen seeds and descriptive variance', async () => {
        const source = starterCircuit(freshCircuit(), 'mock'), spec = makeSeason(['comet'], 6, 'GAUNTLET'); const save = addCircuitSeason(source, spec);
        const batch = await runCircuitBatch(save, 'first-circuit'); expect(batch.trials).toHaveLength(18);
        expect(batch.trials.every(e => e.parts.every(p => p.admissions.every(a => a.notes.length === 0 && a.assets.length === 0)))).toBe(true);
        const matrix = generalizationMatrix(batch.season, batch.trials); expect(matrix).toHaveLength(6); expect(Object.values(matrix[0].partitions).every(p => p.count === 1 && p.variance === 0)).toBe(true);
        const changed = clone(batch); changed.trials[0].measures.comet.creative = 0; expect(() => validateCircuitBatch(rehash(changed))).toThrow();
        expect(validateCircuitBatch(batch).digest).toBe(batch.digest); expect(verifyFamilyReceipt(batch.trials[0].parts[0].native).result.success).toBe(true);
    }, 90000);
});

describe('immutable V11 native compatibility', () => {
    it('immutable hash reuse preserves canonical bytes and never trusts a shallow freeze or accessor', () => {
        const data = freeze({ z: [{ role: 'driver', signals: ['ready', 'pit'] }], a: 'original' });
        const bytes = '{"a":"original","z":[{"role":"driver","signals":["ready","pit"]}]}';
        expect(canonical(data)).toBe(bytes); expect(hash(data)).toBe(sha256(bytes)); expect(hash(data)).toBe(sha256(bytes));
        const mutable = { score: 1 }, shallow = Object.freeze({ values: Object.freeze([mutable]) }), first = hash(shallow);
        mutable.score = 2; expect(hash(shallow)).not.toBe(first);
        let score = 1;
        const accessor = Object.freeze(Object.defineProperty({}, 'score', { enumerable: true, get: () => score }));
        const prior = hash(accessor); score = 2; expect(hash(accessor)).not.toBe(prior);
        for (const prefix of ['a'.repeat(8192), 'ñ'.repeat(8191) + '🎵', 'x'.repeat(8191) + '🎵']) {
            for (const suffix of ['first', 'second', 'second changed', '🎶']) {
                const text = prefix + suffix + 'z'.repeat(8192);
                expect(sha256(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
            }
        }
        const env = createFamilyEnvironment(familyConfig('cache-quest')), before = env.observe('explorer'), result = env.result();
        expect(env.observe('explorer')).toBe(before); expect(env.result()).toBe(result); expect(Object.isFrozen(before.state)).toBe(true);
        env.step({ explorer: 'inspect', navigator: 'wait' });
        expect(env.observe('explorer')).not.toBe(before); expect(env.result()).not.toBe(result); expect(before.tick).toBe(0); expect(env.observe('explorer').tick).toBe(1);
    });
    for (const fixture of v11Native.cases) it(`replays the merged V11 ${fixture.family} authority without rewriting its digest`, async () => {
        expect(v11Native.sourceCommit).toBe('14f50dd88fe5a46257b846ac512c28b13a89c01b');
        const receipt = verifyFamilyReceipt(fixture.receipt), session = new FamilySession(receipt.config, receipt.initialControllers, receipt.inputs);
        while (!session.env.result().terminal) expect(await session.step()).toBe(true);
        expect(session.receipt().digest).toBe(fixture.receipt.digest);
    });
});
