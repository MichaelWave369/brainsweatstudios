import { describe, expect, it } from 'vitest';
import { AGENT_IDS, arenaScore, arenaStart, arenaStep, circuit, cutPiece, damagedLines, electricStart, fireExit, fireLayers, fireMove, fireObstacles, fireStart, frameFits, lineAction, lineStart, roadDecision, roadEvent, roadReady, roadStart, routeMoves, runEpisode, stoppingDistance, tradeBrief, tradeStart, truckChecks, truckReady, truckStart, waterSafetyEvent, workedPolicy } from '../src/games/rung4/models';

describe('driving and trade teaching models', () => {
  it('separates reaction distance from the square-law braking distance', () => {
    const a = stoppingDistance(20, 1, false), b = stoppingDistance(40, 1, false);
    expect(a.reaction).toBeCloseTo(8.9408); expect(b.reaction).toBeCloseTo(a.reaction * 2); expect(b.braking).toBeCloseTo(a.braking * 4);
    expect(stoppingDistance(20, 1, true).total).toBeGreaterThan(a.total);
    expect(roadReady({ ...roadStart(), speed: 25, reaction: 1, gap: 80 })).toBe(true);
    expect(roadReady({ ...roadStart(), speed: 50, gap: 200 })).toBe(false);
  });
  it('requires correction before a risky road decision advances', () => {
    for (let mission = 0; mission < 8; mission++) {
      let s = { ...roadStart(), started: true };
      const wrong = roadDecision(s, (roadEvent(mission, 0).correct + 1) % 3, mission); expect(wrong.phase).toBe(0); expect(wrong.risks).toBe(1);
      for (let phase = 0; phase < 4; phase++) s = roadDecision(s, roadEvent(mission, phase).correct, mission);
      expect(s.phase).toBe(4); expect(roadDecision(s, 0, mission)).toBe(s);
    }
  });
  it('holds a truck until defects, simulated loading, and service clearance are addressed', () => {
    const ready = { ...truckStart(), checks: [...truckChecks], faultReported: true, cleared: true, secured: true, front: 12, rear: 12 };
    for (let m = 0; m < 8; m++) for (let d = 0; d < 3; d++) expect(truckReady(ready, m, d)).toBe(true);
    expect(truckReady({ ...ready, cleared: false }, 0, 0)).toBe(false); expect(truckReady({ ...ready, rear: 24 }, 0, 0)).toBe(false);
  });
  it('accounts for kerf and dimensional tolerance across all frame briefs', () => {
    for (let m = 0; m < 8; m++) for (let d = 0; d < 3; d++) {
      const brief = tradeBrief(m, d); let s = tradeStart();
      for (const length of [brief.width, brief.height, brief.width, brief.height]) s = cutPiece({ ...s, length, measured: true }, brief);
      expect(frameFits(s, brief)).toBe(true); expect(s.used).toBe(2 * (brief.width + brief.height) + 8); expect(s.used).toBeLessThan(brief.stock);
      expect(frameFits({ ...s, pieces: s.pieces.map((p, i) => i === 0 ? p + brief.tolerance + 0.1 : p) }, brief)).toBe(false);
    }
    expect(cutPiece(tradeStart(), tradeBrief(0, 0)).pieces).toEqual([]);
  });
  it('rejects out-of-order restoration and preserves other line branches', () => {
    const faults = damagedLines(3, 2); let s = lineStart();
    s = { ...s, selected: faults[0] }; const unsafe = lineAction(s, 6, faults); expect(unsafe.stages).toEqual(s.stages); expect(unsafe.risks).toBe(1);
    for (const node of faults) { s = { ...s, selected: node }; for (let action = 0; action < 7; action++) s = lineAction(s, action, faults); }
    expect(faults.every(n => s.stages[n] === 7)).toBe(true); expect(s.stages.filter(n => n === 0)).toHaveLength(3);
  });
  it('satisfies Ohm’s law and trips an undersized virtual protection device', () => {
    const config = electricStart().config;
    const series = circuit({ ...config, mode: 'series', r1: 6, r2: 6 }); expect(series.current).toBe(1); expect(series.power).toBe(12);
    const parallel = circuit({ ...config, r1: 6, r2: 6 }); expect(parallel.resistance).toBe(3); expect(parallel.current).toBe(4); expect(parallel.branch1 + parallel.branch2).toBe(parallel.current); expect(parallel.tripped).toBe(true);
  });
});

describe('safe scenario boundaries', () => {
  it('has a clear alternate fire route in every authored floor plan', () => {
    for (let mission = 0; mission < 8; mission++) {
      const exit = fireExit(mission), route = routeMoves([1, 4], [exit.x, exit.y], fireObstacles(mission), 8, 6); expect(route.length).toBeGreaterThan(0);
      let s = { ...fireStart(), layers: [...fireLayers] }; for (const move of route) s = fireMove(s, move, mission);
      expect(s.outside).toBe(true); expect(s.risks).toBe(0); expect(fireMove(s, 'south', mission)).toBe(s);
    }
    expect(fireMove(fireStart(), 'north', 0)).toEqual(fireStart());
  });
  it('keeps prevention, shore assistance, and trained response as distinct decisions', () => {
    for (let m = 0; m < 8; m++) { expect(waterSafetyEvent(m, 0).correct).toBe(0); expect(waterSafetyEvent(m, 1).correct).toBe(1); expect(waterSafetyEvent(m, 2).correct).toBe(2); }
  });
});

describe('bounded agent training episodes', () => {
  for (const kind of AGENT_IDS) it(`${kind}: the worked policy completes all 24 briefs with finite replay traces`, () => {
    for (let seed = 0; seed < 8; seed++) for (let d = 0; d < 3; d++) {
      const result = runEpisode(arenaStart(kind, seed, d), workedPolicy(kind));
      expect(result.status, `${kind}, ${seed}, ${d}`).toBe('complete'); expect(arenaScore(result)).toBe(100); expect(result.tick).toBeLessThanOrEqual(120);
      expect(result.trace).toHaveLength(result.tick); expect(result.trace.every(t => [t.x, t.y, t.energy, t.water].every(Number.isFinite))).toBe(true);
      expect(runEpisode(arenaStart(kind, seed, d), workedPolicy(kind))).toEqual(result);
    }
  });
  it('stops idle, out-of-fuel, and non-docking policies without unbounded execution', () => {
    for (const kind of AGENT_IDS) { const result = runEpisode(arenaStart(kind, 2), []); expect(result.status).not.toBe('complete'); expect(result.tick).toBeLessThanOrEqual(120); expect(arenaScore(result)).toBeLessThanOrEqual(50); }
    const moving = arenaStep(arenaStart('space', 1), 'interact'); expect(moving.status).not.toBe('complete');
  });
  it('blocks a sports move without placing the agent outside the grid', () => {
    const result = arenaStep(arenaStart('sports', 0), 'west'); expect(result.x).toBe(0); expect(result.collisions).toBe(1);
  });
});
