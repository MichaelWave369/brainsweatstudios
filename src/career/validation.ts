import { controllerSpec, validateController } from '../agents/contracts.ts';
import { verifyAgentReceipt } from '../agents/receipts.ts';
import { clone, exact, freeze, hash, plain } from '../runtime/data.ts';
import { assertData, dataBytes } from '../worlds/compiler.ts';
import { baselineController, freshMemory, validatePlan, validateWorldController, verifyWorldReceipt } from '../worlds/receipts.ts';
import { CAREER_LIMITS, type AgentPassport, type CareerRun, type CareerSave, type EvaluationInput, type PortableArtifact, type PublicNote, type WorldHandoffRecord } from './types.ts';
export const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(v);
export const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown, n = 160): v is string => typeof v === 'string' && v.length <= n && !Array.from(v).some(c => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)));
export const ids = (v: unknown, n: number): v is string[] => Array.isArray(v) && v.length <= n && v.every(identifier) && new Set(v).size === v.length;
export function demand(ok: unknown, message: string): asserts ok {
    if (!ok)
        throw new Error(message);
}
export const freshCareer = (): CareerSave => ({ schema: 'agent-locker@1', agents: [], notes: {}, runs: [], artifacts: [], handoffs: [] });
export function createPassport(id: string, displayName: string): AgentPassport {
    return validatePassport({ schema: 'agent-passport@1', id, displayName, createdLocally: true,
        controller: { world: baselineController('career-controller'), garage: controllerSpec('reference') },
        publicCapabilities: ['public-notes', 'world-plan'], compatibleWorlds: ['town-zero', 'reserve-lesson', 'survey', 'community', 'signal-maze'],
        memoryMode: 'PUBLIC_SCOPED', inventory: [], performanceEvidence: [], teams: [], roleHistory: [], licenses: [], vehicleRef: null, voiceRef: null, mediaRefs: [] });
}
export function validatePassport(input: unknown): AgentPassport {
    assertData(input, 30000, 1500, 12);
    demand(plain(input) && exact(input, ['schema', 'id', 'displayName', 'createdLocally', 'controller', 'publicCapabilities', 'compatibleWorlds', 'memoryMode', 'inventory', 'performanceEvidence', 'teams', 'roleHistory', 'licenses', 'vehicleRef', 'voiceRef', 'mediaRefs']) && input.schema === 'agent-passport@1' && identifier(input.id) && text(input.displayName, 64) && input.displayName.trim().length > 0 && typeof input.createdLocally === 'boolean' && plain(input.controller) && exact(input.controller, ['world', 'garage']) && ids(input.publicCapabilities, 2) && input.publicCapabilities.every(c => ['public-notes', 'world-plan'].includes(c)) && ids(input.compatibleWorlds, 16) && input.memoryMode === 'PUBLIC_SCOPED' && ids(input.inventory, 24) && Array.isArray(input.performanceEvidence) && input.performanceEvidence.length <= 8 && input.performanceEvidence.every(digest) && new Set(input.performanceEvidence).size === input.performanceEvidence.length && ids(input.teams, 8) && Array.isArray(input.roleHistory) && input.roleHistory.length <= 8 && input.roleHistory.every(r => plain(r) && exact(r, ['runId', 'worldId', 'role']) && digest(r.runId) && identifier(r.worldId) && identifier(r.role)) && Array.isArray(input.licenses) && input.licenses.length === 0 && input.vehicleRef === null && input.voiceRef === null && Array.isArray(input.mediaRefs) && input.mediaRefs.length === 0, 'Invalid operational passport.');
    const controller = { world: validateWorldController(input.controller.world), garage: validateController(input.controller.garage) };
    return freeze({ ...clone(input), controller }) as unknown as AgentPassport;
}
export function validateNote(input: unknown): PublicNote {
    assertData(input, 1000, 30, 3);
    demand(plain(input) && exact(input, ['id', 'scope', 'worldId', 'episode', 'sourceRun', 'partition', 'text']) && identifier(input.id) && ['EPISODE', 'WORLD', 'CAREER'].includes(String(input.scope)) && (input.worldId === null || identifier(input.worldId)) && (input.episode === null || identifier(input.episode)) && (input.sourceRun === null || digest(input.sourceRun)) && ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].includes(String(input.partition)) && text(input.text, 120) && input.text.trim().length > 0, 'Invalid bounded public note.');
    demand(input.scope === 'CAREER' ? input.worldId === null && input.episode === null : input.scope === 'WORLD' ? identifier(input.worldId) && input.episode === null : identifier(input.worldId) && identifier(input.episode), 'Memory scope needs its explicit world/episode.');
    return freeze(clone(input)) as unknown as PublicNote;
}
export function validateArtifact(input: unknown): PortableArtifact {
    assertData(input, 8000, 300, 8);
    demand(plain(input) && exact(input, ['schema', 'id', 'type', 'version', 'creator', 'creationRun', 'contentHash', 'compatibleWorlds', 'content', 'bytes']) && input.schema === 'career-artifact@1' && identifier(input.id) && input.type === 'world-plan' && input.version === '1.0.0' && identifier(input.creator) && digest(input.creationRun) && digest(input.contentHash) && ids(input.compatibleWorlds, 16), 'Invalid data-only artifact.');
    const content = validatePlan(input.content);
    demand(input.contentHash === hash(content) && input.bytes === dataBytes(content), 'Artifact content hash or size differs.');
    return freeze({ ...clone(input), content }) as unknown as PortableArtifact;
}
export function inputHash(input: Omit<EvaluationInput, 'snapshotHash'>) { return hash(input); }
export function validateEvaluation(input: unknown): EvaluationInput {
    assertData(input, 40000, 2000, 12);
    demand(plain(input) && exact(input, ['mode', 'partition', 'condition', 'episode', 'notes', 'artifacts', 'snapshotHash']) && ['CAREER', 'BENCHMARK'].includes(String(input.mode)) && ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].includes(String(input.partition)) && ['FRESH', 'FROZEN', 'PRIOR'].includes(String(input.condition)) && identifier(input.episode) && Array.isArray(input.notes) && input.notes.length <= 12 && Array.isArray(input.artifacts) && input.artifacts.length <= 4, 'Invalid explicit memory condition.');
    demand((input.mode === 'CAREER') === (input.partition === 'CAREER'), 'Benchmark partition must be declared.');
    const notes = input.notes.map(validateNote), artifacts = input.artifacts.map(validateArtifact);
    demand(new Set(notes.map(n => n.id)).size === notes.length && new Set(artifacts.map(a => a.id)).size === artifacts.length, 'Repeated evaluation input.');
    demand(input.condition !== 'FRESH' || notes.length === 0 && artifacts.length === 0, 'Fresh evaluation cannot carry prior memory or artifacts.');
    demand(notes.every(n => n.partition === 'CAREER' || n.partition === 'TRAIN'), 'Holdout/transfer notes cannot become controller context.');
    const value = { mode: input.mode, partition: input.partition, condition: input.condition, episode: input.episode, notes, artifacts } as Omit<EvaluationInput, 'snapshotHash'>;
    demand(input.snapshotHash === inputHash(value), 'Frozen memory snapshot differs.');
    return freeze({ ...value, snapshotHash: input.snapshotHash }) as EvaluationInput;
}
export function publicWorldMemory(input: EvaluationInput) {
    return { ...freshMemory(), facts: input.notes.map(n => n.text), plans: input.artifacts.flatMap(a => [a.content.goal, ...a.content.steps, ...a.content.fallbacks]).slice(0, 6) };
}
const verifiedRuns = new WeakSet<object>();
export const runDigest = (r: Omit<CareerRun, 'digest'>) => hash(r);
export function verifyCareerRun(input: unknown): CareerRun {
    if (plain(input) && verifiedRuns.has(input))
        return input as unknown as CareerRun;
    assertData(input, CAREER_LIMITS.bytes, 350000, 30);
    demand(plain(input) && exact(input, ['schema', 'agentId', 'actor', 'worldId', 'family', 'controller', 'evaluation', 'receipt', 'digest']) && input.schema === 'career-run@1' && identifier(input.agentId) && identifier(input.actor) && identifier(input.worldId) && plain(input.receipt), 'Invalid career evidence envelope.');
    const evaluation = validateEvaluation(input.evaluation);
    const receipt = input.receipt.schema === 'world-episode@1' ? verifyWorldReceipt(input.receipt) : verifyAgentReceipt(input.receipt);
    const isWorld = receipt.schema === 'world-episode@1';
    const worldId = isWorld ? receipt.worldId : receipt.config.world;
    const family = isWorld ? 'infrastructure' : worldId === 'community' ? 'cooperation' : ['survey', 'signal-maze', 'rover'].includes(worldId) ? 'navigation' : 'arena';
    const controller = isWorld ? validateWorldController(input.controller) : validateController(input.controller);
    demand(input.worldId === worldId && input.family === family && hash(controller) === hash(receipt.initialControllers[input.actor]), 'Agent actor/controller attribution differs from the native receipt.');
    demand(evaluation.notes.every(n => n.scope === 'CAREER' || n.worldId === worldId && (n.scope !== 'EPISODE' || n.episode === evaluation.episode)), 'Memory crossed its declared scope.');
    demand(evaluation.artifacts.every(a => a.creator === input.agentId && a.compatibleWorlds.includes(worldId)), 'Artifact is incompatible with this agent/world.');
    if (!isWorld)
        demand(evaluation.condition === 'FRESH', 'V7 adapter accepts fresh career context only.');
    else {
        // Exactly these initial public inputs must appear before any native decision.
        const initial = receipt.artifacts.filter(a => a.actor === input.actor && a.index === 0);
        const memory = publicWorldMemory(evaluation), hasMemory = evaluation.notes.length > 0 || evaluation.artifacts.length > 0;
        demand(initial.filter(a => a.kind === 'memory').length === (hasMemory ? 1 : 0), 'Initial memory evidence differs.');
        if (hasMemory)
            demand(hash(initial.find(a => a.kind === 'memory')!.value) === hash(memory), 'Initial public memory differs.');
        demand(initial.filter(a => a.kind === 'plan').length === evaluation.artifacts.length, 'Initial artifact evidence differs.');
        evaluation.artifacts.forEach((a, i) => demand(hash(initial.filter(n => n.kind === 'plan')[i].value) === a.contentHash, 'Admitted plan differs.'));
    }
    const value = { schema: 'career-run@1', agentId: input.agentId, actor: input.actor, worldId, family, controller, evaluation, receipt } as Omit<CareerRun, 'digest'>;
    demand(input.digest === runDigest(value), 'Career receipt digest differs.');
    const verified = freeze({ ...value, digest: input.digest }) as CareerRun;
    verifiedRuns.add(verified);
    return verified;
}
export function validateHandoff(input: unknown): WorldHandoffRecord {
    assertData(input, 12000, 1000, 6);
    demand(plain(input) && exact(input, ['schema', 'agentId', 'source', 'destination', 'memory', 'accepted', 'rejected', 'acceptedCapabilities', 'rejectedCapabilities', 'input', 'snapshotHash']) && input.schema === 'career-handoff@1' && identifier(input.agentId) && identifier(input.source) && identifier(input.destination) && ids(input.memory, 12) && ids(input.accepted, 4) && Array.isArray(input.rejected) && input.rejected.length <= 24 && input.rejected.every(r => plain(r) && exact(r, ['id', 'reason']) && identifier(r.id) && text(r.reason, 120)) && ids(input.acceptedCapabilities, 2) && ids(input.rejectedCapabilities, 2) && digest(input.snapshotHash), 'Invalid cross-world handoff.');
    const admitted = validateEvaluation(input.input);
    demand(input.snapshotHash === admitted.snapshotHash && hash(input.memory) === hash(admitted.notes.map(n => n.id)) && hash(input.accepted) === hash(admitted.artifacts.map(a => a.id)) && admitted.artifacts.every(a => a.creator === input.agentId && a.compatibleWorlds.includes(input.destination as string)) && admitted.notes.every(n => n.scope === 'CAREER' || n.worldId === input.destination && (n.scope !== 'EPISODE' || n.episode === admitted.episode)), 'Handoff admission differs from its public snapshot.');
    const supported = ['town-zero', 'reserve-lesson'].includes(input.destination as string) ? ['public-notes', 'world-plan'] : [];
    demand((input.acceptedCapabilities as string[]).every(c => supported.includes(c)) && (input.rejectedCapabilities as string[]).every(c => !supported.includes(c)), 'Destination capability admission differs.');
    return freeze({ ...clone(input), input: admitted }) as unknown as WorldHandoffRecord;
}
export function validateCareer(input: unknown): CareerSave {
    if (input === undefined)
        return freshCareer();
    assertData(input, CAREER_LIMITS.bytes, 400000, 32);
    demand(plain(input) && exact(input, ['schema', 'agents', 'notes', 'runs', 'artifacts', 'handoffs']) && input.schema === 'agent-locker@1' && Array.isArray(input.agents) && input.agents.length <= CAREER_LIMITS.agents && plain(input.notes) && Array.isArray(input.runs) && input.runs.length <= CAREER_LIMITS.runs && Array.isArray(input.artifacts) && input.artifacts.length <= CAREER_LIMITS.artifacts && Array.isArray(input.handoffs) && input.handoffs.length <= CAREER_LIMITS.handoffs, 'Invalid bounded Agent Locker.');
    const agents = input.agents.map(validatePassport), runs = input.runs.map(verifyCareerRun), artifacts = input.artifacts.map(validateArtifact), handoffs = input.handoffs.map(validateHandoff);
    demand(new Set(agents.map(a => a.id)).size === agents.length && new Set(runs.map(r => r.digest)).size === runs.length && new Set(artifacts.map(a => a.id)).size === artifacts.length, 'Repeated career identity/evidence/artifact.');
    const noteLists = input.notes as Record<string, unknown>;
    demand(Object.keys(noteLists).length === agents.length && agents.every(a => Array.isArray(noteLists[a.id]) && (noteLists[a.id] as unknown[]).length <= 12), 'Every passport needs its bounded public note list.');
    const notes = Object.fromEntries(agents.map(a => [a.id, (noteLists[a.id] as unknown[]).map(validateNote)]));
    const agentById = new Map(agents.map(a => [a.id, a])), runById = new Map(runs.map(r => [r.digest, r]));
    runs.forEach(r => {
        demand(agentById.has(r.agentId), 'Evidence agent is absent.');
        r.evaluation.notes.forEach(n => {
            if (n.sourceRun) {
                const source = runById.get(n.sourceRun);
                demand(source && source.agentId === r.agentId && source.evaluation.partition === n.partition, 'Admitted memory source/partition differs.');
            }
        });
    });
    runs.forEach(r => r.evaluation.artifacts.forEach(a => { const origin = runById.get(a.creationRun); demand(origin && origin.agentId === a.creator && ['CAREER', 'TRAIN'].includes(origin.evaluation.partition) && origin.receipt.schema === 'world-episode@1' && origin.receipt.artifacts.some(p => p.actor === origin.actor && p.kind === 'plan' && hash(p.value) === a.contentHash), 'Admitted artifact lacks eligible provenance.'); }));
    artifacts.forEach(a => { const origin = runById.get(a.creationRun); demand(origin && origin.agentId === a.creator && origin.receipt.schema === 'world-episode@1' && origin.receipt.artifacts.some(p => p.actor === origin.actor && p.kind === 'plan' && hash(p.value) === a.contentHash), 'Artifact lacks verified creator/creation evidence.'); demand(origin.evaluation.partition === 'CAREER' || origin.evaluation.partition === 'TRAIN', 'Holdout artifacts cannot enter a career inventory.'); });
    for (const a of agents) {
        demand(hash(a.performanceEvidence) === hash(runs.filter(r => r.agentId === a.id).map(r => r.digest)), 'Portfolio references differ from verified receipts.');
        demand(hash(a.roleHistory) === hash(runs.filter(r => r.agentId === a.id).map(r => ({ runId: r.digest, worldId: r.worldId, role: r.actor }))), 'Role history is unsupported.');
        demand(hash(a.inventory) === hash(artifacts.filter(p => p.creator === a.id).map(p => p.id)), 'Inventory references differ.');
        demand(new Set(notes[a.id].map(n => n.id)).size === notes[a.id].length, 'Repeated memory id.');
        notes[a.id].forEach(n => {
            if (n.sourceRun) {
                const source = runById.get(n.sourceRun);
                demand(source && source.agentId === a.id && source.evaluation.partition === n.partition, 'Memory source/partition differs.');
            }
        });
    }
    handoffs.forEach(h => demand(agentById.has(h.agentId), 'Handoff agent is absent.'));
    return freeze({ schema: 'agent-locker@1', agents, notes, runs, artifacts, handoffs });
}
