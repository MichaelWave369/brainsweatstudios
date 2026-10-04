import { clone, freeze, hash } from '../runtime/data.ts';
import { dataBytes } from '../worlds/compiler.ts';
import { CAREER_LIMITS, type AgentPassport, type CareerRun, type CareerSave, type EvaluationInput, type MemoryCondition, type Partition, type PortableArtifact, type PublicNote, type WorldHandoffRecord } from './types.ts';
import { createPassport, demand, inputHash, runDigest, validateCareer, validateEvaluation, validateNote, validatePassport, verifyCareerRun } from './validation.ts';
function synchronize(save: CareerSave): CareerSave {
    const runIds = new Set(save.runs.map(r => r.digest));
    save.artifacts = save.artifacts.filter(a => runIds.has(a.creationRun));
    save.agents = save.agents.map(a => ({ ...a, performanceEvidence: save.runs.filter(r => r.agentId === a.id).map(r => r.digest), roleHistory: save.runs.filter(r => r.agentId === a.id).map(r => ({ runId: r.digest, worldId: r.worldId, role: r.actor })), inventory: save.artifacts.filter(p => p.creator === a.id).map(p => p.id) }));
    Object.keys(save.notes).forEach(id => { save.notes[id] = save.notes[id].filter(n => n.sourceRun === null || runIds.has(n.sourceRun)); });
    return save;
}
export function addAgent(save: CareerSave, id: string, name: string): CareerSave {
    const next = clone(validateCareer(save));
    demand(!next.agents.some(a => a.id === id), 'Choose a new operational id.');
    next.agents.push(createPassport(id, name));
    next.notes[id] = [];
    return validateCareer(next);
}
export function updatePassport(save: CareerSave, passport: AgentPassport): CareerSave {
    const p = validatePassport(passport), next = clone(validateCareer(save));
    demand(next.agents.some(a => a.id === p.id), 'Passport is absent.');
    next.agents = next.agents.map(a => a.id === p.id ? p : a);
    return validateCareer(next);
}
export function writeNote(save: CareerSave, agentId: string, note: PublicNote): CareerSave {
    const next = clone(validateCareer(save)), value = validateNote(note);
    demand(next.notes[agentId], 'Passport is absent.');
    next.notes[agentId] = [...next.notes[agentId].filter(n => n.id !== value.id), value];
    return validateCareer(next);
}
export function removeNote(save: CareerSave, agentId: string, id: string): CareerSave {
    const next = clone(validateCareer(save));
    demand(next.notes[agentId], 'Passport is absent.');
    next.notes[agentId] = next.notes[agentId].filter(n => n.id !== id);
    return validateCareer(next);
}
export function evaluationInput(save: CareerSave, agentId: string, worldId: string, episode: string, partition: Partition = 'CAREER', condition: MemoryCondition = 'FRESH'): EvaluationInput {
    const locker = validateCareer(save), agent = locker.agents.find(a => a.id === agentId);
    demand(agent && agent.compatibleWorlds.includes(worldId), 'Passport does not declare compatibility with this world.');
    const notes = condition === 'FRESH' ? [] : locker.notes[agentId].filter(n => ['CAREER', 'TRAIN'].includes(n.partition) && (n.scope === 'CAREER' || n.worldId === worldId && (n.scope !== 'EPISODE' || n.episode === episode))).slice(-6);
    const artifacts = condition === 'FRESH' ? [] : locker.artifacts.filter(a => agent.inventory.includes(a.id) && a.compatibleWorlds.includes(worldId)).slice(-1);
    const value = { mode: partition === 'CAREER' ? 'CAREER' : 'BENCHMARK', partition, condition, episode, notes: clone(notes), artifacts: clone(artifacts) } as Omit<EvaluationInput, 'snapshotHash'>;
    return validateEvaluation({ ...value, snapshotHash: inputHash(value) });
}
export function handoffRecord(save: CareerSave, agentId: string, source: string, destination: string, input: EvaluationInput): WorldHandoffRecord {
    const agent = validateCareer(save).agents.find(a => a.id === agentId);
    demand(agent, 'Passport is absent.');
    const capabilities = destination === 'town-zero' || destination === 'reserve-lesson' ? ['public-notes', 'world-plan'] : [];
    return freeze({ schema: 'career-handoff@1', agentId, source, destination, memory: input.notes.map(n => n.id), accepted: input.artifacts.map(a => a.id), rejected: agent.inventory.filter(id => !input.artifacts.some(a => a.id === id)).map(id => ({ id, reason: input.condition === 'FRESH' ? 'Fresh input excludes inventory.' : 'Destination excludes this artifact.' })), acceptedCapabilities: agent.publicCapabilities.filter(c => capabilities.includes(c)), rejectedCapabilities: agent.publicCapabilities.filter(c => !capabilities.includes(c)), input, snapshotHash: input.snapshotHash });
}
export function sealRun(input: Omit<CareerRun, 'schema' | 'digest'>): CareerRun {
    const value = { schema: 'career-run@1', ...input } as Omit<CareerRun, 'digest'>;
    return verifyCareerRun({ ...value, digest: runDigest(value) });
}
export function rememberRun(save: CareerSave, run: CareerRun, handoff?: WorldHandoffRecord): CareerSave {
    const next = clone(validateCareer(save)), verified = verifyCareerRun(run);
    // A receipt for the same episode replaces the previous stopped snapshot.
    next.runs = next.runs.filter(r => !(r.agentId === verified.agentId && r.evaluation.episode === verified.evaluation.episode));
    next.runs.push(verified);
    if (handoff && !next.handoffs.some(h => h.snapshotHash === handoff.snapshotHash))
        next.handoffs = [...next.handoffs, handoff].slice(-16);
    synchronize(next);
    while (next.runs.length > CAREER_LIMITS.runs || dataBytes(next) > CAREER_LIMITS.bytes) {
        // Preserve receipts referenced by admitted artifact provenance. If that
        // dependency graph fills the archive, ask the operator to export/reset.
        const candidates = next.runs.filter(r => r.digest !== verified.digest && !next.runs.some(n => n.evaluation.artifacts.some(a => a.creationRun === r.digest) || n.evaluation.notes.some(a => a.sourceRun === r.digest)));
        demand(candidates.length, 'Export the archive before retaining another large dependent receipt.');
        next.runs = next.runs.filter(r => r.digest !== candidates[0].digest);
        synchronize(next);
    }
    return validateCareer(next);
}
export function retainPlan(save: CareerSave, runId: string, id: string, compatibleWorlds: string[]): CareerSave {
    const next = clone(validateCareer(save)), run = next.runs.find(r => r.digest === runId);
    demand(run && run.receipt.schema === 'world-episode@1', 'Choose verified WorldSpec plan evidence.');
    demand(['CAREER', 'TRAIN'].includes(run.evaluation.partition), 'Holdout/transfer artifacts stay outside career inventory.');
    const plan = run.receipt.artifacts.filter(a => a.actor === run.actor && a.kind === 'plan').at(-1);
    demand(plan && 'goal' in plan.value, 'This receipt has no recorded plan.');
    const artifact: PortableArtifact = { schema: 'career-artifact@1', id, type: 'world-plan', version: '1.0.0', creator: run.agentId, creationRun: run.digest, contentHash: hash(plan.value), compatibleWorlds, content: plan.value, bytes: dataBytes(plan.value) };
    demand(!next.artifacts.some(a => a.id === id), 'Choose a new artifact id.');
    next.artifacts.push(artifact);
    return validateCareer(synchronize(next));
}
export function portfolio(save: CareerSave, agentId: string) {
    const runs = validateCareer(save).runs.filter(r => r.agentId === agentId);
    const families = [...new Set(runs.map(r => r.family))];
    return families.map(family => { const rows = runs.filter(r => r.family === family); return { family, runs: rows.length, completed: rows.filter(r => r.receipt.result.terminal).length, skills: rows.map(r => ({ receipt: r.digest, world: r.worldId, role: r.actor, planning: r.receipt.schema === 'world-episode@1' ? r.receipt.artifacts.filter(a => a.actor === r.actor && a.kind === 'plan').length : 0, information: r.receipt.schema === 'world-episode@1' ? r.receipt.result.inspections : r.receipt.records.filter(a => a.observation.agent.id === r.actor && a.transition?.events.some(e => e.type === 'information')).length, coordination: r.receipt.schema === 'world-episode@1' ? r.receipt.result.signals : r.receipt.records.filter(a => a.observation.agent.id === r.actor && a.transition?.events.some(e => e.type === 'signal')).length, recovery: r.receipt.schema === 'world-episode@1' ? r.receipt.result.recoveries : r.receipt.records.filter(a => a.observation.agent.id === r.actor && a.attempts.some(e => e.code !== null)).length, resourceOutcome: r.receipt.schema === 'world-episode@1' ? r.receipt.result.reserves : r.receipt.result.resources })), evidence: rows.map(r => ({ id: r.digest, world: r.worldId, actor: r.actor, partition: r.evaluation.partition, condition: r.evaluation.condition, controller: r.controller.family })) }; });
}
export function exportPassport(save: CareerSave, agentId: string): CareerSave {
    const locker = validateCareer(save);
    demand(locker.agents.some(a => a.id === agentId), 'Passport is absent.');
    return validateCareer({ schema: 'agent-locker@1', agents: locker.agents.filter(a => a.id === agentId), notes: { [agentId]: locker.notes[agentId] }, runs: locker.runs.filter(r => r.agentId === agentId), artifacts: locker.artifacts.filter(a => a.creator === agentId), handoffs: locker.handoffs.filter(h => h.agentId === agentId) });
}
