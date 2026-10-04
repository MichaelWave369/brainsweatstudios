import { describe, expect, it } from 'vitest';
import { controllerSpec } from '../src/agents/contracts';
import { clone, hash } from '../src/runtime/data';
import { baselineController } from '../src/worlds/receipts';
import { addAgent, evaluationInput, exportPassport, handoffRecord, portfolio, rememberRun, retainPlan, updatePassport, writeNote } from '../src/career/operations';
import { createCareerSession } from '../src/career/session';
import { createPassport, freshCareer, inputHash, runDigest, validateCareer, validateEvaluation, validatePassport, verifyCareerRun } from '../src/career/validation';
import type { CareerSave, PublicNote } from '../src/career/types';
import { freshAcademy, validateAcademy } from '../src/training/models';
import { careerCommand } from '../src/career/cli';
const locker = () => addAgent(freshCareer(), 'iris', 'Iris');
const note = (overrides: Partial<PublicNote> = {}): PublicNote => ({ id: 'public-reserve', scope: 'CAREER', worldId: null, episode: null, sourceRun: null, partition: 'CAREER', text: 'Preserve a public reserve.', ...overrides });
async function run(save: CareerSave, world = 'reserve-lesson', episode = 'test-one', condition: 'FRESH' | 'FROZEN' | 'PRIOR' = 'FRESH') {
    const input = evaluationInput(save, 'iris', world, episode, 'CAREER', condition), session = createCareerSession(save.agents[0], world, input, save);
    while (!session.result().terminal)
        expect(await session.step()).toBe(true);
    return session.receipt();
}
describe('operational passports and verified evidence', () => {
    it('keeps V6/V7/V8 Academy forms migratable without replacing their records', () => {
        const current = freshAcademy();
        const legacy = clone(current) as Partial<typeof current>;
        delete legacy.career;
        expect(validateAcademy(legacy).career).toEqual(freshCareer());
        expect(validateAcademy({ controllers: {}, rover: current.rover }).garage).toEqual(current.garage);
        expect(validateAcademy(current)).toEqual(current);
    });
    it('validates passport data, exact keys, bounds and finite controller fields', () => {
        const p = createPassport('iris', 'Iris');
        expect(validatePassport(p).id).toBe('iris');
        expect(() => validatePassport({ ...p, iq: 180 })).toThrow();
        expect(() => validatePassport({ ...p, displayName: 'a'.repeat(65) })).toThrow();
        expect(() => validatePassport({ ...p, controller: { ...p.controller, world: { ...p.controller.world, temperature: NaN } } })).toThrow();
        expect(() => validatePassport({ ...p, licenses: ['unearned'] })).toThrow();
    });
    it('rejects getters before reading data, prototypes, executable values and deep structures', () => {
        let called = false;
        const p = { ...createPassport('iris', 'Iris') };
        Object.defineProperty(p, 'displayName', { enumerable: true, get() { called = true; return 'x'; } });
        expect(() => validatePassport(p)).toThrow();
        expect(called).toBe(false);
        expect(() => validateCareer(Object.create(locker()))).toThrow();
        expect(() => validateCareer({ ...locker(), execute: () => 0 })).toThrow();
    });
    it('records the same identity with baseline and mock controllers and two real families', async () => {
        let save = locker();
        save = rememberRun(save, await run(save));
        const p = save.agents[0];
        save = updatePassport(save, { ...p, controller: { world: { ...baselineController('mock-controller'), family: 'model', provider: 'mock', model: 'mock-policy' }, garage: controllerSpec('model') } });
        save = rememberRun(save, await run(save, 'survey', 'test-two'));
        expect(save.agents[0].id).toBe('iris');
        expect(save.runs.map(r => r.controller.family)).toEqual(['baseline', 'model']);
        expect(portfolio(save, 'iris').map(r => r.family)).toEqual(['infrastructure', 'navigation']);
        expect(validateCareer(JSON.parse(JSON.stringify(exportPassport(save, 'iris'))))).toEqual(save);
    });
    it('requires native receipt replay and correct actor, family and controller attribution', async () => {
        const receipt = await run(locker());
        const tamper = clone(receipt);
        tamper.receipt.result.terminal = false;
        expect(() => verifyCareerRun(tamper)).toThrow();
        for (const update of [{ actor: 'outsider' }, { family: 'navigation' }, { controller: baselineController('wrong') }, { agentId: 'other', digest: '0'.repeat(64) }])
            expect(() => verifyCareerRun({ ...receipt, ...update })).toThrow();
        expect(Object.isFrozen(verifyCareerRun(receipt))).toBe(true);
    });
    it('rejects unsupported badges, portfolio/role claims and missing creation proof', async () => {
        const save = rememberRun(locker(), await run(locker()));
        const raw = clone(save);
        raw.agents[0].performanceEvidence = ['0'.repeat(64)];
        expect(() => validateCareer(raw)).toThrow();
        raw.agents[0].performanceEvidence = save.agents[0].performanceEvidence;
        raw.agents[0].roleHistory = [];
        expect(() => validateCareer(raw)).toThrow();
        expect(() => validateCareer({ ...save, runs: [] })).toThrow();
    });
    it('bounds per-agent public notes and does not persist connections or provider credentials', () => {
        let save = locker();
        for (let i = 0; i < 12; i++)
            save = writeNote(save, 'iris', note({ id: `note-${i}` }));
        expect(save.notes.iris).toHaveLength(12);
        expect(() => writeNote(save, 'iris', note({ id: 'too-many' }))).toThrow();
        expect(() => validatePassport({ ...save.agents[0], token: 'secret' })).toThrow();
        expect(() => createCareerSession({ ...save.agents[0], controller: { ...save.agents[0].controller, world: { ...baselineController(), family: 'model', provider: 'ollama' } } }, 'reserve-lesson', evaluationInput(save, 'iris', 'reserve-lesson', 'offline'))).toThrow(/explicitly/);
    });
});
describe('memory firewall and artifact admission', () => {
    it('serializes proposals so overlapping host calls cannot advance the world twice',async()=>{
        const save=locker(),session=createCareerSession(save.agents[0],'reserve-lesson',evaluationInput(save,'iris','reserve-lesson','exclusive'));
        const pending=session.step();await expect(session.step()).rejects.toThrow(/current intent/);await pending;expect(session.result().terminal).toBe(false);expect(session.receipt().receipt.schema==='world-episode@1'&&session.receipt().receipt.records.length).toBe(1);
    });

    it('retains creation proof while the same episode continues and counts episodes once', async () => {
        let save = locker();
        const session = createCareerSession(save.agents[0], 'reserve-lesson', evaluationInput(save, 'iris', 'reserve-lesson', 'continuing'));
        await session.step();
        session.recordPlan();
        const origin = session.receipt();
        save = retainPlan(rememberRun(save, origin), origin.digest, 'plan', ['town-zero']);
        await session.step();
        save = rememberRun(save, session.receipt());
        expect(save.artifacts).toHaveLength(1);
        expect(save.runs).toHaveLength(2);
        expect(portfolio(save, 'iris')[0].runs).toBe(1);
        expect(validateCareer(JSON.parse(JSON.stringify(save)))).toEqual(save);
    });
    it('continues a paused V7 snapshot without resetting identity or stopping the native session permanently', async () => {
        const save = locker(), input = evaluationInput(save, 'iris', 'survey', 'partial'), session = createCareerSession(save.agents[0], 'survey', input);
        await session.step();
        expect(session.receipt().receipt.result.terminal).toBe(false);
        await session.step();
        const second = session.receipt();
        expect(second.receipt.schema === 'model-episode@1' && second.receipt.result.ticks).toBe(2);
        expect(second.agentId).toBe('iris');
    });
    it('rejects wrong world/episode scopes before any controller executes', () => {
        const save = writeNote(locker(), 'iris', note({ scope: 'WORLD', worldId: 'town-zero' }));
        const permitted = evaluationInput(save, 'iris', 'town-zero', 'one', 'CAREER', 'PRIOR');
        expect(() => createCareerSession(save.agents[0], 'reserve-lesson', permitted, save)).toThrow(/before execution/);
        const old = writeNote(locker(), 'iris', note({ scope: 'EPISODE', worldId: 'reserve-lesson', episode: 'one' }));
        const admitted = evaluationInput(old, 'iris', 'reserve-lesson', 'one', 'CAREER', 'FROZEN');
        const { snapshotHash: _hash, ...value } = { ...admitted, episode: 'two' };
        void _hash;
        expect(() => createCareerSession(old.agents[0], 'reserve-lesson', { ...value, snapshotHash: inputHash(value) }, old)).toThrow(/before execution/);
    });
    it('defaults benchmark inputs to fresh and declares the partition', () => {
        const save = writeNote(locker(), 'iris', note());
        const input = evaluationInput(save, 'iris', 'reserve-lesson', 'benchmark', 'HOLDOUT');
        expect(input.notes).toEqual([]);
        expect(input.artifacts).toEqual([]);
        expect(input.condition).toBe('FRESH');
        expect(input.mode).toBe('BENCHMARK');
    });
    it('enforces episode/world/career scopes and excludes holdout/transfer notes', () => {
        let save = locker();
        for (const n of [note(), note({ id: 'world', scope: 'WORLD', worldId: 'town-zero' }), note({ id: 'episode', scope: 'EPISODE', worldId: 'reserve-lesson', episode: 'one' }), note({ id: 'holdout', partition: 'HOLDOUT' }), note({ id: 'transfer', partition: 'TRANSFER' })])
            save = writeNote(save, 'iris', n);
        expect(evaluationInput(save, 'iris', 'reserve-lesson', 'two', 'TRAIN', 'PRIOR').notes.map(n => n.id)).toEqual(['public-reserve']);
        expect(evaluationInput(save, 'iris', 'reserve-lesson', 'one', 'TRAIN', 'PRIOR').notes.map(n => n.id)).toEqual(['public-reserve', 'episode']);
    });
    it('freezes a snapshot independently of later operator memory edits', () => {
        const save = writeNote(locker(), 'iris', note()), input = evaluationInput(save, 'iris', 'reserve-lesson', 'one', 'TRAIN', 'FROZEN');
        const edited = writeNote(save, 'iris', note({ text: 'Changed public note.' }));
        expect(input.notes[0].text).toBe('Preserve a public reserve.');
        expect(evaluationInput(edited, 'iris', 'reserve-lesson', 'one', 'TRAIN', 'FROZEN').snapshotHash).not.toBe(input.snapshotHash);
        expect(Object.isFrozen(input.notes)).toBe(true);
        expect(() => validateEvaluation({ ...input, snapshotHash: '0'.repeat(64) })).toThrow();
    });
    it('rejects disguised fresh memory and does not allow V7 prior inputs', () => {
        const save = writeNote(locker(), 'iris', note()), input = evaluationInput(save, 'iris', 'reserve-lesson', 'one', 'CAREER', 'PRIOR');
        const { snapshotHash: _hash, ...fresh } = { ...input, condition: 'FRESH' as const };
        void _hash;
        expect(() => validateEvaluation({ ...fresh, snapshotHash: inputHash(fresh) })).toThrow();
        const prior = evaluationInput(save, 'iris', 'survey', 'one', 'CAREER', 'PRIOR');
        expect(() => createCareerSession(save.agents[0], 'survey', prior)).toThrow(/fresh/);
    });
    it('proves initial admitted notes with native public memory artifacts', async () => {
        const save = writeNote(locker(), 'iris', note()), receipt = await run(save, 'reserve-lesson', 'with-notes', 'PRIOR');
        expect(receipt.receipt.schema === 'world-episode@1' && receipt.receipt.artifacts[0].kind).toBe('memory');
        const raw = clone(receipt);
        raw.evaluation.notes[0].text = 'Different context.';
        const { snapshotHash: _h, ...snapshot } = raw.evaluation;
        void _h;
        raw.evaluation.snapshotHash = inputHash(snapshot);
        const { digest: _d, ...value } = raw;
        void _d;
        raw.digest = runDigest(value);
        expect(() => verifyCareerRun(raw)).toThrow(/memory differs/);
    });
    it('does not turn hidden world values into automatic notes', async () => {
        const save = locker(), session = createCareerSession(save.agents[0], 'reserve-lesson', evaluationInput(save, 'iris', 'reserve-lesson', 'hidden'));
        const view = session.observation();
        expect('resources' in view && view.resources.water).toBe('UNKNOWN');
        await session.step();
        const next = rememberRun(save, session.receipt());
        expect(next.notes.iris).toEqual([]);
        expect(next.agents[0].publicCapabilities).toEqual(['public-notes', 'world-plan']);
    });
    it('retains a recorded plan with content hash/creator proof and admits it only to declared worlds', async () => {
        let save = locker();
        const input = evaluationInput(save, 'iris', 'reserve-lesson', 'origin'), session = createCareerSession(save.agents[0], 'reserve-lesson', input);
        await session.step();
        session.recordPlan();
        const receipt = session.receipt();
        save = rememberRun(save, receipt);
        save = retainPlan(save, receipt.digest, 'reserve-plan', ['town-zero']);
        const artifact = save.artifacts[0];
        expect(artifact.contentHash).toBe(hash(artifact.content));
        expect(save.agents[0].inventory).toEqual(['reserve-plan']);
        const toTown = evaluationInput(save, 'iris', 'town-zero', 'town', 'CAREER', 'PRIOR');
        expect(toTown.artifacts).toHaveLength(1);
        const toLesson = evaluationInput(save, 'iris', 'reserve-lesson', 'lesson', 'CAREER', 'PRIOR');
        expect(toLesson.artifacts).toHaveLength(0);
        const admission = handoffRecord(save, 'iris', 'reserve-lesson', 'town-zero', toTown);
        expect(admission.accepted).toEqual(['reserve-plan']);
        expect(() => createCareerSession(save.agents[0], 'town-zero', toTown)).toThrow(/verified Locker/);
        const native = createCareerSession(save.agents[0], 'town-zero', toTown, save);
        await native.step();
        const carried = native.receipt();
        expect('context' in carried.controller && carried.controller.context).toBe('BOUNDED_NOTEBOOK');
        expect(carried.receipt.schema === 'world-episode@1' && carried.receipt.artifacts.some(a => a.kind === 'memory' && 'plans' in a.value && a.value.plans.length > 0)).toBe(true);
        save = rememberRun(save, carried, admission);
        expect(validateCareer(JSON.parse(JSON.stringify(save)))).toEqual(save);
    });
    it('rejects forged artifact provenance and executable or altered content', async () => {
        let save = locker();
        const s = createCareerSession(save.agents[0], 'reserve-lesson', evaluationInput(save, 'iris', 'reserve-lesson', 'origin'));
        await s.step();
        s.recordPlan();
        const r = s.receipt();
        save = retainPlan(rememberRun(save, r), r.digest, 'plan', ['town-zero']);
        const raw = clone(save);
        raw.artifacts[0].creationRun = '0'.repeat(64);
        expect(() => validateCareer(raw)).toThrow();
        raw.artifacts[0] = clone(save.artifacts[0]);
        raw.artifacts[0].content.goal = 'Forged';
        expect(() => validateCareer(raw)).toThrow();
        expect(() => validateCareer({ ...save, artifacts: [{ ...save.artifacts[0], code: 'eval()' }] })).toThrow();
    });
    it('rejects source notes mislabeled as career when recorded in holdout', async () => {
        const save = locker(), input = evaluationInput(save, 'iris', 'reserve-lesson', 'holdout', 'HOLDOUT');
        const s = createCareerSession(save.agents[0], 'reserve-lesson', input);
        await s.step();
        const r = s.receipt(), next = rememberRun(save, r);
        expect(() => writeNote(next, 'iris', note({ sourceRun: r.digest, partition: 'CAREER' }))).toThrow();
        const held = writeNote(next, 'iris', note({ sourceRun: r.digest, partition: 'HOLDOUT' }));
        expect(evaluationInput(held, 'iris', 'reserve-lesson', 'new', 'CAREER', 'PRIOR').notes).toEqual([]);
    });
    it('keeps bounded recent evidence with references synchronized', async () => {
        let save = locker();
        for (let i = 0; i < 10; i++)
            save = rememberRun(save, await run(save, 'reserve-lesson', `episode-${i}`));
        expect(save.runs).toHaveLength(8);
        expect(save.agents[0].performanceEvidence).toHaveLength(8);
        expect(validateCareer(save)).toEqual(save);
    });
    it('uses the browser host for headless list/show/run and replay verification', async () => {
        expect(await careerCommand('list', [])).toEqual([{ id: 'studio-agent', name: 'Studio agent', controller: 'baseline', evidence: 0 }]);
        const save = await careerCommand('run', ['reserve-lesson']) as CareerSave;
        expect(save.runs[0].receipt.result.terminal).toBe(true);
        expect(await careerCommand('verify', [], JSON.stringify(save))).toEqual([{ digest: save.runs[0].digest, replayed: true }]);
    });
});
