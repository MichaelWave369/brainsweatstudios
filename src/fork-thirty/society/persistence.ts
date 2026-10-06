import { cast } from '../cast';
import { decodeAgentServiceDirectory, encodeAgentServiceDirectory } from '../services/persistence';
import {
  SOCIETY_LIMITS,
  type AssignmentStatus,
  type InstitutionKind,
  type InstitutionMemoryRecord,
  type ProposalStatus,
  type SocietyAssignment,
  type SocietyInstitution,
  type SocietyMember,
  type SocietyProposal,
  type SocietyQueueItem,
  type SocietyQueueStatus,
  type SocietyRole,
  type SocietyServiceKind,
  type SocietyState,
} from './contracts';
import { createSocietyState } from './runtime';

export const SOCIETY_STORAGE_KEY = 'fork-thirty-society:v1';

export interface SocietyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const castIds = new Set(cast.map(agent => agent.id));
const institutionKinds = new Set<InstitutionKind>(['TEAM', 'COUNCIL', 'INSTITUTION']);
const roles = new Set<SocietyRole>(['COORDINATOR', 'PLANNER', 'AUDITOR', 'CUSTODIAN', 'RELAY', 'MEMBER']);
const proposalStatuses = new Set<ProposalStatus>(['OPEN', 'ENDORSED', 'OPERATOR_APPROVED', 'REJECTED', 'COMPLETED']);
const assignmentStatuses = new Set<AssignmentStatus>(['ASSIGNED', 'ACCEPTED', 'REJECTED', 'COMPLETED']);
const serviceKinds = new Set<SocietyServiceKind>(['MEMORY', 'RECOVERY', 'COMPUTE', 'COMMS', 'COORDINATION']);
const queueStatuses = new Set<SocietyQueueStatus>(['QUEUED', 'CLAIMED', 'COMPLETED', 'REJECTED']);
const authorityScopes = new Set(['world', 'memory', 'media', 'network', 'operator']);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, label: string, max = SOCIETY_LIMITS.text) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) throw new Error(`Invalid ${label}`);
  return value;
}

function id(value: unknown, label: string) {
  const valueText = text(value, label, 160);
  if (!/^[a-z][a-z0-9:-]{0,159}$/.test(valueText)) throw new Error(`Invalid ${label}`);
  return valueText;
}

function integer(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid ${label}`);
  return Number(value);
}

function agent(value: unknown, label = 'agent id') {
  const valueId = id(value, label);
  if (!castIds.has(valueId)) throw new Error(`Unknown Fork-Thirty resident: ${valueId}`);
  return valueId;
}

function freezeState(state: SocietyState): SocietyState {
  return Object.freeze({
    ...state,
    institutions: Object.freeze([...state.institutions]),
    proposals: Object.freeze([...state.proposals]),
    assignments: Object.freeze([...state.assignments]),
    queue: Object.freeze([...state.queue]),
    memory: Object.freeze([...state.memory]),
  });
}

export function validateSocietyState(value: unknown): SocietyState {
  if (!record(value) || value.schema !== 'fork-thirty-society@1') throw new Error('Invalid society state schema');
  const revision = integer(value.revision, 'society revision');
  const logicalTick = integer(value.logicalTick, 'society logicalTick');
  const services = decodeAgentServiceDirectory(JSON.stringify(value.services));

  if (!Array.isArray(value.institutions) || value.institutions.length > SOCIETY_LIMITS.institutions) throw new Error('Invalid society institutions');
  if (!Array.isArray(value.proposals) || value.proposals.length > SOCIETY_LIMITS.proposals) throw new Error('Invalid society proposals');
  if (!Array.isArray(value.assignments) || value.assignments.length > SOCIETY_LIMITS.assignments) throw new Error('Invalid society assignments');
  if (!Array.isArray(value.queue) || value.queue.length > SOCIETY_LIMITS.queue) throw new Error('Invalid society service queue');
  if (!Array.isArray(value.memory) || value.memory.length > SOCIETY_LIMITS.memory) throw new Error('Invalid society memory');

  const institutions: SocietyInstitution[] = value.institutions.map(raw => {
    if (!record(raw) || raw.schema !== 'fork-thirty-institution@1') throw new Error('Invalid institution record');
    const institutionId = id(raw.id, 'institution id');
    if (typeof raw.kind !== 'string' || !institutionKinds.has(raw.kind as InstitutionKind)) throw new Error('Invalid institution kind');
    if (!Array.isArray(raw.members) || raw.members.length < 1 || raw.members.length > SOCIETY_LIMITS.membersPerInstitution) throw new Error('Invalid institution members');
    if (!Array.isArray(raw.authority) || raw.authority.length !== 0) throw new Error('Society institutions cannot manufacture authority');

    const members: SocietyMember[] = raw.members.map(memberRaw => {
      if (!record(memberRaw)) throw new Error('Invalid society member');
      const agentId = agent(memberRaw.agentId);
      if (typeof memberRaw.role !== 'string' || !roles.has(memberRaw.role as SocietyRole)) throw new Error('Invalid society role');
      return Object.freeze({
        agentId,
        role: memberRaw.role as SocietyRole,
        joinedTick: integer(memberRaw.joinedTick, 'member joinedTick'),
      });
    });
    if (new Set(members.map(member => member.agentId)).size !== members.length) throw new Error('Duplicate society member');
    const quorum = integer(raw.quorum, 'institution quorum');
    if (quorum < 1 || quorum > members.length) throw new Error('Invalid institution quorum');

    return Object.freeze({
      schema: 'fork-thirty-institution@1' as const,
      id: institutionId,
      title: text(raw.title, 'institution title', 80),
      kind: raw.kind as InstitutionKind,
      purpose: text(raw.purpose, 'institution purpose', 240),
      quorum,
      members: Object.freeze(members),
      authority: Object.freeze([]),
    });
  });
  const institutionMap = new Map(institutions.map(item => [item.id, item]));
  if (institutionMap.size !== institutions.length) throw new Error('Duplicate institution id');

  const proposals: SocietyProposal[] = value.proposals.map(raw => {
    if (!record(raw) || raw.schema !== 'fork-thirty-proposal@1') throw new Error('Invalid society proposal');
    const institutionId = id(raw.institutionId, 'proposal institution');
    const group = institutionMap.get(institutionId);
    if (!group) throw new Error('Proposal references unknown institution');
    const proposerId = agent(raw.proposerId, 'proposal proposer');
    if (!group.members.some(member => member.agentId === proposerId)) throw new Error('Proposal author is not an institution member');
    if (!Array.isArray(raw.endorsements) || raw.endorsements.length > group.members.length) throw new Error('Invalid proposal endorsements');
    const endorsements = raw.endorsements.map(item => agent(item, 'proposal endorsement'));
    if (new Set(endorsements).size !== endorsements.length || endorsements.some(item => !group.members.some(member => member.agentId === item))) throw new Error('Invalid proposal endorsement membership');
    if (typeof raw.status !== 'string' || !proposalStatuses.has(raw.status as ProposalStatus)) throw new Error('Invalid proposal status');
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(String(raw.operatorDecision))) throw new Error('Invalid proposal operator decision');
    if (raw.authorityGranted !== false) throw new Error('Society approval cannot grant authority');
    const requestedAuthority = raw.requestedAuthority === null ? null : (() => {
      if (!record(raw.requestedAuthority) || typeof raw.requestedAuthority.scope !== 'string' || !authorityScopes.has(raw.requestedAuthority.scope) || typeof raw.requestedAuthority.action !== 'string') throw new Error('Invalid authority request');
      return Object.freeze({
        scope: raw.requestedAuthority.scope as 'world' | 'memory' | 'media' | 'network' | 'operator',
        action: text(raw.requestedAuthority.action, 'authority action', 120),
      });
    })();
    if ((raw.status === 'ENDORSED' || raw.status === 'OPERATOR_APPROVED' || raw.status === 'COMPLETED') && endorsements.length < group.quorum) throw new Error('Proposal status exceeds institutional quorum');
    if (raw.status === 'OPERATOR_APPROVED' && raw.operatorDecision !== 'APPROVED') throw new Error('Approved proposal lacks operator approval');
    if (raw.status === 'REJECTED' && raw.operatorDecision !== 'REJECTED') throw new Error('Rejected proposal lacks operator rejection');

    return Object.freeze({
      schema: 'fork-thirty-proposal@1' as const,
      id: id(raw.id, 'proposal id'),
      institutionId,
      proposerId,
      summary: text(raw.summary, 'proposal summary'),
      taskRef: text(raw.taskRef, 'proposal taskRef', 200),
      requestedAuthority,
      endorsements: Object.freeze(endorsements),
      status: raw.status as ProposalStatus,
      operatorDecision: raw.operatorDecision as SocietyProposal['operatorDecision'],
      authorityGranted: false as const,
      tick: integer(raw.tick, 'proposal tick'),
      receiptRef: raw.receiptRef === null ? null : text(raw.receiptRef, 'proposal receiptRef', 240),
    });
  });
  const proposalMap = new Map(proposals.map(item => [item.id, item]));
  if (proposalMap.size !== proposals.length) throw new Error('Duplicate proposal id');

  const assignments: SocietyAssignment[] = value.assignments.map(raw => {
    if (!record(raw) || raw.schema !== 'fork-thirty-assignment@1') throw new Error('Invalid society assignment');
    const proposalId = id(raw.proposalId, 'assignment proposal');
    const proposal = proposalMap.get(proposalId);
    if (!proposal) throw new Error('Assignment references unknown proposal');
    const institutionId = id(raw.institutionId, 'assignment institution');
    if (proposal.institutionId !== institutionId) throw new Error('Assignment institution differs from proposal');
    const assigneeId = agent(raw.assigneeId, 'assignment assignee');
    const group = institutionMap.get(institutionId)!;
    if (!group.members.some(member => member.agentId === assigneeId)) throw new Error('Assignment assignee is not an institution member');
    if (typeof raw.status !== 'string' || !assignmentStatuses.has(raw.status as AssignmentStatus)) throw new Error('Invalid assignment status');

    return Object.freeze({
      schema: 'fork-thirty-assignment@1' as const,
      id: id(raw.id, 'assignment id'),
      proposalId,
      institutionId,
      assigneeId,
      taskRef: text(raw.taskRef, 'assignment taskRef', 200),
      status: raw.status as AssignmentStatus,
      receiptRef: raw.receiptRef === null ? null : text(raw.receiptRef, 'assignment receiptRef', 240),
      tick: integer(raw.tick, 'assignment tick'),
    });
  });
  if (new Set(assignments.map(item => item.id)).size !== assignments.length) throw new Error('Duplicate assignment id');

  const queue: SocietyQueueItem[] = value.queue.map(raw => {
    if (!record(raw) || raw.schema !== 'fork-thirty-service-request@1') throw new Error('Invalid society service request');
    const institutionId = id(raw.institutionId, 'service institution');
    const group = institutionMap.get(institutionId);
    if (!group) throw new Error('Service request references unknown institution');
    const requestedBy = agent(raw.requestedBy, 'service requester');
    if (!group.members.some(member => member.agentId === requestedBy)) throw new Error('Service requester is not an institution member');
    if (typeof raw.kind !== 'string' || !serviceKinds.has(raw.kind as SocietyServiceKind)) throw new Error('Invalid society service kind');
    if (typeof raw.status !== 'string' || !queueStatuses.has(raw.status as SocietyQueueStatus)) throw new Error('Invalid society queue status');
    const assignedTo = raw.assignedTo === null ? null : agent(raw.assignedTo, 'service assignee');

    return Object.freeze({
      schema: 'fork-thirty-service-request@1' as const,
      id: id(raw.id, 'service request id'),
      institutionId,
      requestedBy,
      kind: raw.kind as SocietyServiceKind,
      taskRef: text(raw.taskRef, 'service taskRef', 200),
      status: raw.status as SocietyQueueStatus,
      assignedTo,
      receiptRef: raw.receiptRef === null ? null : text(raw.receiptRef, 'service receiptRef', 240),
      tick: integer(raw.tick, 'service request tick'),
    });
  });
  if (new Set(queue.map(item => item.id)).size !== queue.length) throw new Error('Duplicate service request id');

  const memory: InstitutionMemoryRecord[] = value.memory.map(raw => {
    if (!record(raw) || raw.schema !== 'fork-thirty-institution-memory@1') throw new Error('Invalid institution memory');
    const institutionId = id(raw.institutionId, 'memory institution');
    if (!institutionMap.has(institutionId)) throw new Error('Institution memory references unknown institution');
    if (raw.origin !== 'RECEIPT' && raw.origin !== 'OPERATOR') throw new Error('Invalid institution memory origin');
    return Object.freeze({
      schema: 'fork-thirty-institution-memory@1' as const,
      id: id(raw.id, 'institution memory id'),
      institutionId,
      summary: text(raw.summary, 'institution memory summary'),
      origin: raw.origin,
      sourceRef: text(raw.sourceRef, 'institution memory sourceRef', 240),
      tick: integer(raw.tick, 'institution memory tick'),
    });
  });
  if (new Set(memory.map(item => item.id)).size !== memory.length) throw new Error('Duplicate institution memory id');

  return freezeState({
    schema: 'fork-thirty-society@1',
    revision,
    logicalTick,
    services,
    institutions,
    proposals,
    assignments,
    queue,
    memory,
  });
}

export function encodeSocietyState(state: SocietyState): string {
  const validated = validateSocietyState(state);
  return JSON.stringify(validated);
}

export function decodeSocietyState(raw: string): SocietyState {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Invalid society JSON');
  }
  return validateSocietyState(value);
}

export function loadSocietyState(storage?: SocietyStorage): SocietyState {
  if (!storage) return createSocietyState();
  const raw = storage.getItem(SOCIETY_STORAGE_KEY);
  if (!raw) return createSocietyState();
  try {
    return decodeSocietyState(raw);
  } catch {
    return createSocietyState();
  }
}

export function saveSocietyState(state: SocietyState, storage?: SocietyStorage): SocietyState {
  const validated = validateSocietyState(state);
  if (storage) storage.setItem(SOCIETY_STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export function societyServiceDigest(state: SocietyState): string {
  return encodeAgentServiceDirectory(validateSocietyState(state).services);
}
