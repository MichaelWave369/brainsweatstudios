import { describe, expect, it } from 'vitest';
import {
  agents,
  bindCastLocalModel,
  createCastPassport,
  createLocalModelBinding,
  forkThirty,
  isForkThirtyPassport,
} from '../src/fork-thirty';
import { validatePassport } from '../src/career/validation';
import { CIRCUIT_FAMILIES } from '../src/circuit/types';

describe('Fork-Thirty governed local-model runtime', () => {
  it('turns every resident into a valid runnable Circuit passport without authority', () => {
    for (const resident of agents) {
      const passport = createCastPassport(resident.id);
      expect(validatePassport(passport)).toEqual(passport);
      expect(passport.id).toBe(resident.id);
      expect(passport.displayName).toBe(resident.displayName);
      expect(passport.publicCapabilities).toContain('family-artifacts');
      expect(CIRCUIT_FAMILIES.every(world => passport.compatibleWorlds.includes(world))).toBe(true);
      expect(resident.authority).toEqual([]);
      expect(isForkThirtyPassport(passport)).toBe(true);
    }
  });

  it('creates an operator-selected loopback binding that stores no endpoint, token or authority', () => {
    const binding = createLocalModelBinding('sal', 'qwen3.6:latest');
    expect(binding).toMatchObject({
      schema: 'fork-thirty-local-model-binding@1',
      agentId: 'sal',
      provider: 'ollama',
      model: 'qwen3.6:latest',
      transport: 'loopback-agent-bridge',
      policy: 'proposal-only',
      context: 'BOUNDED_NOTEBOOK',
      authority: [],
    });
    const encoded = JSON.stringify(binding);
    expect(encoded).not.toContain('127.0.0.1');
    expect(encoded).not.toContain('localhost');
    expect(encoded).not.toContain('token');
  });

  it('binds both native-world and garage controllers to the selected local model', () => {
    const passport = createCastPassport('al');
    const bound = bindCastLocalModel(passport, createLocalModelBinding('al', 'gemma4:latest', {
      context: 'STATE_ONLY',
      requestBudget: 256,
      timeoutMs: 12000,
      temperature: 0,
      seed: 369,
    }));

    expect(bound.controller.world).toMatchObject({
      family: 'model',
      provider: 'ollama',
      model: 'gemma4:latest',
      context: 'STATE_ONLY',
      requestBudget: 256,
      timeoutMs: 12000,
      temperature: 0,
      seed: 369,
    });
    expect(bound.controller.garage).toMatchObject({
      family: 'model',
      provider: 'ollama',
      model: 'gemma4:latest',
    });
    expect(bound.controller.garage.settings).toMatchObject({ temperature: 0, seed: 369, format: 'schema' });
  });

  it('rejects unknown residents, invalid model identifiers and cross-identity binding', () => {
    expect(() => createCastPassport('outsider')).toThrow(/Unknown Fork-Thirty resident/);
    expect(() => createLocalModelBinding('sal', 'bad model id')).toThrow(/valid local model identifier/);
    const al = createCastPassport('al');
    const salBinding = createLocalModelBinding('sal', 'qwen3.6:latest');
    expect(() => bindCastLocalModel(al, salBinding)).toThrow(/must match/);
  });

  it('keeps local-model runtime active while society consumes services without opening external bridges', () => {
    expect(forkThirty.features.localModelRuntime).toBe(true);
    expect(forkThirty.features.bridgeRuntime).toBe(false);
    expect(forkThirty.features.persistentServices).toBe(true);
    expect(forkThirty.features.societyLayer).toBe(true);
  });
});
