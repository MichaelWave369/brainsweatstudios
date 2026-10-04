import { CIRCUIT_METRICS, type CircuitEvent, type CircuitMeasures, type CircuitPart, type CircuitSeason, type CircuitMetric } from './types.ts';
const bounded = (n: number) => Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;
export const emptyMeasures = (): CircuitMeasures => Object.fromEntries(CIRCUIT_METRICS.map(k => [k, null])) as CircuitMeasures;
export function measuredParts(parts: CircuitPart[], season: CircuitSeason, metrics: CircuitMetric[]): Record<string, CircuitMeasures> {
    return Object.fromEntries(season.teams.map(team => {
        const samples: Partial<Record<CircuitMetric, number[]>> = {};
        const add = (key: CircuitMetric, n: number) => { if (metrics.includes(key)) (samples[key] ??= []).push(bounded(n)); };
        for (const p of parts.filter(p => p.teamIds.includes(team.id) && p.native.result.terminal && p.phase !== 'qualifying')) {
            const n = p.native;
            if (n.schema === 'world-episode@1') {
                add('resources', n.result.completion * 100);
                add('coordination', n.result.signals * 5); add('recovery', n.result.recoveries * 10);
            } else {
                const m = n.result.measures;
                if (n.config.family === 'auto-circuit') {
                    const index = p.teamIds.indexOf(team.id), cars = n.result.public.cars as { id: string; finished: boolean; position: number; recoveries: number; coordination?: number }[];
                    const car = cars[index], standings = n.result.public.standings as string[];
                    add('racing', car.finished ? 100 - standings.indexOf(car.id) * 20 : car.position / Math.max(1, n.config.race!.track.segments.reduce((s, n) => s + n.length, 0) * n.config.race!.laps) * 60);
                    add('coordination', (car.coordination ?? 0) * 5); add('recovery', car.recoveries * 10);
                } else if (n.config.family === 'cache-quest') { add('navigation', (m.discoveries + m.returned) * 50); add('coordination', m.coordination * 5); add('recovery', Math.max(0, 100 - m.puzzleErrors * 20)); }
                else if (n.config.family === 'web-scout') { add('research', m.researchAccuracy * 100); add('coordination', m.comparison * 100); }
                else if (n.config.family === 'ensemble-lab') { add('creative', m.pitchAccuracy * 100); add('coordination', Math.max(0, m.synchrony * 100 - m.cueErrors * 10 - m.timingErrors * 10)); }
                else if (n.config.family === 'stream-studio') { add('creative', m.segments / 3 * 100); add('research', Math.min(100, m.sourceReferences * 25)); add('coordination', Math.max(0, m.coordination / 18 * 100 - m.missedCues * 10)); }
                else { add('creative', m.precision); add('coordination', m.coordination / 6 * 100); add('recovery', Math.max(0, 100 - m.envelopeViolations * 20)); }
            }
        }
        const result = emptyMeasures();
        for (const key of CIRCUIT_METRICS) if (samples[key]?.length) result[key] = bounded(samples[key]!.reduce((s, n) => s + n, 0) / samples[key]!.length);
        return [team.id, result];
    }));
}
export function standings(season: CircuitSeason, events: CircuitEvent[], partition: CircuitEvent['partition'] = 'CAREER') {
    const eligible = events.filter(e => e.seasonHash === season.digest && e.partition === partition && e.ending === 'COMPLETE');
    return season.teams.map(team => {
        const measurements = emptyMeasures();
        for (const key of CIRCUIT_METRICS) { const rows = eligible.flatMap(e => e.measures[team.id][key] === null ? [] : [e.measures[team.id][key]!]); if (rows.length) measurements[key] = bounded(rows.reduce((s, n) => s + n, 0) / rows.length); }
        const points = eligible.reduce((s, e) => { const values = Object.values(e.measures[team.id]).filter((n): n is number => n !== null); return s + (values.length ? values.reduce((a, n) => a + n, 0) / values.length : 0); }, 0);
        return { teamId: team.id, title: team.title, events: eligible.length, points: Math.round(points * 100) / 100, measures: measurements };
    }).sort((a, b) => b.points - a.points || a.teamId.localeCompare(b.teamId));
}
export function generalizationMatrix(season: CircuitSeason, events: CircuitEvent[]) {
    return season.spec.rounds.map(round => ({ family: round.family, roundId: round.id, partitions: Object.fromEntries(['TRAIN', 'HOLDOUT', 'TRANSFER'].map(p => {
        const samples = events.filter(e => e.roundId === round.id && e.partition === p && e.ending === 'COMPLETE').flatMap(e => Object.values(e.measures).map(m => { const n = Object.values(m).filter((v): v is number => v !== null); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : 0; }));
        const mean = samples.length ? samples.reduce((s, n) => s + n, 0) / samples.length : null;
        return [p, { count: samples.length, mean, minimum: samples.length ? Math.min(...samples) : null, maximum: samples.length ? Math.max(...samples) : null, variance: mean === null ? null : samples.reduce((s, n) => s + (n - mean) ** 2, 0) / samples.length }];
    })) }));
}
