import { hash } from '../runtime/data.ts';
import { validatePack } from '../worlds/compiler.ts';
import { createPassport, demand, validatePassport } from '../career/validation.ts';
import { FAMILY_IDS } from '../families/types.ts';
import type { AgentPassport } from '../career/types.ts';
import { eventAssets } from './assets.ts';
import { validateCircuit, validateCircuitAsset, validateCircuitNote } from './evidence.ts';
import { sealSeason, validateSeason, validateTeam } from './specs.ts';
import type { CircuitEvent, CircuitNote, CircuitSave, CircuitSeason } from './types.ts';
function editCircuit(input: CircuitSave): CircuitSave { const s = validateCircuit(input); return { ...s, agents: [...s.agents], teams: [...s.teams], seasons: [...s.seasons], events: [...s.events], notes: [...s.notes], grants: [...s.grants], operators: [...s.operators], reviews: [...s.reviews] }; }
export function addCircuitAgents(input: CircuitSave, agents: AgentPassport[]): CircuitSave {
    const save = editCircuit(input);
    for (const raw of agents) { const a = validatePassport(raw); demand(!save.agents.some(p => p.id === a.id), 'Choose a new Circuit passport id.'); save.agents.push(a); }
    return validateCircuit(save);
}
export function updateCircuitAgent(input: CircuitSave, raw: AgentPassport): CircuitSave {
    const save = editCircuit(input), agent = validatePassport(raw); demand(save.agents.some(a => a.id === agent.id), 'Choose a retained Circuit passport.');
    save.agents = save.agents.map(a => a.id === agent.id ? agent : a); return validateCircuit(save);
}
export function addCircuitTeam(input: CircuitSave, id: string, title: string, members: string[]): CircuitSave {
    const save = editCircuit(input); demand(!save.teams.some(t => t.id === id), 'Choose a new Circuit team id.');
    save.teams.push(validateTeam({ schema: 'circuit-team@1', id, title, members, preferences: Object.fromEntries(members.map((id, i) => [id, i === 0 ? ['driver', 'explorer', 'conductor', 'infrastructure'] : ['crew', 'strategist', 'pit', 'navigator', 'logistics']])) }));
    return validateCircuit(save);
}
export function starterCircuit(input: CircuitSave, controller: 'baseline' | 'mock' = 'baseline'): CircuitSave {
    let save = validateCircuit(input); const ids = ['comet-one', 'comet-two', 'aurora-one', 'aurora-two'];
    const agents = ids.map(id => { const a = createPassport(id, id.replaceAll('-', ' ')); return validatePassport({ ...a, compatibleWorlds: [...a.compatibleWorlds, ...FAMILY_IDS], publicCapabilities: [...a.publicCapabilities, 'family-artifacts'], controller: { ...a.controller, world: { ...a.controller.world, ...(controller === 'mock' ? { family: 'model', provider: 'mock', model: 'mock-policy' } : {}) } } }); });
    save = addCircuitAgents(save, agents); save = addCircuitTeam(save, 'comet', 'Comet Crew', ids.slice(0, 2)); return addCircuitTeam(save, 'aurora', 'Aurora Crew', ids.slice(2));
}
export function addCircuitSeason(input: CircuitSave, spec: unknown): CircuitSave {
    const save = editCircuit(input), shape = validateSeason(spec);
    const teams = shape.teamIds.map(id => save.teams.find(t => t.id === id)!);
    demand(teams.every(Boolean), 'Choose retained Circuit teams.');
    const season = sealSeason(shape, teams, save.agents.filter(a => teams.some(t => t.members.includes(a.id))));
    demand(!save.seasons.some(s => s.spec.id === season.spec.id), 'Choose a new season id. Frozen seasons cannot be edited.'); save.seasons.push(season); return validateCircuit(save);
}
export function rememberCircuitEvent(input: CircuitSave, event: CircuitEvent): CircuitSave {
    const save = editCircuit(input), previous = save.events.find(e => e.id === event.id);
    demand(!previous || previous.ending !== 'COMPLETE' || previous.digest === event.digest, 'Completed official events cannot be replaced by a different run.');
    save.events = previous ? save.events.map(e => e.id === event.id ? event : e) : [...save.events, event];
    return validateCircuit(save);
}
export function nextCircuitRound(save: CircuitSave, season: CircuitSeason, partition: CircuitEvent['partition'] = 'CAREER', seedIndex = 0) { return season.spec.rounds.find(r => !save.events.some(e => e.seasonHash === season.digest && e.roundId === r.id && e.partition === partition && e.seedIndex === seedIndex && e.ending === 'COMPLETE')); }
export function writeCircuitNote(input: CircuitSave, note: CircuitNote): CircuitSave { const save = editCircuit(input), value = validateCircuitNote(note); save.notes = [...save.notes.filter(n => n.id !== value.id), value]; return validateCircuit(save); }
export function shareCircuitAsset(input: CircuitSave, assetId: string, toTeam: string): CircuitSave {
    const save = editCircuit(input), asset = [...save.operators, ...save.events.flatMap(eventAssets)].find(a => a.id === assetId);
    demand(asset && ['CAREER', 'TRAIN'].includes(asset.partition), 'Share only retained CAREER/TRAIN source assets.');
    const grant = { id: `grant-${hash({ assetId, toTeam }).slice(0, 24)}`, assetId, contentHash: asset.contentHash, fromTeam: asset.teamId, toTeam };
    demand(!save.grants.some(g => g.id === grant.id), 'This exchange is already declared.'); save.grants.push(grant); return validateCircuit(save);
}
export function importCircuitWorldPack(input: CircuitSave, teamId: string, creator: string, content: unknown): CircuitSave {
    const save = editCircuit(input), pack = validatePack(content), asset = validateCircuitAsset({ schema: 'circuit-asset@1', id: `pack-${hash(pack).slice(0, 24)}`, teamId, creator, type: 'world-pack', content: pack, contentHash: hash(pack), origin: 'OPERATOR', sourceEvent: null, sourcePart: null, sourceDigest: null, partition: 'CAREER' });
    save.operators.push(asset); return validateCircuit(save);
}
export function reviewCircuitPerformance(input: CircuitSave, eventId: string, partId: string, text: string): CircuitSave { const save = editCircuit(input); save.reviews = [...save.reviews.filter(r => r.eventId !== eventId || r.partId !== partId), { eventId, partId, text }]; return validateCircuit(save); }
export function careerTimeline(save: CircuitSave, agentId: string) { return save.events.flatMap(e => e.parts.flatMap(p => { const roles = Object.entries(p.bindings).filter(([, b]) => b.agentId === agentId).map(([role]) => role), shifts = p.shifts.filter(s => s.agentId === agentId); return roles.length || shifts.length ? [{ eventId: e.id, roundId: e.roundId, nativeDigest: p.native.digest, teamIds: p.teamIds, roles, shifts, artifacts: eventAssets(e).filter(a => a.creator === agentId && a.sourcePart === p.id).map(a => a.id), partition: e.partition }] : []; })); }
