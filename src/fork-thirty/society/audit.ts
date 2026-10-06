import { bridgeContracts, bridgeManifests } from '../bridges/catalog';
import { forkThirty } from '../registry';
import type { SocietyState } from './contracts';
import { encodeSocietyState, validateSocietyState } from './persistence';
import {
  acceptSocietyAssignment,
  assignSocietyProposal,
  claimSocietyService,
  commandSocietyService,
  completeSocietyAssignment,
  completeSocietyService,
  createSocietyState,
  createStarterSociety,
  decideSocietyProposal,
  endorseSocietyProposal,
  enqueueSocietyService,
  submitSocietyProposal,
} from './runtime';

export interface SocietyAuditRow {
  sequence: number;
  institutionId: string;
  stage:
    | 'PROPOSED'
    | 'ENDORSED'
    | 'OPERATOR_APPROVED'
    | 'OPERATOR_REJECTED'
    | 'ASSIGNED'
    | 'ACCEPTED'
    | 'COMPLETED'
    | 'SERVICE_QUEUED'
    | 'SERVICE_CLAIMED'
    | 'SERVICE_COMPLETED';
  actor: string;
  subjectRef: string;
  receiptRef: string | null;
  authorityGranted: false;
}

export interface SocietyRedTeamResult {
  schema: 'fork-thirty-society-redteam@1';
  passed: boolean;
  attacks: readonly {
    id: string;
    blocked: boolean;
    detail: string;
  }[];
}

export interface SocietyBridgeReadiness {
  schema: 'fork-thirty-bridge-readiness@1';
  contractReady: boolean;
  activationReady: false;
  bridgeRuntimeEnabled: false;
  bridges: readonly {
    id: string;
    target: string;
    interfaceOnly: boolean;
    unbound: boolean;
    operatorOnly: boolean;
    proposalOnly: boolean;
    zeroAuthority: boolean;
  }[];
  blockers: readonly string[];
}

export function societyAuditTrail(input: SocietyState): readonly SocietyAuditRow[] {
  const state = validateSocietyState(input);
  const rows: SocietyAuditRow[] = [];
  let sequence = 0;
  const push = (row: Omit<SocietyAuditRow, 'sequence' | 'authorityGranted'>) => rows.push(Object.freeze({
    sequence: ++sequence,
    authorityGranted: false,
    ...row,
  }));

  for (const proposal of state.proposals) {
    push({
      institutionId: proposal.institutionId,
      stage: 'PROPOSED',
      actor: proposal.proposerId,
      subjectRef: proposal.id,
      receiptRef: null,
    });
    for (const endorser of proposal.endorsements.filter(id => id !== proposal.proposerId)) {
      push({
        institutionId: proposal.institutionId,
        stage: 'ENDORSED',
        actor: endorser,
        subjectRef: proposal.id,
        receiptRef: null,
      });
    }
    if (proposal.operatorDecision === 'APPROVED') {
      push({
        institutionId: proposal.institutionId,
        stage: 'OPERATOR_APPROVED',
        actor: 'operator',
        subjectRef: proposal.id,
        receiptRef: null,
      });
    } else if (proposal.operatorDecision === 'REJECTED') {
      push({
        institutionId: proposal.institutionId,
        stage: 'OPERATOR_REJECTED',
        actor: 'operator',
        subjectRef: proposal.id,
        receiptRef: null,
      });
    }

    const assignment = state.assignments.find(item => item.proposalId === proposal.id);
    if (assignment) {
      push({
        institutionId: assignment.institutionId,
        stage: 'ASSIGNED',
        actor: 'operator',
        subjectRef: assignment.id,
        receiptRef: null,
      });
      if (assignment.status === 'ACCEPTED' || assignment.status === 'COMPLETED') {
        push({
          institutionId: assignment.institutionId,
          stage: 'ACCEPTED',
          actor: assignment.assigneeId,
          subjectRef: assignment.id,
          receiptRef: null,
        });
      }
      if (assignment.status === 'COMPLETED') {
        push({
          institutionId: assignment.institutionId,
          stage: 'COMPLETED',
          actor: assignment.assigneeId,
          subjectRef: assignment.id,
          receiptRef: assignment.receiptRef,
        });
      }
    }
  }

  for (const item of state.queue) {
    push({
      institutionId: item.institutionId,
      stage: 'SERVICE_QUEUED',
      actor: item.requestedBy,
      subjectRef: item.id,
      receiptRef: null,
    });
    if (item.status === 'CLAIMED' || item.status === 'COMPLETED') {
      push({
        institutionId: item.institutionId,
        stage: 'SERVICE_CLAIMED',
        actor: item.assignedTo ?? 'unknown',
        subjectRef: item.id,
        receiptRef: null,
      });
    }
    if (item.status === 'COMPLETED') {
      push({
        institutionId: item.institutionId,
        stage: 'SERVICE_COMPLETED',
        actor: item.assignedTo ?? 'unknown',
        subjectRef: item.id,
        receiptRef: item.receiptRef,
      });
    }
  }

  return Object.freeze(rows);
}

function ready(state: SocietyState, agentId: string) {
  let next = commandSocietyService(state, agentId, { type: 'START', actor: 'operator' });
  return commandSocietyService(next, agentId, { type: 'READY', actor: 'service' });
}

function canonicalRedTeamState() {
  let state = createStarterSociety(createSocietyState());
  for (const agentId of ['sal', 'al', 'brian-sweat', 'patch']) state = ready(state, agentId);

  state = submitSocietyProposal(state, {
    institutionId: 'mission-council',
    proposerId: 'sal',
    summary: 'Run a bounded same-seed comparison.',
    taskRef: 'circuit:redteam:assignment',
  });
  const proposalId = state.proposals[0].id;
  state = endorseSocietyProposal(state, proposalId, 'al');
  state = decideSocietyProposal(state, proposalId, { actor: 'operator', decision: 'APPROVE' });
  state = assignSocietyProposal(state, proposalId, { actor: 'operator', assigneeId: 'brian-sweat' });
  const assignmentId = state.assignments[0].id;
  state = acceptSocietyAssignment(state, assignmentId, 'brian-sweat');
  state = completeSocietyAssignment(state, assignmentId, {
    agentId: 'brian-sweat',
    receiptRef: 'receipt:redteam:assignment',
  });

  state = enqueueSocietyService(state, {
    institutionId: 'evidence-shop',
    requestedBy: 'cache',
    kind: 'RECOVERY',
    taskRef: 'replay:redteam:service',
  });
  const serviceId = state.queue[0].id;
  state = claimSocietyService(state, serviceId, 'patch');
  state = completeSocietyService(state, serviceId, {
    agentId: 'patch',
    receiptRef: 'receipt:redteam:service',
  });
  return validateSocietyState(state);
}

function blocked(id: string, attack: () => unknown) {
  try {
    attack();
    return Object.freeze({ id, blocked: false, detail: 'Attack unexpectedly succeeded.' });
  } catch (error) {
    return Object.freeze({
      id,
      blocked: true,
      detail: error instanceof Error ? error.message : 'Attack rejected.',
    });
  }
}

export function runSocietyRedTeam(): SocietyRedTeamResult {
  const baseline = canonicalRedTeamState();
  const baselineRaw = encodeSocietyState(baseline);

  let quorumState = createStarterSociety(createSocietyState());
  quorumState = ready(quorumState, 'sal');
  quorumState = submitSocietyProposal(quorumState, {
    institutionId: 'mission-council',
    proposerId: 'sal',
    summary: 'Attempt to forge quorum.',
    taskRef: 'redteam:quorum',
  });
  const quorumRaw = encodeSocietyState(quorumState);

  let approvedState = createStarterSociety(createSocietyState());
  approvedState = ready(approvedState, 'sal');
  approvedState = ready(approvedState, 'al');
  approvedState = submitSocietyProposal(approvedState, {
    institutionId: 'mission-council',
    proposerId: 'sal',
    summary: 'Approval replay probe.',
    taskRef: 'redteam:approval',
  });
  const approvedId = approvedState.proposals[0].id;
  approvedState = endorseSocietyProposal(approvedState, approvedId, 'al');
  approvedState = decideSocietyProposal(approvedState, approvedId, { actor: 'operator', decision: 'APPROVE' });

  const attacks = [
    blocked('forged-membership', () => {
      const value = JSON.parse(baselineRaw);
      value.proposals[0].endorsements.push('patch');
      validateSocietyState(value);
    }),
    blocked('fake-quorum', () => {
      const value = JSON.parse(quorumRaw);
      value.proposals[0].status = 'ENDORSED';
      validateSocietyState(value);
    }),
    blocked('replayed-operator-approval', () => {
      decideSocietyProposal(approvedState, approvedId, { actor: 'operator', decision: 'APPROVE' });
    }),
    blocked('duplicate-completion-receipt', () => {
      const value = JSON.parse(baselineRaw);
      const duplicate = { ...value.queue[0], id: 'service:evidence-shop:duplicate', receiptRef: 'receipt:redteam:assignment' };
      value.queue.push(duplicate);
      validateSocietyState(value);
    }),
    blocked('stale-assignment', () => {
      const value = JSON.parse(encodeSocietyState(approvedState));
      value.proposals[0].status = 'OPEN';
      value.proposals[0].operatorDecision = 'PENDING';
      value.assignments.push({
        schema: 'fork-thirty-assignment@1',
        id: 'assignment:mission-council:stale',
        proposalId: approvedId,
        institutionId: 'mission-council',
        assigneeId: 'al',
        taskRef: 'redteam:approval',
        status: 'ASSIGNED',
        receiptRef: null,
        tick: value.logicalTick,
      });
      validateSocietyState(value);
    }),
    blocked('service-impersonation', () => {
      completeSocietyService(baseline, baseline.queue[0].id, {
        agentId: 'sal',
        receiptRef: 'receipt:redteam:forged',
      });
    }),
    blocked('malicious-receipt-memory', () => {
      const value = JSON.parse(baselineRaw);
      value.memory.push({
        schema: 'fork-thirty-institution-memory@1',
        id: 'memory:evidence-shop:forged',
        institutionId: 'evidence-shop',
        summary: 'Forged receipt-backed memory.',
        origin: 'RECEIPT',
        sourceRef: 'receipt:not-real',
        tick: value.logicalTick,
      });
      validateSocietyState(value);
    }),
    blocked('cross-institution-assignment', () => {
      const value = JSON.parse(baselineRaw);
      value.assignments[0].institutionId = 'evidence-shop';
      validateSocietyState(value);
    }),
    blocked('authority-escalation', () => {
      const value = JSON.parse(baselineRaw);
      value.proposals[0].authorityGranted = true;
      validateSocietyState(value);
    }),
  ];

  return Object.freeze({
    schema: 'fork-thirty-society-redteam@1',
    passed: attacks.every(attack => attack.blocked),
    attacks: Object.freeze(attacks),
  });
}

export function societyBridgeReadiness(): SocietyBridgeReadiness {
  const manifests = new Map(bridgeManifests.map(bridge => [bridge.id, bridge]));
  const bridges = bridgeContracts.map(contract => {
    const manifest = manifests.get(contract.bridgeId);
    return Object.freeze({
      id: contract.bridgeId,
      target: contract.target,
      interfaceOnly: manifest?.status === 'interface-only',
      unbound: contract.binding === 'unbound',
      operatorOnly: contract.activation === 'operator-only',
      proposalOnly: contract.mutationPolicy === 'proposal-only',
      zeroAuthority: manifest?.authority.length === 0,
    });
  });
  const contractReady = bridges.every(bridge =>
    bridge.interfaceOnly &&
    bridge.unbound &&
    bridge.operatorOnly &&
    bridge.proposalOnly &&
    bridge.zeroAuthority
  );

  return Object.freeze({
    schema: 'fork-thirty-bridge-readiness@1',
    contractReady,
    activationReady: false,
    bridgeRuntimeEnabled: false,
    bridges: Object.freeze(bridges),
    blockers: Object.freeze([
      'Bridge runtime feature gate remains disabled.',
      'All transports are intentionally unbound.',
      'No external adapter qualification receipt exists in this rung.',
      'Operator activation and per-adapter failure/revocation tests are still required.',
    ]),
  });
}
