import { clone, hash } from '../runtime/data.ts';
import { demand } from '../career/validation.ts';
import { acceptsArtifact, familyConfig, validateFamilyConfig } from '../families/specs.ts';
import { createFamilyEnvironment } from '../families/runtime.ts';
import type { FamilyArtifactInput, FamilyConfig, FamilyPublicInput, VehicleSpec } from '../families/types.ts';
import type { WorldController } from '../worlds/receipts.ts';
import { townPack } from '../worlds/townZero.ts';
import { eventAssets, partAssets } from './assets.ts';
import type { CircuitAdmission, CircuitAsset, CircuitBinding, CircuitEvent, CircuitPart, CircuitSave, CircuitSeason, CircuitTeam, SeasonRound } from './types.ts';
export interface PartPlan { id: string; phase: CircuitPart['phase']; teamIds: string[]; bindings: Record<string, CircuitBinding>; config: FamilyConfig | null; pack: ReturnType<typeof townPack> | null; seed: number }
export const eventId = (season: CircuitSeason, round: SeasonRound, partition: CircuitEvent['partition'], seedIndex: number) => `event-${hash({ season: season.digest, round: round.id, partition, seedIndex }).slice(0, 24)}`;
export function controllerFor(season: CircuitSeason, agentId: string, role: string, memory: SeasonRound['memory']): WorldController {
    const a = season.agents.find(a => a.id === agentId); demand(a, 'Circuit passport is absent.');
    return { ...clone(a.controller.world), id: `c-${hash({ agentId, role }).slice(0, 24)}`, context: memory === 'TEAM_PUBLIC' ? 'BOUNDED_NOTEBOOK' : a.controller.world.context };
}
export function roleAgent(team: CircuitTeam, role: string, index: number, shift = 0): string {
    const preferred = team.members.findIndex(id => team.preferences[id].includes(role));
    return team.members[((preferred < 0 ? index : preferred) + shift) % team.members.length];
}
const carId = (teamId: string) => `car-${hash(teamId).slice(0, 16)}`;
export const partCount = (season: CircuitSeason, round: SeasonRound) => round.format === 'race-league' ? season.teams.length + 1 : season.teams.length * round.stages;
export function planPart(season: CircuitSeason, round: SeasonRound, partition: CircuitEvent['partition'], seedIndex: number, previous: CircuitPart[]): PartPlan {
    demand(Number.isInteger(seedIndex) && seedIndex >= 0 && seedIndex < round.seeds[partition].length, 'Frozen seed index is absent.');
    const index = previous.length, seed = round.seeds[partition][seedIndex];
    demand(index < partCount(season, round), 'This event already has all native parts.');
    let config: FamilyConfig | null = null, pack: PartPlan['pack'] = null, phase: PartPlan['phase'], teams: CircuitTeam[], stage = 0;
    if (round.format === 'race-league') {
        teams = index < season.teams.length ? [season.teams[index]] : season.teams;
        const base = clone(round.config!), vehicles = season.teams.map((t, i) => ({ ...base.race!.vehicles[i % base.race!.vehicles.length], id: carId(t.id) }));
        if (index < season.teams.length) {
            phase = 'qualifying'; config = validateFamilyConfig({ schema: 'family-config@1', family: 'auto-circuit', seed, maxTicks: base.maxTicks, race: { mode: 'solo', laps: 1, vehicles: [vehicles[index]], track: base.race!.track }, score: null });
        } else {
            phase = 'race';
            const qualified = previous.map((p, i) => {
                demand(p.native.schema === 'family-episode@1', 'Qualifying evidence differs.');
                const car = (p.native.result.public.cars as { finished: boolean; finishTick: number; position: number }[])[0];
                const output = p.native.outputs.find(o => o.actor === 'driver-0' && o.type === 'vehicle-setup');
                return { team: season.teams[i], car, vehicle: output ? clone(output.content as VehicleSpec) : vehicles[i] };
            });
            const grid = [...qualified].sort((a, b) => Number(b.car.finished) - Number(a.car.finished) || (a.car.finished ? a.car.finishTick - b.car.finishTick : b.car.position - a.car.position) || a.team.id.localeCompare(b.team.id)).map(q => q.vehicle.id);
            config = validateFamilyConfig({ schema: 'family-config@3', family: 'auto-circuit', seed, maxTicks: base.maxTicks, race: { mode: 'league', laps: base.race!.laps, vehicles: qualified.map(q => q.vehicle), track: base.race!.track, grid, pitWindow: [4, Math.min(200, base.maxTicks)] }, score: null, cache: null });
        }
    } else {
        const teamIndex = Math.floor(index / round.stages); stage = index % round.stages; teams = [season.teams[teamIndex]];
        if (round.family === 'town-zero') { phase = 'campaign'; pack = townPack(round.townDays!); }
        else {
            const nativeSeed = round.format === 'cache-rally' && stage >= 2 ? round.seeds[partition][(seedIndex + 1) % round.seeds[partition].length] : seed;
            if (round.format === 'cache-rally') {
                phase = stage === 0 ? 'solo' : stage === 1 ? 'relay' : 'cooperative';
                config = validateFamilyConfig({ ...familyConfig('cache-quest', nativeSeed), schema: 'family-config@3', cache: { communication: stage >= 2 ? 'limited' : 'shared', signalEvery: stage >= 2 ? 3 : 1 } });
            } else if (round.format === 'stunt-festival' && stage > 0) { phase = 'show'; config = validateFamilyConfig({ ...familyConfig('stream-studio', nativeSeed), schema: 'family-config@2' }); }
            else { phase = round.family === 'ensemble-lab' ? 'performance' : round.family === 'web-scout' ? 'research' : 'show'; config = validateFamilyConfig({ ...round.config!, seed: nativeSeed }); }
        }
    }
    const roles = pack ? pack.worlds.find(w => w.id === 'town-zero')!.roles.map(r => r.id) : [...createFamilyEnvironment(config!).roles];
    const bindings = Object.fromEntries(roles.map((role, i) => {
        const team = phase === 'race' ? teams[Number(role.split('-')[1])] : teams[0];
        const memberIndex = phase === 'race' ? ['driver', 'crew', 'strategist', 'pit'].indexOf(role.split('-')[0]) : i;
        const agentId = round.teamPolicy === 'SOLO' || phase === 'solo' ? team.members[0] : roleAgent(team, role.replace(/-\d+$/, ''), memberIndex, phase === 'relay' ? stage : 0);
        return [role, { teamId: team.id, agentId }];
    }));
    return { id: `part-${index + 1}`, phase, teamIds: teams.map(t => t.id), bindings, config, pack, seed };
}
export function admittedInputs(save: CircuitSave, season: CircuitSeason, round: SeasonRound, partition: CircuitEvent['partition'], eid: string, previous: CircuitPart[], plan: PartPlan): CircuitAdmission[] {
    const assets = [...save.operators, ...save.events.filter(e => e.id !== eid && e.ending === 'COMPLETE').flatMap(eventAssets), ...previous.filter(p => p.native.result.terminal).flatMap(p => partAssets(eid, partition, p))].filter(a => ['CAREER', 'TRAIN'].includes(a.partition));
    const family = plan.pack ? 'town-zero' : plan.config!.family;
    return Object.entries(plan.bindings).map(([role, binding]) => {
        demand(season.teams.some(t => t.id === binding.teamId), 'Circuit admission team is absent.');
        const notes = round.memory === 'FRESH' ? [] : save.notes.filter(n => n.teamId === binding.teamId && ['CAREER', 'TRAIN'].includes(n.partition) && (n.scope === 'TEAM' || n.family === family)).slice(-6);
        const compatible = (a: CircuitAsset) => family === 'town-zero' ? a.type === 'world-plan' : acceptsArtifact(family, a.type);
        const eligible = round.artifacts === 'NONE' ? [] : assets.filter(a => compatible(a) && (a.teamId === binding.teamId || round.artifacts === 'SHARED' && save.grants.some(g => g.assetId === a.id && g.fromTeam === a.teamId && g.toTeam === binding.teamId && g.contentHash === a.contentHash)));
        // Keep the most recent verified content of each kind; imported inventory
        // references never authorize an input without its retained native source.
        const selected = [...new Map(eligible.map(a => [a.type, a])).values()].slice(-4);
        const base = { role, teamId: binding.teamId, notes: clone(notes), assets: clone(selected) };
        return { ...base, snapshotHash: hash(base) };
    });
}
export function familyInputs(admissions: CircuitAdmission[]): Record<string, FamilyPublicInput> {
    return Object.fromEntries(admissions.map(a => [a.role, { snapshotHash: a.snapshotHash, notes: a.notes.map(n => n.text), artifacts: a.assets.map(s => ({ type: s.type, contentHash: s.contentHash, content: s.content })) as FamilyArtifactInput[] }]));
}
