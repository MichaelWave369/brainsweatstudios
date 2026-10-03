import { describe, expect, it } from 'vitest';
import { AGENT_IDS, workedPolicy, type PolicyRule } from '../src/games/rung4/models';
import { assess, better, evaluateRover, freshAcademy, Q_ROWS, roverFresh, runRover, searchGeneration, splitSeeds, trainRover, validateAcademy } from '../src/training/models';
import { freshSave, validateSave } from '../src/systems/progress';

describe('agent academy', () => {
  it('separates training seeds and frozen evaluation seeds for every curriculum', () => {
    for (let seed = 0; seed <= 99; seed++) expect(splitSeeds(seed).some(s => splitSeeds(seed, true).includes(s))).toBe(false);
    for (const kind of AGENT_IDS) for (let stage = 0; stage < 3; stage++) {
      const result = assess(kind, workedPolicy(kind), stage, splitSeeds(42, true));
      expect(result.successes, `${kind} stage ${stage}`).toBe(8); expect(result.trials.every(e => e.ticks <= 120)).toBe(true);
    }
  });
  it('search discovers a successful controller from an incomplete policy without regressing training results', () => {
    for (const kind of AGENT_IDS) {
      let rules: PolicyRule[] = [{ when: 'always', action: 'approach' }], previous = assess(kind, rules, 1, splitSeeds(3));
      for (let i = 0; i < 6; i++) {
        const next = searchGeneration(kind, rules, 1, 3);
        expect(better(previous, next.report)).toBe(false); rules = next.champion; previous = next.report;
      }
      expect(previous.successes, kind).toBe(8); expect(assess(kind, rules, 1, splitSeeds(3, true)).successes, kind).toBe(8);
    }
  });
  it('Q-learning improves a courier through reward updates; evaluation does not change its learned values', () => {
    let rover = roverFresh(); const baseline = evaluateRover(rover);
    for (let i = 0; i < 40; i++) rover = trainRover(rover, 25);
    const before = JSON.stringify(rover), result = evaluateRover(rover);
    expect(result.successes).toBeGreaterThan(baseline.successes); expect(result.successes).toBeGreaterThanOrEqual(18);
    expect(JSON.stringify(rover)).toBe(before); expect(rover.q.some(row => row.some(v => v !== 0))).toBe(true);
    expect(result.trials.every(e => e.tick <= 80 && e.trace.length === e.tick)).toBe(true);
  });
  it('training is reproducible, and windy episodes remain bounded', () => {
    let a = roverFresh('storm'), b = roverFresh('storm');
    for (let i = 0; i < 12; i++) { a = trainRover(a, 25); b = trainRover(b, 25); }
    expect(a).toEqual(b); expect(runRover(a, 20001).tick).toBeLessThanOrEqual(80);
  });
  it('migrates older saves and roundtrips learning without changing player rewards', () => {
    const save = freshSave(); save.academy.rover = trainRover(save.academy.rover);
    const next = validateSave(JSON.parse(JSON.stringify(save))); expect(next.academy).toEqual(save.academy); expect(next.xp).toBe(0);
    const old = { ...save, academy: undefined }; expect(validateSave(old).academy).toEqual(freshAcademy());
  });
  it('rejects malformed, unbounded, and nonfinite learning data before replacing a save', () => {
    expect(() => validateAcademy({ ...freshAcademy(), extra: true })).toThrow();
    for (const value of [NaN, Infinity, 1000]) {
      const save = freshAcademy(); save.rover.q[0][0] = value; expect(() => validateAcademy(save)).toThrow();
    }
    const short = freshAcademy(); short.rover.q.pop(); expect(short.rover.q.length).toBe(Q_ROWS - 1); expect(() => validateAcademy(short)).toThrow();
  });
});
