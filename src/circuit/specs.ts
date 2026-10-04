import { clone, exact, freeze, hash, integer, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { demand, identifier, ids, validatePassport } from '../career/validation.ts';
import { familyConfig, seedAllowed, validateFamilyConfig } from '../families/specs.ts';
import { composeScore } from '../performance/specs.ts';
import { CIRCUIT_FAMILIES, CIRCUIT_FORMATS, CIRCUIT_LIMITS, CIRCUIT_METRICS, familyMetrics, formatFamily, type CircuitSeason, type CircuitTeam, type SeasonRound, type SeasonSpec } from './types.ts';
export const circuitText = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !Array.from(v).some(c => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)));
const distinct = <T,>(list: T[]) => new Set(list).size === list.length;
export function validateTeam(value: unknown): CircuitTeam {
    assertData(value, 8000, 1000, 6);
    demand(plain(value) && exact(value, ['schema', 'id', 'title', 'members', 'preferences']) && value.schema === 'circuit-team@1' && identifier(value.id) && circuitText(value.title, 64) && ids(value.members, 4) && value.members.length > 0 && plain(value.preferences) && exact(value.preferences, value.members), 'Invalid bounded Circuit team.');
    demand(Object.values(value.preferences).every(v => ids(v, 8)), 'Use bounded role preferences.');
    return freeze(clone(value)) as unknown as CircuitTeam;
}
export function validateSeason(value: unknown): SeasonSpec {
    assertData(value, 300000, 45000, 18);
    demand(plain(value) && exact(value, ['schema', 'id', 'title', 'mode', 'teamIds', 'rounds']) && value.schema === 'season-spec@1' && identifier(value.id) && circuitText(value.title, 80) && ['CAREER', 'GAUNTLET'].includes(String(value.mode)) && ids(value.teamIds, 2) && value.teamIds.length > 0 && Array.isArray(value.rounds) && value.rounds.length > 0 && value.rounds.length <= CIRCUIT_LIMITS.rounds, 'Invalid bounded SeasonSpec.');
    const rounds = value.rounds.map(v => {
        demand(plain(v) && exact(v, ['id', 'title', 'family', 'format', 'seeds', 'controllerRules', 'memory', 'artifacts', 'teamPolicy', 'metrics', 'config', 'townDays', 'stages', 'shiftTicks']) && identifier(v.id) && circuitText(v.title, 80) && CIRCUIT_FAMILIES.includes(v.family as never) && CIRCUIT_FORMATS.includes(v.format as never) && formatFamily[v.format as keyof typeof formatFamily] === v.family && plain(v.seeds) && exact(v.seeds, ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER']), 'Round definition differs from its registered family.');
        for (const p of ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER']) demand(Array.isArray(v.seeds[p]) && v.seeds[p].length > 0 && v.seeds[p].length <= 3 && distinct(v.seeds[p]) && v.seeds[p].every(s => integer(s, 0, 2147483647) && seedAllowed(p, s)), 'Use separate bounded frozen seed sets.');
        demand(Array.isArray(v.controllerRules) && v.controllerRules.length > 0 && v.controllerRules.length <= 4 && distinct(v.controllerRules) && v.controllerRules.every(c => ['baseline', 'mock', 'human', 'local'].includes(String(c))) && ['FRESH', 'TEAM_PUBLIC'].includes(String(v.memory)) && ['NONE', 'TEAM', 'SHARED'].includes(String(v.artifacts)) && ['SOLO', 'COOPERATIVE', 'RELAY'].includes(String(v.teamPolicy)) && Array.isArray(v.metrics) && v.metrics.length > 0 && distinct(v.metrics) && v.metrics.every(m => CIRCUIT_METRICS.includes(m as never)) && integer(v.stages, 1, 3) && integer(v.shiftTicks, 12, 168), 'Invalid declared round policy.');
        demand(value.mode !== 'GAUNTLET' || v.memory === 'FRESH' && v.artifacts === 'NONE', 'Frozen gauntlet excludes prior notes and artifacts.');
        demand(v.family === 'town-zero' ? v.config === null && [7, 30].includes(Number(v.townDays)) && v.stages === 1 : v.townDays === null && plain(v.config), 'Native round parameters differ.');
        const config = v.config === null ? null : validateFamilyConfig(v.config);
        demand(config === null || config.family === v.family, 'Round configuration belongs to another world.');
        demand(v.format === 'cache-rally' || v.format === 'stunt-festival' || v.stages === 1, 'This format has one configured stage.');
        return { ...clone(v), config } as unknown as SeasonRound;
    });
    demand(distinct(rounds.map(r => r.id)), 'Choose unique round ids.');
    return freeze({ ...clone(value), rounds }) as unknown as SeasonSpec;
}
export function sealSeason(specInput: unknown, teamsInput: unknown[], agentsInput: unknown[]): CircuitSeason {
    const spec = validateSeason(specInput), teams = teamsInput.map(validateTeam), agents = agentsInput.map(validatePassport);
    demand(teams.length === spec.teamIds.length && distinct(teams.map(t => t.id)) && spec.teamIds.every(id => teams.some(t => t.id === id)), 'Season teams differ from the manifest.');
    const members = teams.flatMap(t => t.members);
    demand(distinct(members) && agents.length === members.length && distinct(agents.map(a => a.id)) && members.every(id => agents.some(a => a.id === id)), 'Every season member needs one immutable passport snapshot.');
    demand(spec.rounds.every(r => agents.every(a => a.compatibleWorlds.includes(r.family))), 'Enable family compatibility on every participating passport.');
    for (const r of spec.rounds) for (const a of agents) {
        const c = a.controller.world, rule = c.family === 'model' ? c.provider === 'mock' ? 'mock' : 'local' : c.family;
        demand(r.controllerRules.includes(rule), 'This round rejects a participant controller.');
    }
    const base = { schema: 'circuit-season@1' as const, spec, agents, teams };
    return freeze({ ...base, digest: hash(base) });
}
export function validateSeasonRecord(value: unknown): CircuitSeason {
    assertData(value, 600000, 75000, 20);
    demand(plain(value) && exact(value, ['schema', 'spec', 'agents', 'teams', 'digest']) && value.schema === 'circuit-season@1' && Array.isArray(value.agents) && Array.isArray(value.teams), 'Invalid frozen season record.');
    const sealed = sealSeason(value.spec, value.teams, value.agents);
    demand(value.digest === sealed.digest, 'Season snapshot hash differs.');
    return sealed;
}
export function makeSeason(teamIds: string[], length: 6 | 12 = 6, mode: SeasonSpec['mode'] = 'CAREER', id = 'first-circuit'): SeasonSpec {
    const formats = ['original-performance', 'race-league', 'cache-rally', 'town-relay', 'research', 'stunt-festival'] as const;
    const titles = ['Original opening theme', 'Auto Circuit league', 'Cache relay rally', 'Town Zero relay', 'Synthetic research event', 'Stunt and local show festival'];
    const rounds: SeasonRound[] = Array.from({ length }, (_, index) => {
        const i = index % 6, format = formats[i], family = formatFamily[format], base = family === 'town-zero' ? null : familyConfig(family, 17 + index, family === 'auto-circuit' ? 'endurance' : 'solo');
        const config = base && ['ensemble-lab', 'stunt-show', 'stream-studio'].includes(family) ? validateFamilyConfig({ ...base, schema: 'family-config@2', ...(family === 'ensemble-lab' ? { score: composeScore(index % 2 ? 'band' : 'choir', index) } : {}) }) : base;
        return { id: `round-${index + 1}`, title: `${titles[i]}${index >= 6 ? ' II' : ''}`, family, format, seeds: { CAREER: [17 + index * 3, 18 + index * 3, 19 + index * 3], TRAIN: [1001 + index * 3, 1002 + index * 3, 1003 + index * 3], HOLDOUT: [2001 + index * 3, 2002 + index * 3, 2003 + index * 3], TRANSFER: [3001 + index * 3, 3002 + index * 3, 3003 + index * 3] }, controllerRules: ['baseline', 'mock', 'human', 'local'], memory: mode === 'GAUNTLET' ? 'FRESH' : 'TEAM_PUBLIC', artifacts: mode === 'GAUNTLET' ? 'NONE' : 'TEAM', teamPolicy: format === 'cache-rally' || format === 'town-relay' ? 'RELAY' : 'COOPERATIVE', metrics: familyMetrics[family], config, townDays: family === 'town-zero' ? 7 : null, stages: format === 'cache-rally' ? 3 : format === 'stunt-festival' ? 2 : 1, shiftTicks: 24 };
    });
    return validateSeason({ schema: 'season-spec@1', id, title: mode === 'GAUNTLET' ? 'Frozen Circuit gauntlet' : length === 6 ? 'Six-event Agent Circuit' : 'Twelve-event Agent Circuit', mode, teamIds, rounds });
}
