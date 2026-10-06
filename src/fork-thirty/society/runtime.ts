import { cast } from '../cast';
import type { AuthorityScope } from '../contracts';
import { createAgentServiceDirectory, replaceAgentService } from '../services/persistence';
import { transitionAgentService } from '../services/runtime';
import type { AgentServiceState, ServiceCommand } from '../services/contracts';
import {
  SOCIETY_LIMITS,
  type InstitutionMemoryRecord,
  type SocietyAssignment,
  type SocietyInstitution,
  type SocietyProposal,
  type SocietyQueueItem,
  type SocietyRole,
  type SocietyServiceKind,
  type SocietyState,
} from './contracts';

const castById = new Map(cast.map(agent => [agent.id, agent]));
const serviceCapability: Record<SocietyServiceKind, string> = {
  MEMORY: 'memory-retrieval',
  RECOVERY: 'debugging',
  COMPUTE: 'compute-routing',
  COMMS: 'structured-comms',
  COORDINATION: 'team-coordination',
};

function knownAgent(agentId: string) {
  const agent = castById.get(agentId);
  if (!agent) throw new Error(`Unknown Fork-Thirty resident: ${agentId}`);
  return agent;
}

function bounded(value: string, label: string, max: number = SOCIETY_LIMITS.text) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) throw new Error(`Invalid ${label}`);
  return value;
}

function ident(value: string, label: string) {
  if (!/^[a-z][a-z0-9:-]{0,119}$/.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function nextTick(state: SocietyState) {
  return state.logicalTick + 1;
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

function mutate(
  state: SocietyState,
  patch: Partial<Pick<SocietyState, 'services' | 'institutions' | 'proposals' | 'assignments' | 'queue' | 'memory'>>,
): SocietyState {
  return freezeState({
    ...state,
    ...patch,
    logicalTick: nextTick(state),
    revision: state.revision + 1,
  });
}

function institution(state: SocietyState, id: string) {
  const value = state.institutions.find(item => item.id === id);
  if (!value) throw new Error(`Unknown institution: ${id}`);
  return value;
}

function memberOf(group: SocietyInstitution, agentId: string) {
  if (!group.members.some(member => member.agentId === agentId)) throw new Error(`${agentId} is not a member of ${group.id}`);
}

function service(state: SocietyState, agentId: string): AgentServiceState {
  const value = state.services.services.find(item => item.agentId === agentId);
  if (!value) throw new Error(`Unknown service resident: ${agentId}`);
  return value;
}

function availableForWork(state: SocietyState, agentId: string) {
  const value = service(state, agentId);
  if (value.status !== 'READY') throw new Error(`${agentId} must be READY before accepting society work`);
  return value;
}

function receiptMemory(
  state: SocietyState,
  institutionId: string,
  summary: string,
  sourceRef: string,
): InstitutionMemoryRecord {
  const tick = nextTick(state);
  return Object.freeze({
    schema: 'fork-thirty-institution-memory@1',
    id: `memory:${institutionId}:${state.revision + 1}`,
    institutionId,
    summary: bounded(summary, 'institution memory summary'),
    origin: 'RECEIPT',
    sourceRef: bounded(sourceRef, 'memory sourceRef', 240),
    tick,
  });
}

export function createSocietyState(): SocietyState {
  return freezeState({
    schema: 'fork-thirty-society@1',
    revision: 0,
    logicalTick: 0,
    services: createAgentServiceDirectory(),
    institutions: [],
    proposals: [],
    assignments: [],
    queue: [],
    memory: [],
  });
}

export function addSocietyInstitution(
  state: SocietyState,
  input: {
    actor: 'operator';
    id: string;
    title: string;
    kind: SocietyInstitution['kind'];
    purpose: string;
    members: readonly { agentId: string; role: SocietyRole }[];
    quorum?: number;
  },
): SocietyState {
  if (input.actor !== 'operator') throw new Error('Creating an institution requires operator authority');
  if (state.institutions.length >= SOCIETY_LIMITS.institutions) throw new Error('Society institution limit reached');
  const id = ident(input.id, 'institution id');
  if (state.institutions.some(item => item.id === id)) throw new Error(`Duplicate institution: ${id}`);
  if (!['TEAM', 'COUNCIL', 'INSTITUTION'].includes(input.kind)) throw new Error('Invalid institution kind');
  if (input.members.length < 1 || input.members.length > SOCIETY_LIMITS.membersPerInstitution) throw new Error('Invalid institution membership size');

  const seen = new Set<string>();
  const members = input.members.map(member => {
    knownAgent(member.agentId);
    if (seen.has(member.agentId)) throw new Error(`Duplicate institution member: ${member.agentId}`);
    seen.add(member.agentId);
    if (!['COORDINATOR', 'PLANNER', 'AUDITOR', 'CUSTODIAN', 'RELAY', 'MEMBER'].includes(member.role)) throw new Error('Invalid society role');
    return Object.freeze({ agentId: member.agentId, role: member.role, joinedTick: nextTick(state) });
  });
  const quorum = input.quorum ?? Math.max(1, Math.ceil(members.length / 2));
  if (!Number.isSafeInteger(quorum) || quorum < 1 || quorum > members.length) throw new Error('Invalid institution quorum');

  const value: SocietyInstitution = Object.freeze({
    schema: 'fork-thirty-institution@1',
    id,
    title: bounded(input.title, 'institution title', 80),
    kind: input.kind,
    purpose: bounded(input.purpose, 'institution purpose', 240),
    quorum,
    members: Object.freeze(members),
    authority: [] as const,
  });

  return mutate(state, { institutions: [...state.institutions, value] });
}

export function createStarterSociety(state: SocietyState): SocietyState {
  if (state.institutions.length) throw new Error('Starter society requires an empty society');
  let next = addSocietyInstitution(state, {
    actor: 'operator',
    id: 'mission-council',
    title: 'Mission Council',
    kind: 'COUNCIL',
    purpose: 'Frame missions, challenge plans and route bounded work without creating authority.',
    members: [
      { agentId: 'al', role: 'COORDINATOR' },
      { agentId: 'sal', role: 'PLANNER' },
      { agentId: 'brian-sweat', role: 'COORDINATOR' },
    ],
    quorum: 2,
  });
  next = addSocietyInstitution(next, {
    actor: 'operator',
    id: 'evidence-shop',
    title: 'Evidence & Recovery Shop',
    kind: 'TEAM',
    purpose: 'Inspect provenance, diagnose failures and retain receipt-backed recovery knowledge.',
    members: [
      { agentId: 'cache', role: 'CUSTODIAN' },
      { agentId: 'patch', role: 'AUDITOR' },
      { agentId: 'oilleak', role: 'AUDITOR' },
    ],
    quorum: 2,
  });
  return addSocietyInstitution(next, {
    actor: 'operator',
    id: 'systems-guild',
    title: 'Systems Guild',
    kind: 'INSTITUTION',
    purpose: 'Coordinate compute, adaptation, communications and creative production services.',
    members: [
      { agentId: 'coreglow', role: 'MEMBER' },
      { agentId: 'flux', role: 'MEMBER' },
      { agentId: 'ping', role: 'RELAY' },
      { agentId: 'spark', role: 'MEMBER' },
    ],
    quorum: 2,
  });
}

export function commandSocietyService(
  state: SocietyState,
  agentId: string,
  command: ServiceCommand,
): SocietyState {
  knownAgent(agentId);
  const updated = transitionAgentService(service(state, agentId), command);
  return mutate(state, { services: replaceAgentService(state.services, updated) });
}

export function submitSocietyProposal(
  state: SocietyState,
  input: {
    institutionId: string;
    proposerId: string;
    summary: string;
    taskRef: string;
    requestedAuthority?: { scope: AuthorityScope; action: string } | null;
  },
): SocietyState {
  if (state.proposals.length >= SOCIETY_LIMITS.proposals) throw new Error('Society proposal limit reached');
  const group = institution(state, input.institutionId);
  memberOf(group, input.proposerId);
  const proposerService = service(state, input.proposerId);
  if (!['READY', 'BUSY'].includes(proposerService.status)) throw new Error('Proposal authors must have a READY or BUSY service');

  const tick = nextTick(state);
  const proposal: SocietyProposal = Object.freeze({
    schema: 'fork-thirty-proposal@1',
    id: `proposal:${group.id}:${state.revision + 1}`,
    institutionId: group.id,
    proposerId: input.proposerId,
    summary: bounded(input.summary, 'proposal summary'),
    taskRef: bounded(input.taskRef, 'proposal taskRef', 200),
    requestedAuthority: input.requestedAuthority
      ? Object.freeze({
          scope: input.requestedAuthority.scope,
          action: bounded(input.requestedAuthority.action, 'requested authority action', 120),
        })
      : null,
    endorsements: Object.freeze([input.proposerId]),
    status: group.quorum <= 1 ? 'ENDORSED' : 'OPEN',
    operatorDecision: 'PENDING',
    authorityGranted: false,
    tick,
    receiptRef: null,
  });

  return mutate(state, { proposals: [...state.proposals, proposal] });
}

export function endorseSocietyProposal(state: SocietyState, proposalId: string, agentId: string): SocietyState {
  const index = state.proposals.findIndex(item => item.id === proposalId);
  if (index < 0) throw new Error(`Unknown proposal: ${proposalId}`);
  const current = state.proposals[index];
  if (current.status !== 'OPEN' && current.status !== 'ENDORSED') throw new Error('Only open proposals can be endorsed');
  const group = institution(state, current.institutionId);
  memberOf(group, agentId);
  if (current.endorsements.includes(agentId)) throw new Error('Resident already endorsed this proposal');

  const endorsements = [...current.endorsements, agentId];
  const proposals = [...state.proposals];
  proposals[index] = Object.freeze({
    ...current,
    endorsements: Object.freeze(endorsements),
    status: endorsements.length >= group.quorum ? 'ENDORSED' : 'OPEN',
    tick: nextTick(state),
  });
  return mutate(state, { proposals });
}

export function decideSocietyProposal(
  state: SocietyState,
  proposalId: string,
  input: { actor: 'operator'; decision: 'APPROVE' | 'REJECT' },
): SocietyState {
  if (input.actor !== 'operator') throw new Error('Proposal decisions require operator authority');
  const index = state.proposals.findIndex(item => item.id === proposalId);
  if (index < 0) throw new Error(`Unknown proposal: ${proposalId}`);
  const current = state.proposals[index];
  if (current.operatorDecision !== 'PENDING') throw new Error('Proposal already has an operator decision');
  if (input.decision === 'APPROVE' && current.status !== 'ENDORSED') throw new Error('Proposal must meet institutional quorum before operator approval');

  const proposals = [...state.proposals];
  proposals[index] = Object.freeze({
    ...current,
    status: input.decision === 'APPROVE' ? 'OPERATOR_APPROVED' : 'REJECTED',
    operatorDecision: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    authorityGranted: false as const,
    tick: nextTick(state),
  });
  return mutate(state, { proposals });
}

export function assignSocietyProposal(
  state: SocietyState,
  proposalId: string,
  input: { actor: 'operator'; assigneeId: string },
): SocietyState {
  if (input.actor !== 'operator') throw new Error('Assignments require operator authority');
  if (state.assignments.length >= SOCIETY_LIMITS.assignments) throw new Error('Society assignment limit reached');
  const proposal = state.proposals.find(item => item.id === proposalId);
  if (!proposal || proposal.status !== 'OPERATOR_APPROVED') throw new Error('Choose an operator-approved society proposal');
  if (state.assignments.some(item => item.proposalId === proposalId)) throw new Error('This society proposal already has an assignment');
  const group = institution(state, proposal.institutionId);
  memberOf(group, input.assigneeId);
  knownAgent(input.assigneeId);

  const assignment: SocietyAssignment = Object.freeze({
    schema: 'fork-thirty-assignment@1',
    id: `assignment:${proposal.institutionId}:${state.revision + 1}`,
    proposalId,
    institutionId: proposal.institutionId,
    assigneeId: input.assigneeId,
    taskRef: proposal.taskRef,
    status: 'ASSIGNED',
    receiptRef: null,
    tick: nextTick(state),
  });
  return mutate(state, { assignments: [...state.assignments, assignment] });
}

export function acceptSocietyAssignment(state: SocietyState, assignmentId: string, agentId: string): SocietyState {
  const index = state.assignments.findIndex(item => item.id === assignmentId);
  if (index < 0) throw new Error(`Unknown assignment: ${assignmentId}`);
  const current = state.assignments[index];
  if (current.assigneeId !== agentId) throw new Error('Only the assigned resident can accept this work');
  if (current.status !== 'ASSIGNED') throw new Error('Only assigned work can be accepted');
  const ready = availableForWork(state, agentId);
  const services = replaceAgentService(state.services, transitionAgentService(ready, { type: 'BEGIN', actor: 'service', taskRef: current.taskRef }));
  const assignments = [...state.assignments];
  assignments[index] = Object.freeze({ ...current, status: 'ACCEPTED', tick: nextTick(state) });
  return mutate(state, { services, assignments });
}

export function completeSocietyAssignment(
  state: SocietyState,
  assignmentId: string,
  input: { agentId: string; receiptRef: string },
): SocietyState {
  const index = state.assignments.findIndex(item => item.id === assignmentId);
  if (index < 0) throw new Error(`Unknown assignment: ${assignmentId}`);
  const current = state.assignments[index];
  if (current.assigneeId !== input.agentId || current.status !== 'ACCEPTED') throw new Error('Only accepted assigned work can be completed');
  const receiptRef = bounded(input.receiptRef, 'assignment receiptRef', 240);
  const active = service(state, input.agentId);
  if (active.status !== 'BUSY') throw new Error('Assignment completion requires a BUSY service');

  const assignments = [...state.assignments];
  assignments[index] = Object.freeze({ ...current, status: 'COMPLETED', receiptRef, tick: nextTick(state) });
  const services = replaceAgentService(state.services, transitionAgentService(active, { type: 'IDLE', actor: 'service' }));
  const memory = [
    ...state.memory,
    receiptMemory(state, current.institutionId, `Completed ${current.taskRef} by ${input.agentId}.`, receiptRef),
  ].slice(-SOCIETY_LIMITS.memory);

  const proposals = state.proposals.map(proposal =>
    proposal.id === current.proposalId
      ? Object.freeze({ ...proposal, status: 'COMPLETED' as const, receiptRef, tick: nextTick(state) })
      : proposal
  );

  return mutate(state, { services, assignments, proposals, memory });
}

export function enqueueSocietyService(
  state: SocietyState,
  input: { institutionId: string; requestedBy: string; kind: SocietyServiceKind; taskRef: string },
): SocietyState {
  if (state.queue.length >= SOCIETY_LIMITS.queue) throw new Error('Society service queue limit reached');
  const group = institution(state, input.institutionId);
  memberOf(group, input.requestedBy);
  if (!Object.hasOwn(serviceCapability, input.kind)) throw new Error('Invalid society service kind');

  const item: SocietyQueueItem = Object.freeze({
    schema: 'fork-thirty-service-request@1',
    id: `service:${group.id}:${state.revision + 1}`,
    institutionId: group.id,
    requestedBy: input.requestedBy,
    kind: input.kind,
    taskRef: bounded(input.taskRef, 'service taskRef', 200),
    status: 'QUEUED',
    assignedTo: null,
    receiptRef: null,
    tick: nextTick(state),
  });
  return mutate(state, { queue: [...state.queue, item] });
}

export function claimSocietyService(state: SocietyState, requestId: string, agentId: string): SocietyState {
  const index = state.queue.findIndex(item => item.id === requestId);
  if (index < 0) throw new Error(`Unknown society service request: ${requestId}`);
  const current = state.queue[index];
  if (current.status !== 'QUEUED') throw new Error('Only queued service work can be claimed');
  const resident = knownAgent(agentId);
  const capability = serviceCapability[current.kind];
  if (!resident.capabilities.includes(capability)) throw new Error(`${agentId} does not advertise the required ${capability} capability`);
  const ready = availableForWork(state, agentId);
  const services = replaceAgentService(state.services, transitionAgentService(ready, { type: 'BEGIN', actor: 'service', taskRef: current.taskRef }));
  const queue = [...state.queue];
  queue[index] = Object.freeze({ ...current, status: 'CLAIMED', assignedTo: agentId, tick: nextTick(state) });
  return mutate(state, { services, queue });
}

export function completeSocietyService(
  state: SocietyState,
  requestId: string,
  input: { agentId: string; receiptRef: string },
): SocietyState {
  const index = state.queue.findIndex(item => item.id === requestId);
  if (index < 0) throw new Error(`Unknown society service request: ${requestId}`);
  const current = state.queue[index];
  if (current.status !== 'CLAIMED' || current.assignedTo !== input.agentId) throw new Error('Only the claiming resident can complete service work');
  const receiptRef = bounded(input.receiptRef, 'service receiptRef', 240);
  const active = service(state, input.agentId);
  if (active.status !== 'BUSY') throw new Error('Service completion requires a BUSY resident service');

  const queue = [...state.queue];
  queue[index] = Object.freeze({ ...current, status: 'COMPLETED', receiptRef, tick: nextTick(state) });
  const services = replaceAgentService(state.services, transitionAgentService(active, { type: 'IDLE', actor: 'service' }));
  const memory = [
    ...state.memory,
    receiptMemory(state, current.institutionId, `${current.kind} service completed by ${input.agentId}: ${current.taskRef}.`, receiptRef),
  ].slice(-SOCIETY_LIMITS.memory);
  return mutate(state, { services, queue, memory });
}

export function rememberInstitutionOperatorNote(
  state: SocietyState,
  input: { actor: 'operator'; institutionId: string; summary: string; sourceRef: string },
): SocietyState {
  if (input.actor !== 'operator') throw new Error('Operator institutional memory requires operator authority');
  institution(state, input.institutionId);
  const record: InstitutionMemoryRecord = Object.freeze({
    schema: 'fork-thirty-institution-memory@1',
    id: `memory:${input.institutionId}:${state.revision + 1}`,
    institutionId: input.institutionId,
    summary: bounded(input.summary, 'institution memory summary'),
    origin: 'OPERATOR',
    sourceRef: bounded(input.sourceRef, 'memory sourceRef', 240),
    tick: nextTick(state),
  });
  return mutate(state, { memory: [...state.memory, record].slice(-SOCIETY_LIMITS.memory) });
}
