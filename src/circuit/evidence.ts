import { clone, exact, freeze, hash, integer, plain } from '../runtime/data.ts';
import { assertData, validatePack } from '../worlds/compiler.ts';
import { digest, demand, identifier, validatePassport } from '../career/validation.ts';
import { acceptsArtifact, validateFamilyContent } from '../families/specs.ts';
import { verifyFamilyReceipt } from '../families/receipts.ts';
import { freshMemory, validatePlan, verifyWorldReceipt } from '../worlds/receipts.ts';
import { bindingAt, eventAssets, partAssets } from './assets.ts';
import { circuitText, validateSeasonRecord, validateTeam } from './specs.ts';
import { controllerFor, eventId, familyInputs, partCount, planPart, roleAgent } from './plans.ts';
import { measuredParts } from './scoring.ts';
import { CIRCUIT_FAMILIES, CIRCUIT_LIMITS, type CircuitAdmission, type CircuitAsset, type CircuitEvent, type CircuitNote, type CircuitPart, type CircuitSave, type CircuitSeason } from './types.ts';
export const freshCircuit = (): CircuitSave => ({ schema: 'circuit-save@1', agents: [], teams: [], seasons: [], events: [], notes: [], grants: [], operators: [], reviews: [] });
const verifiedSaves = new WeakSet<object>();
export function validateCircuitNote(value: unknown): CircuitNote {
    assertData(value, 2000, 100, 4);
    demand(plain(value) && exact(value, ['id', 'teamId', 'scope', 'family', 'partition', 'sourceEvent', 'text']) && identifier(value.id) && identifier(value.teamId) && ['TEAM', 'WORLD'].includes(String(value.scope)) && (value.scope === 'TEAM' ? value.family === null : CIRCUIT_FAMILIES.includes(value.family as never)) && ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].includes(String(value.partition)) && (value.sourceEvent === null || identifier(value.sourceEvent)) && circuitText(value.text), 'Invalid scoped Circuit note.');
    demand(value.sourceEvent !== null || value.partition === 'CAREER', 'Operator notes must declare CAREER scope.');
    return freeze(clone(value)) as unknown as CircuitNote;
}
export function validateCircuitAsset(value: unknown): CircuitAsset {
    assertData(value, 270000, 50000, 24);
    demand(plain(value) && exact(value, ['schema', 'id', 'teamId', 'creator', 'type', 'content', 'contentHash', 'origin', 'sourceEvent', 'sourcePart', 'sourceDigest', 'partition']) && value.schema === 'circuit-asset@1' && identifier(value.id) && identifier(value.teamId) && identifier(value.creator) && digest(value.contentHash) && ['NATIVE', 'OPERATOR'].includes(String(value.origin)) && ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].includes(String(value.partition)), 'Invalid Circuit asset envelope.');
    const content = value.type === 'world-plan' ? validatePlan(value.content) : value.type === 'world-pack' ? validatePack(value.content) : validateFamilyContent(value.type as never, value.content);
    demand(hash(content) === value.contentHash, 'Circuit asset hash differs.');
    demand(value.origin === 'OPERATOR' ? value.type === 'world-pack' && value.sourceEvent === null && value.sourcePart === null && value.sourceDigest === null && value.partition === 'CAREER' : identifier(value.sourceEvent) && identifier(value.sourcePart) && digest(value.sourceDigest) && value.type !== 'world-pack', 'Circuit asset provenance differs.');
    return freeze({ ...clone(value), content }) as unknown as CircuitAsset;
}
function validateAdmission(raw: unknown, season: CircuitSeason, round: CircuitSeason['spec']['rounds'][number], plan: ReturnType<typeof planPart>, context: CircuitSave, sources: Map<string, string>): CircuitAdmission {
    demand(plain(raw) && exact(raw, ['role', 'teamId', 'notes', 'assets', 'snapshotHash']) && identifier(raw.role) && identifier(raw.teamId) && Array.isArray(raw.notes) && raw.notes.length <= 6 && Array.isArray(raw.assets) && raw.assets.length <= 4 && digest(raw.snapshotHash), 'Invalid Circuit admission.');
    demand(plan.bindings[raw.role]?.teamId === raw.teamId, 'Admission role belongs to another team.');
    const notes = raw.notes.map(validateCircuitNote), assets = raw.assets.map(validateCircuitAsset);
    const family = plan.config?.family ?? 'town-zero';
    demand(round.memory !== 'FRESH' || notes.length === 0, 'Fresh rounds cannot admit notes.');
    demand(round.artifacts !== 'NONE' || assets.length === 0, 'This round excludes artifacts.');
    for (const n of notes) {
        demand(n.teamId === raw.teamId && ['CAREER', 'TRAIN'].includes(n.partition) && (n.scope === 'TEAM' || n.family === family), 'Memory crossed its declared team, partition or world.');
        if (n.sourceEvent) { const source = context.events.find(e => e.id === n.sourceEvent); demand(source && source.partition === n.partition && source.ending === 'COMPLETE' && source.parts.some(p => p.teamIds.includes(n.teamId)), 'Circuit note source is absent.'); }
    }
    for (const a of assets) {
        demand(['CAREER', 'TRAIN'].includes(a.partition) && sources.get(a.id) === hash(a), 'Artifact requires retained eligible native source evidence.');
        demand(a.teamId === raw.teamId || round.artifacts === 'SHARED' && context.grants.some(g => g.assetId === a.id && g.fromTeam === a.teamId && g.toTeam === raw.teamId && g.contentHash === a.contentHash), 'Artifact sharing was not declared.');
        demand(family === 'town-zero' ? a.type === 'world-plan' : acceptsArtifact(family, a.type), 'Destination rejects this asset.');
    }
    const base = { role: raw.role, teamId: raw.teamId, notes, assets };
    demand(hash(base) === raw.snapshotHash, 'Circuit input snapshot hash differs.');
    demand(season.teams.some(t => t.id === raw.teamId), 'Admission team is absent.');
    return freeze({ ...base, snapshotHash: raw.snapshotHash });
}
function verifyEvent(value: unknown, seasonInput: CircuitSeason, context: CircuitSave): CircuitEvent {
    assertData(value, CIRCUIT_LIMITS.bytes, 600000, 36);
    const season = validateSeasonRecord(seasonInput);
    demand(plain(value) && exact(value, ['schema', 'id', 'seasonHash', 'roundId', 'partition', 'seedIndex', 'parts', 'ending', 'measures', 'digest']) && value.schema === 'circuit-event@1' && identifier(value.id) && value.seasonHash === season.digest && identifier(value.roundId) && ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].includes(String(value.partition)) && integer(value.seedIndex, 0, 2) && Array.isArray(value.parts) && value.parts.length <= CIRCUIT_LIMITS.parts && ['STOPPED', 'COMPLETE', 'ERROR'].includes(String(value.ending)), 'Invalid Circuit event.');
    const round = season.spec.rounds.find(r => r.id === value.roundId); demand(round, 'Event round is absent.');
    const partition = value.partition as CircuitEvent['partition'], seedIndex = value.seedIndex;
    demand((season.spec.mode === 'CAREER') === (partition === 'CAREER'), 'Season partition differs from its declared mode.');
    demand(value.id === eventId(season, round, partition, seedIndex) && seedIndex < round.seeds[partition].length, 'Event identity or frozen seed differs.');
    const parts: CircuitPart[] = [];
    for (const raw of value.parts) {
        demand(parts.every(p => p.native.result.terminal), 'An unfinished native phase cannot be skipped.');
        const plan = planPart(season, round, partition, seedIndex, parts);
        demand(plain(raw) && exact(raw, ['id', 'phase', 'teamIds', 'bindings', 'admissions', 'shifts', 'native']) && raw.id === plan.id && raw.phase === plan.phase && hash(raw.teamIds) === hash(plan.teamIds) && hash(raw.bindings) === hash(plan.bindings) && Array.isArray(raw.admissions) && raw.admissions.length === Object.keys(plan.bindings).length && Array.isArray(raw.shifts) && raw.shifts.length <= 256 && plain(raw.native), 'Circuit phase or role attribution differs.');
        const sources = new Map([...context.operators, ...context.events.filter(e => e.ending === 'COMPLETE' && e.id !== value.id).flatMap(eventAssets), ...parts.filter(p => p.native.result.terminal).flatMap(p => partAssets(value.id as string, partition, p))].map(a => [a.id, hash(a)]));
        const admissions = raw.admissions.map(a => validateAdmission(a, season, round, plan, context, sources));
        demand(new Set(admissions.map(a => a.role)).size === admissions.length, 'Repeated role admission.');
        const native = raw.native.schema === 'world-episode@1' ? verifyWorldReceipt(raw.native) : verifyFamilyReceipt(raw.native);
        const controllers = Object.fromEntries(Object.entries(plan.bindings).map(([role, b]) => [role, controllerFor(season, b.agentId, role, round.memory)]));
        demand(hash(native.initialControllers) === hash(controllers), 'Circuit controller snapshot differs from the native authority.');
        if (native.schema === 'family-episode@1') {
            demand(plan.config !== null && hash(native.config) === hash(plan.config) && hash(native.inputs) === hash(familyInputs(admissions)) && raw.shifts.length === 0, 'Native family config or admitted inputs differ.');
        } else {
            demand(plan.pack !== null && native.worldId === 'town-zero' && native.masterSeed === plan.seed && hash(native.pack) === hash(plan.pack), 'Native Town Zero definition or seed differs.');
            for (const a of admissions) {
                const initial = native.artifacts.filter(x => x.actor === a.role && x.index === 0), memory = { ...freshMemory(), facts: a.notes.map(n => n.text), plans: a.assets.filter(s => s.type === 'world-plan').flatMap(s => [(s.content as { goal: string }).goal]).slice(0, 6) };
                demand(initial.filter(x => x.kind === 'memory').length === (a.notes.length || a.assets.length ? 1 : 0), 'Initial Town memory differs.');
                if (a.notes.length || a.assets.length) demand(hash(initial.find(x => x.kind === 'memory')!.value) === hash(memory), 'Admitted Town memory differs.');
                demand(hash(initial.filter(x => x.kind === 'plan').map(x => x.value)) === hash(a.assets.map(s => s.content)), 'Admitted Town plans differ.');
            }
            demand(raw.shifts.length === native.handoffs.length, 'Town shift ledger differs.');
            for (let i = 0; i < raw.shifts.length; i++) {
                const s = raw.shifts[i], h = native.handoffs[i];
                demand(plain(s) && exact(s, ['index', 'tick', 'role', 'agentId', 'controller']) && s.index === h.index && s.tick === h.tick && s.role === h.actor && h.tick > 0 && h.tick % round.shiftTicks === 0, 'Shift timing differs from native handoff evidence.');
                const team = season.teams.find(t => t.id === plan.bindings[h.actor].teamId)!, roleIndex = Object.keys(plan.bindings).indexOf(h.actor), agentId = roleAgent(team, h.actor, roleIndex, Math.floor(h.tick / round.shiftTicks));
                demand(s.agentId === agentId && hash(s.controller) === hash(controllerFor(season, agentId, h.actor, round.memory)) && hash(s.controller) === hash(h.to) && h.note === `Circuit shift: ${agentId}`, 'Shift passport/controller attribution differs.');
            }
            let tick = 0;
            for (const record of native.records) {
                for (const decision of record.decisions) {
                    const role = decision.actor, team = season.teams.find(t => t.id === plan.bindings[role].teamId)!;
                    const agentId = roleAgent(team, role, Object.keys(plan.bindings).indexOf(role), Math.floor(tick / round.shiftTicks));
                    demand(decision.controller === controllerFor(season, agentId, role, round.memory).id, 'A scheduled Town role rotation is absent.');
                }
                if (record.frame) tick = record.frame.tick;
            }
        }
        parts.push(freeze({ id: plan.id, phase: plan.phase, teamIds: plan.teamIds, bindings: plan.bindings, admissions, shifts: clone(raw.shifts), native }) as CircuitPart);
    }
    const complete = parts.length === partCount(season, round) && parts.every(p => p.native.result.terminal);
    demand((value.ending === 'COMPLETE') === complete, 'Circuit completion differs from its native phases.');
    const base = { schema: 'circuit-event@1' as const, id: value.id as string, seasonHash: season.digest, roundId: round.id, partition, seedIndex, parts, ending: value.ending as CircuitEvent['ending'], measures: measuredParts(parts, season, round.metrics) };
    demand(hash(base.measures) === hash(value.measures) && hash(base) === value.digest, 'Circuit standings or event digest differ from replay.');
    return freeze({ ...base, digest: value.digest as string });
}
export function validateCircuit(value: unknown): CircuitSave {
    if (value === undefined) return freeze(freshCircuit());
    if (plain(value) && verifiedSaves.has(value)) return value as unknown as CircuitSave;
    assertData(value, CIRCUIT_LIMITS.bytes, 750000, 38);
    demand(plain(value) && exact(value, ['schema', 'agents', 'teams', 'seasons', 'events', 'notes', 'grants', 'operators', 'reviews']) && value.schema === 'circuit-save@1' && Array.isArray(value.agents) && value.agents.length <= CIRCUIT_LIMITS.agents && Array.isArray(value.teams) && value.teams.length <= CIRCUIT_LIMITS.teams && Array.isArray(value.seasons) && value.seasons.length <= CIRCUIT_LIMITS.seasons && Array.isArray(value.events) && value.events.length <= CIRCUIT_LIMITS.events && Array.isArray(value.notes) && value.notes.length <= CIRCUIT_LIMITS.notes && Array.isArray(value.grants) && value.grants.length <= CIRCUIT_LIMITS.grants && Array.isArray(value.operators) && value.operators.length <= CIRCUIT_LIMITS.operators && Array.isArray(value.reviews) && value.reviews.length <= 24, 'Invalid bounded Circuit archive.');
    const agents = value.agents.map(validatePassport), teams = value.teams.map(validateTeam), seasons = value.seasons.map(validateSeasonRecord), notes = value.notes.map(validateCircuitNote), operators = value.operators.map(validateCircuitAsset);
    for (const list of [agents, teams, notes, operators]) demand(new Set(list.map(v => v.id)).size === list.length, 'Repeated Circuit identity.');
    demand(new Set(seasons.map(s => s.spec.id)).size === seasons.length && teams.every(t => t.members.every(id => agents.some(a => a.id === id))) && seasons.every(s => s.teams.every(t => teams.some(p => p.id === t.id)) && s.agents.every(a => agents.some(p => p.id === a.id))), 'Circuit roster reference is absent.');
    demand(notes.every(n => teams.some(t => t.id === n.teamId)) && operators.every(a => a.origin === 'OPERATOR' && teams.some(t => t.id === a.teamId && t.members.includes(a.creator))), 'Operator asset or note team is absent.');
    const grants = value.grants.map(g => { demand(plain(g) && exact(g, ['id', 'assetId', 'contentHash', 'fromTeam', 'toTeam']) && identifier(g.id) && identifier(g.assetId) && digest(g.contentHash) && identifier(g.fromTeam) && identifier(g.toTeam) && g.fromTeam !== g.toTeam && teams.some(t => t.id === g.fromTeam) && teams.some(t => t.id === g.toTeam), 'Invalid explicit artifact exchange.'); return clone(g) as unknown as CircuitSave['grants'][number]; });
    demand(new Set(grants.map(g => g.id)).size === grants.length, 'Repeated exchange declaration.');
    const result: CircuitSave = { schema: 'circuit-save@1', agents, teams, seasons, events: [], notes, grants, operators, reviews: [] };
    for (const e of value.events) { const season = seasons.find(s => plain(e) && s.digest === e.seasonHash); demand(season, 'Event season snapshot is absent.'); const event = verifyEvent(e, season, result); demand(!result.events.some(p => p.id === event.id), 'An event cannot award points twice.'); const roundIndex = season.spec.rounds.findIndex(r => r.id === event.roundId); demand(season.spec.rounds.slice(0, roundIndex).every(r => result.events.some(p => p.seasonHash === season.digest && p.roundId === r.id && p.partition === event.partition && p.seedIndex === event.seedIndex && p.ending === 'COMPLETE')), 'Advance the declared season schedule in order.'); result.events.push(event); }
    const assets = [...operators, ...result.events.flatMap(eventAssets)];
    demand(grants.every(g => assets.some(a => a.id === g.assetId && a.teamId === g.fromTeam && a.contentHash === g.contentHash && ['CAREER', 'TRAIN'].includes(a.partition))), 'Sharing requires an eligible retained source asset.');
    for (const n of notes) if (n.sourceEvent) demand(result.events.some(e => e.id === n.sourceEvent && e.partition === n.partition && e.ending === 'COMPLETE' && e.parts.some(p => p.teamIds.includes(n.teamId))), 'Note source is absent.');
    result.reviews = value.reviews.map(r => { demand(plain(r) && exact(r, ['eventId', 'partId', 'text']) && identifier(r.eventId) && identifier(r.partId) && circuitText(r.text) && result.events.some(e => e.id === r.eventId && e.parts.some(p => p.id === r.partId && p.native.schema === 'family-episode@1' && p.native.config.family === 'ensemble-lab')), 'Listening review needs its retained original performance.'); return clone(r) as unknown as CircuitSave['reviews'][number]; });
    freeze(result); verifiedSaves.add(result); return result;
}
export function verifyCircuitEvent(value: unknown, season: CircuitSeason, context: CircuitSave): CircuitEvent { return verifyEvent(value, season, validateCircuit(context)); }
export function sealEvent(base: Omit<CircuitEvent, 'digest'>, season: CircuitSeason, context: CircuitSave) { return verifyCircuitEvent({ ...base, digest: hash(base) }, season, context); }
export function bindAssetOwner(part: CircuitPart, actor: string, index: number) { return bindingAt(part, actor, index); }
