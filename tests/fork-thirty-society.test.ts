import { describe, expect, it } from 'vitest';
import {
  acceptSocietyAssignment,
  addSocietyInstitution,
  assignSocietyProposal,
  claimSocietyService,
  commandSocietyService,
  completeSocietyAssignment,
  completeSocietyService,
  createSocietyState,
  createStarterSociety,
  decideSocietyProposal,
  decodeSocietyState,
  encodeSocietyState,
  endorseSocietyProposal,
  enqueueSocietyService,
  forkThirty,
  loadSocietyState,
  saveSocietyState,
  societyAuditTrail,
  societyBridgeReadiness,
  runSocietyRedTeam,
  submitSocietyProposal,
  validateSocietyState,
} from '../src/fork-thirty';

function ready(state: ReturnType<typeof createSocietyState>, agentId: string) {
  let next = commandSocietyService(state, agentId, { type: 'START', actor: 'operator' });
  next = commandSocietyService(next, agentId, { type: 'READY', actor: 'service' });
  return next;
}

describe('Fork-Thirty society layer', () => {
  it('creates three bounded starter institutions with zero authority', () => {
    const state = createStarterSociety(createSocietyState());
    expect(state.institutions.map(group => group.id)).toEqual([
      'mission-council',
      'evidence-shop',
      'systems-guild',
    ]);
    expect(state.institutions.every(group => group.authority.length === 0)).toBe(true);
    expect(state.institutions.flatMap(group => group.members).map(member => member.agentId).sort()).toEqual([
      'al',
      'brian-sweat',
      'cache',
      'coreglow',
      'flux',
      'oilleak',
      'patch',
      'ping',
      'sal',
      'spark',
    ]);
  });

  it('requires quorum plus operator approval while never manufacturing authority', () => {
    let state = createStarterSociety(createSocietyState());
    state = ready(state, 'sal');
    state = ready(state, 'al');
    state = ready(state, 'brian-sweat');

    state = submitSocietyProposal(state, {
      institutionId: 'mission-council',
      proposerId: 'sal',
      summary: 'Run a bounded Town Zero restoration comparison.',
      taskRef: 'circuit:town-zero:restore-grid',
      requestedAuthority: { scope: 'world', action: 'world.write' },
    });
    const proposalId = state.proposals[0].id;
    expect(state.proposals[0]).toMatchObject({
      status: 'OPEN',
      endorsements: ['sal'],
      authorityGranted: false,
    });
    expect(() => decideSocietyProposal(state, proposalId, { actor: 'operator', decision: 'APPROVE' })).toThrow(/quorum/);

    state = endorseSocietyProposal(state, proposalId, 'al');
    expect(state.proposals[0].status).toBe('ENDORSED');

    state = decideSocietyProposal(state, proposalId, { actor: 'operator', decision: 'APPROVE' });
    expect(state.proposals[0]).toMatchObject({
      status: 'OPERATOR_APPROVED',
      operatorDecision: 'APPROVED',
      authorityGranted: false,
      requestedAuthority: { scope: 'world', action: 'world.write' },
    });

    const encoded = JSON.stringify(state.proposals[0]);
    expect(encoded).not.toContain('"authorityGranted":true');
  });

  it('assigns approved work through resident services and completes only with a receipt', () => {
    let state = createStarterSociety(createSocietyState());
    state = ready(state, 'sal');
    state = ready(state, 'al');
    state = ready(state, 'brian-sweat');
    state = submitSocietyProposal(state, {
      institutionId: 'mission-council',
      proposerId: 'sal',
      summary: 'Compare the same seed across bounded controllers.',
      taskRef: 'circuit:season-1:round-2',
    });
    const proposalId = state.proposals[0].id;
    state = endorseSocietyProposal(state, proposalId, 'al');
    state = decideSocietyProposal(state, proposalId, { actor: 'operator', decision: 'APPROVE' });
    state = assignSocietyProposal(state, proposalId, { actor: 'operator', assigneeId: 'brian-sweat' });
    const assignmentId = state.assignments[0].id;

    state = acceptSocietyAssignment(state, assignmentId, 'brian-sweat');
    expect(state.assignments[0].status).toBe('ACCEPTED');
    expect(state.services.services.find(service => service.agentId === 'brian-sweat')?.status).toBe('BUSY');

    state = completeSocietyAssignment(state, assignmentId, {
      agentId: 'brian-sweat',
      receiptRef: 'circuit-receipt:season-1:round-2:abc123',
    });
    expect(state.assignments[0]).toMatchObject({
      status: 'COMPLETED',
      receiptRef: 'circuit-receipt:season-1:round-2:abc123',
    });
    expect(state.proposals[0]).toMatchObject({
      status: 'COMPLETED',
      receiptRef: 'circuit-receipt:season-1:round-2:abc123',
    });
    expect(state.services.services.find(service => service.agentId === 'brian-sweat')?.status).toBe('READY');
    expect(state.memory.at(-1)).toMatchObject({
      institutionId: 'mission-council',
      origin: 'RECEIPT',
      sourceRef: 'circuit-receipt:season-1:round-2:abc123',
    });
  });

  it('routes shared service work by declared capability instead of status or personality', () => {
    let state = createStarterSociety(createSocietyState());
    state = ready(state, 'patch');
    state = ready(state, 'sal');

    state = enqueueSocietyService(state, {
      institutionId: 'evidence-shop',
      requestedBy: 'cache',
      kind: 'RECOVERY',
      taskRef: 'replay:inspect:failure-7',
    });
    const requestId = state.queue[0].id;

    expect(() => claimSocietyService(state, requestId, 'sal')).toThrow(/does not advertise/);
    state = claimSocietyService(state, requestId, 'patch');
    expect(state.queue[0]).toMatchObject({ status: 'CLAIMED', assignedTo: 'patch' });
    expect(state.services.services.find(service => service.agentId === 'patch')?.status).toBe('BUSY');

    state = completeSocietyService(state, requestId, {
      agentId: 'patch',
      receiptRef: 'replay-receipt:failure-7:fixed',
    });
    expect(state.queue[0]).toMatchObject({
      status: 'COMPLETED',
      receiptRef: 'replay-receipt:failure-7:fixed',
    });
    expect(state.memory.at(-1)).toMatchObject({
      institutionId: 'evidence-shop',
      origin: 'RECEIPT',
    });
  });

  it('round-trips isolated society persistence and rejects authority tampering', () => {
    const state = createStarterSociety(createSocietyState());
    const raw = encodeSocietyState(state);
    expect(decodeSocietyState(raw)).toEqual(state);

    const memory = new Map<string, string>();
    const storage = {
      getItem(key: string) { return memory.get(key) ?? null; },
      setItem(key: string, value: string) { memory.set(key, value); },
    };
    saveSocietyState(state, storage);
    expect(loadSocietyState(storage)).toEqual(state);

    const tampered = JSON.parse(raw);
    tampered.institutions[0].authority = [{ scope: 'world', actions: ['world.write'], source: 'operator-grant' }];
    expect(() => validateSocietyState(tampered)).toThrow(/cannot manufacture authority/);
  });

  it('rejects a forged proposal that claims society approval granted authority', () => {
    let state = createStarterSociety(createSocietyState());
    state = ready(state, 'sal');
    state = submitSocietyProposal(state, {
      institutionId: 'mission-council',
      proposerId: 'sal',
      summary: 'Request a bounded inspection.',
      taskRef: 'inspect:town-zero',
    });
    const forged = JSON.parse(encodeSocietyState(state));
    forged.proposals[0].authorityGranted = true;
    expect(() => validateSocietyState(forged)).toThrow(/cannot grant authority/);
  });

  it('activates society and persistent services while keeping external bridges closed', () => {
    expect(forkThirty.features).toEqual({
      castRuntime: true,
      bridgeRuntime: false,
      persistentServices: true,
      localModelRuntime: true,
      societyLayer: true,
    });
  });

  it('blocks the society red-team attack matrix before bridge activation', () => {
    const result = runSocietyRedTeam();
    expect(result.passed).toBe(true);
    expect(result.attacks).toHaveLength(9);
    expect(result.attacks.every(attack => attack.blocked)).toBe(true);
    expect(result.attacks.map(attack => attack.id)).toEqual([
      'forged-membership',
      'fake-quorum',
      'replayed-operator-approval',
      'duplicate-completion-receipt',
      'stale-assignment',
      'service-impersonation',
      'malicious-receipt-memory',
      'cross-institution-assignment',
      'authority-escalation',
    ]);
  });

  it('derives an inspectable proposal-to-receipt audit transcript without inventing authority', () => {
    let state = createStarterSociety(createSocietyState());
    state = ready(state, 'sal');
    state = ready(state, 'al');
    state = ready(state, 'brian-sweat');
    state = submitSocietyProposal(state, {
      institutionId: 'mission-council',
      proposerId: 'sal',
      summary: 'Audit a bounded Circuit run.',
      taskRef: 'circuit:audit:round-1',
    });
    const proposalId = state.proposals[0].id;
    state = endorseSocietyProposal(state, proposalId, 'al');
    state = decideSocietyProposal(state, proposalId, { actor: 'operator', decision: 'APPROVE' });
    state = assignSocietyProposal(state, proposalId, { actor: 'operator', assigneeId: 'brian-sweat' });
    state = acceptSocietyAssignment(state, state.assignments[0].id, 'brian-sweat');
    state = completeSocietyAssignment(state, state.assignments[0].id, {
      agentId: 'brian-sweat',
      receiptRef: 'receipt:audit:round-1',
    });

    const trail = societyAuditTrail(state);
    expect(trail.map(row => row.stage)).toEqual([
      'PROPOSED',
      'ENDORSED',
      'OPERATOR_APPROVED',
      'ASSIGNED',
      'ACCEPTED',
      'COMPLETED',
    ]);
    expect(trail.map(row => row.actor)).toEqual([
      'sal',
      'al',
      'operator',
      'operator',
      'brian-sweat',
      'brian-sweat',
    ]);
    expect(trail.at(-1)?.receiptRef).toBe('receipt:audit:round-1');
    expect(trail.every(row => row.authorityGranted === false)).toBe(true);
  });

  it('reports bridge contracts ready for adapter work while activation stays blocked', () => {
    const readiness = societyBridgeReadiness();
    expect(readiness.contractReady).toBe(true);
    expect(readiness.activationReady).toBe(false);
    expect(readiness.bridgeRuntimeEnabled).toBe(false);
    expect(readiness.bridges).toHaveLength(5);
    expect(readiness.bridges.every(bridge =>
      bridge.interfaceOnly &&
      bridge.unbound &&
      bridge.operatorOnly &&
      bridge.proposalOnly &&
      bridge.zeroAuthority
    )).toBe(true);
    expect(readiness.blockers).toContain('No external adapter qualification receipt exists in this rung.');
  });

  it('requires the operator to create institutions', () => {
    const state = createSocietyState();
    const malformed = {
      actor: 'service',
      id: 'rogue-council',
      title: 'Rogue Council',
      kind: 'COUNCIL',
      purpose: 'Attempt to create itself.',
      members: [{ agentId: 'sal', role: 'PLANNER' }],
    } as unknown as Parameters<typeof addSocietyInstitution>[1];
    expect(() => addSocietyInstitution(state, malformed)).toThrow(/operator authority/);
  });
});
