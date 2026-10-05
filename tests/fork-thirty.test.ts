import { describe, expect, it } from 'vitest';
import { agents, bridges, canExerciseAuthority, forkThirty } from '../src/fork-thirty';

describe('Fork-Thirty foundation', () => {
  it('pins the exact BrainSweat V12 lineage', () => {
    expect(forkThirty.lineage).toEqual({
      upstream: 'larrinamsalva/brainsweatstudios',
      baselineCommit: '91c697a06d74c328d7425b63bd55e32932340788',
      baselineVersion: '12.0.0',
    });
    expect(forkThirty.invariant).toBe('Agents propose. The world decides.');
  });

  it('starts all experimental runtime features disabled', () => {
    expect(Object.values(forkThirty.features).every(value => value === false)).toBe(true);
  });

  it('declares bridge seams without silently integrating external systems', () => {
    expect(bridges.length).toBeGreaterThan(0);
    expect(bridges.every(bridge => bridge.status === 'interface-only')).toBe(true);
    expect(bridges.every(bridge => bridge.authority.length === 0)).toBe(true);
  });

  it('keeps capability separate from authority', () => {
    const capableWithoutAuthority = {
      schema: 'fork-thirty-agent@1' as const,
      id: 'probe',
      displayName: 'Probe',
      role: 'test',
      capabilities: ['world.write'],
      authority: [],
    };
    expect(canExerciseAuthority(capableWithoutAuthority, 'world', 'world.write')).toBe(false);
  });

  it('starts with an empty cast registry for the next rung', () => {
    expect(agents).toEqual([]);
  });
});
