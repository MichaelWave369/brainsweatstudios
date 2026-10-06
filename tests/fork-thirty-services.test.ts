import { describe, expect, it } from 'vitest';
import {
  SERVICE_MEMORY_LIMIT,
  createAgentServiceDirectory,
  createAgentServiceState,
  decodeAgentServiceDirectory,
  encodeAgentServiceDirectory,
  forkThirty,
  proposeAgentHandoff,
  rememberAgentService,
  replaceAgentService,
  resolveAgentHandoff,
  transitionAgentService,
} from '../src/fork-thirty';

function ready(agentId: string) {
  let state = createAgentServiceState(agentId);
  state = transitionAgentService(state, { type: 'START', actor: 'operator' });
  return transitionAgentService(state, { type: 'READY', actor: 'service' });
}

describe('Fork-Thirty persistent service substrate', () => {
  it('creates one stopped, offline service for every resident', () => {
    const directory = createAgentServiceDirectory();
    expect(directory.services).toHaveLength(10);
    expect(directory.services.every(service => service.status === 'STOPPED')).toBe(true);
    expect(directory.services.every(service => service.presence === 'OFFLINE')).toBe(true);
    expect(new Set(directory.services.map(service => service.agentId)).size).toBe(10);
  });

  it('runs a deterministic operator/service lifecycle with receipts', () => {
    let al = createAgentServiceState('al');
    al = transitionAgentService(al, { type: 'START', actor: 'operator' });
    expect([al.status, al.presence]).toEqual(['STARTING', 'OFFLINE']);

    al = transitionAgentService(al, { type: 'READY', actor: 'service' });
    expect([al.status, al.presence]).toEqual(['READY', 'AVAILABLE']);

    al = transitionAgentService(al, { type: 'BEGIN', actor: 'service', taskRef: 'mission:town-zero:brief' });
    expect([al.status, al.presence, al.activeTaskRef]).toEqual(['BUSY', 'BUSY', 'mission:town-zero:brief']);

    al = transitionAgentService(al, { type: 'PAUSE', actor: 'operator' });
    expect([al.status, al.presence, al.activeTaskRef]).toEqual(['PAUSED', 'PAUSED', 'mission:town-zero:brief']);

    al = transitionAgentService(al, { type: 'RESUME', actor: 'operator' });
    expect(al.status).toBe('BUSY');

    al = transitionAgentService(al, { type: 'IDLE', actor: 'service' });
    expect([al.status, al.activeTaskRef]).toEqual(['READY', null]);

    al = transitionAgentService(al, { type: 'STOP', actor: 'operator' });
    expect([al.status, al.presence, al.activeTaskRef]).toEqual(['STOPPED', 'OFFLINE', null]);
    expect(al.lifecycle.map(receipt => receipt.command)).toEqual([
      'START',
      'READY',
      'BEGIN',
      'PAUSE',
      'RESUME',
      'IDLE',
      'STOP',
    ]);
    expect(al.lifecycle.map(receipt => receipt.id)).toEqual(
      al.lifecycle.map((_, index) => `lifecycle:al:${index + 1}`),
    );
  });

  it('rejects invalid lifecycle transitions instead of repairing them silently', () => {
    const stopped = createAgentServiceState('sal');
    expect(() => transitionAgentService(stopped, { type: 'READY', actor: 'service' })).toThrow(
      /Invalid service transition/,
    );
    expect(stopped.status).toBe('STOPPED');
    expect(stopped.revision).toBe(0);
  });

  it('rejects malformed runtime commands with the wrong actor even if JavaScript bypasses types', () => {
    const stopped = createAgentServiceState('al');
    const malformed = { type: 'START', actor: 'service' } as unknown as Parameters<typeof transitionAgentService>[1];
    expect(() => transitionAgentService(stopped, malformed)).toThrow(/START requires operator authority/);
    expect(stopped).toMatchObject({ status: 'STOPPED', revision: 0, logicalTick: 0 });
  });

  it('keeps service-local memory bounded and deterministic', () => {
    let cache = ready('cache');
    for (let index = 0; index < SERVICE_MEMORY_LIMIT + 3; index++) {
      cache = rememberAgentService(cache, {
        id: `memory-${index}`,
        scope: 'career',
        summary: `Verified local note ${index}`,
        sourceRef: `receipt:${index}`,
      });
    }

    expect(cache.memory).toHaveLength(SERVICE_MEMORY_LIMIT);
    expect(cache.memory[0].id).toBe('memory-3');
    expect(cache.memory.at(-1)?.id).toBe(`memory-${SERVICE_MEMORY_LIMIT + 2}`);
    expect(cache.memory.every(record => record.agentId === 'cache')).toBe(true);
  });

  it('records handoffs as proposals and requires operator resolution', () => {
    let sal = ready('sal');
    sal = transitionAgentService(sal, { type: 'BEGIN', actor: 'service', taskRef: 'plan:restore-grid' });
    sal = proposeAgentHandoff(sal, {
      toAgentId: 'patch',
      taskRef: 'repair:relay-4',
      note: 'Inspect the replay before proposing a repair.',
    });

    const handoffId = sal.handoffs[0].id;
    expect(sal.handoffs[0]).toMatchObject({
      fromAgentId: 'sal',
      toAgentId: 'patch',
      status: 'PROPOSED',
    });

    sal = resolveAgentHandoff(sal, { handoffId, outcome: 'ACCEPTED', actor: 'operator' });
    expect(sal.handoffs[0].status).toBe('ACCEPTED');
    sal = resolveAgentHandoff(sal, { handoffId, outcome: 'COMPLETED', actor: 'operator' });
    expect(sal.handoffs[0].status).toBe('COMPLETED');

    const serialized = JSON.stringify(sal.handoffs[0]);
    expect(serialized).not.toContain('authority');
    expect(serialized).not.toContain('grant');
  });

  it('round-trips the whole service directory and rejects tampered presence', () => {
    let directory = createAgentServiceDirectory();
    let ping = ready('ping');
    ping = rememberAgentService(ping, {
      id: 'presence-note',
      scope: 'episode',
      summary: 'Commonline remains unbound; presence is local service state only.',
    });
    directory = replaceAgentService(directory, ping);

    const encoded = encodeAgentServiceDirectory(directory);
    const restored = decodeAgentServiceDirectory(encoded);
    expect(restored).toEqual(directory);
    expect(encodeAgentServiceDirectory(restored)).toBe(encoded);

    const tampered = JSON.parse(encoded);
    tampered.services[0].presence = 'BUSY';
    expect(() => decodeAgentServiceDirectory(JSON.stringify(tampered))).toThrow(
      /presence does not match/,
    );
  });

  it('activates persistent services when the society layer begins consuming them', () => {
    expect(forkThirty.features.persistentServices).toBe(true);
  });
});
