import { clone, exact, freeze, hash, integer, parseJSON, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { demand } from '../career/validation.ts';
import { freshCircuit, validateCircuit, verifyCircuitEvent } from './evidence.ts';
import { addCircuitSeason, nextCircuitRound, rememberCircuitEvent, starterCircuit } from './operations.ts';
import { makeSeason, validateSeasonRecord } from './specs.ts';
import { CircuitSession } from './session.ts';
import { generalizationMatrix, standings } from './scoring.ts';
import { CIRCUIT_FAMILIES, CIRCUIT_LIMITS, type CircuitBatch, type CircuitEvent, type CircuitSave } from './types.ts';

export async function runCircuitEvent(save: CircuitSave, seasonId: string, roundId: string, partition: CircuitEvent['partition'] = 'CAREER', seedIndex = 0, onProgress?: (session: CircuitSession) => void) {
    const session = new CircuitSession(save, seasonId, roundId, partition, seedIndex);
    demand(session.season.agents.every(a => a.controller.world.family === 'baseline' || a.controller.world.provider === 'mock'), 'Headless runs require declared baseline or offline mock controllers.');
    session.resume();
    for (let turn = 0; session.status !== 'COMPLETE' && turn < 24000; turn++) { demand(await session.step(), session.error || 'Circuit event halted.'); onProgress?.(session); }
    demand(session.status === 'COMPLETE', 'Circuit event exceeded its bounded logical turns.');
    return rememberCircuitEvent(save, session.receipt());
}
export async function runCircuitSeason(save: CircuitSave, seasonId: string, partition: CircuitEvent['partition'] = 'CAREER', seedIndex = 0, onEvent?: (save: CircuitSave) => void) {
    const season = save.seasons.find(s => s.spec.id === seasonId); demand(season, 'Choose a retained season.');
    let result = validateCircuit(save), round = nextCircuitRound(result, season, partition, seedIndex);
    while (round) { result = await runCircuitEvent(result, seasonId, round.id, partition, seedIndex); onEvent?.(result); round = nextCircuitRound(result, season, partition, seedIndex); }
    return result;
}
export function validateCircuitBatch(value: unknown): CircuitBatch {
    assertData(value, CIRCUIT_LIMITS.batchBytes, 5000000, 40);
    demand(plain(value) && exact(value, ['schema', 'season', 'trials', 'digest']) && value.schema === 'circuit-batch@1' && Array.isArray(value.trials) && value.trials.length > 0 && value.trials.length <= CIRCUIT_LIMITS.batchTrials, 'Invalid bounded Circuit batch.');
    const season = validateSeasonRecord(value.season); demand(season.spec.mode === 'GAUNTLET', 'Batch evaluation needs a frozen fresh gauntlet.');
    const context: CircuitSave = { ...freshCircuit(), agents: season.agents, teams: season.teams, seasons: [season] };
    const trials = value.trials.map(raw => { const e = verifyCircuitEvent(raw, season, { ...context, events: context.events.filter(p => plain(raw) && p.partition === raw.partition && p.seedIndex === raw.seedIndex) }); demand(e.ending === 'COMPLETE' && !context.events.some(p => p.id === e.id), 'Batch trials must be unique completed native events.');
        const i = season.spec.rounds.findIndex(r => r.id === e.roundId); demand(season.spec.rounds.slice(0, i).every(r => context.events.some(p => p.roundId === r.id && p.partition === e.partition && p.seedIndex === e.seedIndex)), 'Batch schedule skipped a declared round.'); context.events.push(e); return e; });
    const base = { schema: 'circuit-batch@1' as const, season, trials }; demand(hash(base) === value.digest, 'Circuit batch digest differs.'); return freeze({ ...base, digest: value.digest as string });
}
export async function runCircuitBatch(input: CircuitSave, seasonId: string, seeds = 1, onTrial?: (count: number) => void): Promise<CircuitBatch> {
    const source = validateCircuit(input), season = source.seasons.find(s => s.spec.id === seasonId); demand(season?.spec.mode === 'GAUNTLET' && integer(seeds, 1, 3) && seeds * 3 * season.spec.rounds.length <= CIRCUIT_LIMITS.batchTrials, 'Use a frozen gauntlet and at most 36 event trials.');
    const trials: CircuitEvent[] = [];
    for (const partition of ['TRAIN', 'HOLDOUT', 'TRANSFER'] as const) for (let seedIndex = 0; seedIndex < seeds; seedIndex++) {
        const fresh: CircuitSave = { ...freshCircuit(), agents: season.agents, teams: season.teams, seasons: [season] };
        const run = await runCircuitSeason(fresh, seasonId, partition, seedIndex, save => onTrial?.(trials.length + save.events.length)); trials.push(...run.events);
    }
    const base = { schema: 'circuit-batch@1' as const, season, trials }; return validateCircuitBatch({ ...base, digest: hash(base) });
}
export async function circuitCommand(command: string, args: string[], file: string | null = null) {
    const option = (key: string) => { const i = args.indexOf(key); demand(i < 0 || i + 1 < args.length, `Provide ${key}.`); return i < 0 ? undefined : args[i + 1]; };
    if (command === 'list') return { families: CIRCUIT_FAMILIES, schedules: [6, 12], partitions: ['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'], limits: CIRCUIT_LIMITS };
    const value = file === null ? null : parseJSON(file, command === 'verify' ? CIRCUIT_LIMITS.batchBytes : CIRCUIT_LIMITS.bytes);
    if (command === 'verify') { const s = plain(value) && value.schema === 'circuit-batch@1' ? validateCircuitBatch(value) : validateCircuit(value); demand(value !== null, 'Provide --input.'); return 'trials' in s ? { verified: true, digest: s.digest, matrix: generalizationMatrix(s.season, s.trials) } : { verified: true, events: s.events.map(e => e.digest), standings: s.seasons.map(season => standings(season, s.events)) }; }
    demand(['template', 'run', 'batch'].includes(command), 'Use list, template, run, batch or verify.');
    let save = value === null ? starterCircuit(freshCircuit(), option('--controller') === 'mock' ? 'mock' : 'baseline') : validateCircuit(value);
    demand(!option('--controller') || ['baseline', 'mock'].includes(option('--controller')!), 'This CLI admits baseline and offline mock only.');
    const length = Number(option('--length') ?? 6); demand(length === 6 || length === 12, 'Choose a six or twelve event season.');
    if (!save.seasons.length) save = addCircuitSeason(save, makeSeason(save.teams.slice(0, 2).map(t => t.id), length, command === 'batch' || option('--mode') === 'GAUNTLET' ? 'GAUNTLET' : 'CAREER'));
    const seasonId = option('--season') ?? save.seasons[0].spec.id;
    if (command === 'template') return clone(save);
    if (command === 'batch') return runCircuitBatch(save, seasonId, Number(option('--seeds') ?? 1));
    const partition = (option('--partition') ?? 'CAREER') as CircuitEvent['partition']; demand(['CAREER', 'TRAIN', 'HOLDOUT', 'TRANSFER'].includes(partition), 'Declare a known partition.');
    const seedIndex = Number(option('--seed-index') ?? 0); demand(integer(seedIndex, 0, 2), 'Choose a frozen seed index.');
    return option('--round') ? runCircuitEvent(save, seasonId, option('--round')!, partition, seedIndex) : runCircuitSeason(save, seasonId, partition, seedIndex);
}
