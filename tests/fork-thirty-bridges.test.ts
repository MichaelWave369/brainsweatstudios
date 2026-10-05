import { describe, expect, it } from 'vitest';
import {
  bridgeContracts,
  bridgeManifests,
  createBridgeRequest,
  forkThirty,
} from '../src/fork-thirty';

describe('Fork-Thirty bridge contracts', () => {
  it('declares the five ecosystem seams without binding a transport', () => {
    expect(bridgeManifests.map(bridge => bridge.id)).toEqual([
      'commonline',
      'domistika',
      'auralith',
      'infinite-porch',
      'phios',
    ]);
    expect(bridgeContracts.map(contract => contract.bridgeId)).toEqual(
      bridgeManifests.map(bridge => bridge.id),
    );
    expect(bridgeContracts.every(contract => contract.binding === 'unbound')).toBe(true);
    expect(bridgeContracts.every(contract => contract.activation === 'operator-only')).toBe(true);
  });

  it('keeps all bridge mutations proposal-only and grants no authority', () => {
    expect(bridgeContracts.every(contract => contract.mutationPolicy === 'proposal-only')).toBe(true);
    expect(bridgeManifests.every(bridge => bridge.status === 'interface-only')).toBe(true);
    expect(bridgeManifests.every(bridge => bridge.authority.length === 0)).toBe(true);
    expect(forkThirty.features.bridgeRuntime).toBe(false);
  });

  it('only declares operations backed by advertised capabilities', () => {
    const manifests = new Map(bridgeManifests.map(bridge => [bridge.id, bridge]));
    for (const contract of bridgeContracts) {
      const manifest = manifests.get(contract.bridgeId);
      expect(manifest).toBeDefined();
      for (const operation of contract.operations) {
        expect(manifest?.capabilities).toContain(operation.capability);
      }
    }
  });

  it('creates a versioned proposal envelope without executing a bridge', () => {
    const request = createBridgeRequest({
      requestId: 'req-001',
      bridgeId: 'domistika',
      agentId: 'spark',
      capability: 'visual-assets',
      operation: 'visual.plan',
      payload: { brief: 'nested gear study' },
    });

    expect(request).toEqual({
      schema: 'fork-thirty-bridge-request@1',
      requestId: 'req-001',
      bridgeId: 'domistika',
      agentId: 'spark',
      capability: 'visual-assets',
      operation: 'visual.plan',
      payload: { brief: 'nested gear study' },
    });
  });

  it('rejects undeclared bridge operations at the contract boundary', () => {
    expect(() => createBridgeRequest({
      requestId: 'req-002',
      bridgeId: 'commonline',
      agentId: 'ping',
      capability: 'comms',
      operation: 'world.write',
      payload: {},
    })).toThrow(/not declared/);
  });
});
