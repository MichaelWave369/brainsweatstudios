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

  it('activates the governed cast, services, local models and society while external bridges remain closed', () => {
    expect(forkThirty.features).toEqual({
      castRuntime: true,
      bridgeRuntime: false,
      persistentServices: true,
      localModelRuntime: true,
      societyLayer: true,
    });
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

  it('registers the ten named Fork-Thirty residents', () => {
    expect(agents.map(agent => agent.id)).toEqual([
      'al',
      'sal',
      'oilleak',
      'coreglow',
      'cache',
      'patch',
      'flux',
      'ping',
      'spark',
      'brian-sweat',
    ]);
    expect(new Set(agents.map(agent => agent.id)).size).toBe(agents.length);
  });

  it('gives the cast capabilities and identity without implicit authority', () => {
    expect(agents.every(agent => agent.capabilities.length > 0)).toBe(true);
    expect(agents.every(agent => agent.authority.length === 0)).toBe(true);
    expect(agents.every(agent => ['episode', 'world', 'career'].includes(agent.defaultMemoryScope))).toBe(true);
    expect(agents.every(agent => ['low', 'guarded', 'elevated'].includes(agent.riskProfile))).toBe(true);
  });

  it('only references registered bridge seams', () => {
    const bridgeIds = new Set(bridges.map(bridge => bridge.id));
    for (const agent of agents) {
      expect(agent.bridgeAffinities.every(id => bridgeIds.has(id))).toBe(true);
    }
  });

  it('activates cast runtime without granting authority', () => {
    expect(forkThirty.features.castRuntime).toBe(true);
    expect(agents.every(agent => agent.authority.length === 0)).toBe(true);
  });
});
