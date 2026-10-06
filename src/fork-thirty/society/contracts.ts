import type { AuthorityScope } from '../contracts';
import type { AgentServiceDirectory } from '../services/contracts';

export const SOCIETY_LIMITS = {
  institutions: 8,
  membersPerInstitution: 10,
  proposals: 32,
  assignments: 32,
  queue: 32,
  memory: 32,
  text: 500,
} as const;

export type InstitutionKind = 'TEAM' | 'COUNCIL' | 'INSTITUTION';
export type SocietyRole = 'COORDINATOR' | 'PLANNER' | 'AUDITOR' | 'CUSTODIAN' | 'RELAY' | 'MEMBER';
export type ProposalStatus = 'OPEN' | 'ENDORSED' | 'OPERATOR_APPROVED' | 'REJECTED' | 'COMPLETED';
export type AssignmentStatus = 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type SocietyServiceKind = 'MEMORY' | 'RECOVERY' | 'COMPUTE' | 'COMMS' | 'COORDINATION';
export type SocietyQueueStatus = 'QUEUED' | 'CLAIMED' | 'COMPLETED' | 'REJECTED';

export interface SocietyMember {
  agentId: string;
  role: SocietyRole;
  joinedTick: number;
}

export interface SocietyInstitution {
  schema: 'fork-thirty-institution@1';
  id: string;
  title: string;
  kind: InstitutionKind;
  purpose: string;
  quorum: number;
  members: readonly SocietyMember[];
  authority: readonly [];
}

export interface AuthorityRequest {
  scope: AuthorityScope;
  action: string;
}

export interface SocietyProposal {
  schema: 'fork-thirty-proposal@1';
  id: string;
  institutionId: string;
  proposerId: string;
  summary: string;
  taskRef: string;
  requestedAuthority: AuthorityRequest | null;
  endorsements: readonly string[];
  status: ProposalStatus;
  operatorDecision: 'PENDING' | 'APPROVED' | 'REJECTED';
  authorityGranted: false;
  tick: number;
  receiptRef: string | null;
}

export interface SocietyAssignment {
  schema: 'fork-thirty-assignment@1';
  id: string;
  proposalId: string;
  institutionId: string;
  assigneeId: string;
  taskRef: string;
  status: AssignmentStatus;
  receiptRef: string | null;
  tick: number;
}

export interface SocietyQueueItem {
  schema: 'fork-thirty-service-request@1';
  id: string;
  institutionId: string;
  requestedBy: string;
  kind: SocietyServiceKind;
  taskRef: string;
  status: SocietyQueueStatus;
  assignedTo: string | null;
  receiptRef: string | null;
  tick: number;
}

export interface InstitutionMemoryRecord {
  schema: 'fork-thirty-institution-memory@1';
  id: string;
  institutionId: string;
  summary: string;
  origin: 'RECEIPT' | 'OPERATOR';
  sourceRef: string;
  tick: number;
}

export interface SocietyState {
  schema: 'fork-thirty-society@1';
  revision: number;
  logicalTick: number;
  services: AgentServiceDirectory;
  institutions: readonly SocietyInstitution[];
  proposals: readonly SocietyProposal[];
  assignments: readonly SocietyAssignment[];
  queue: readonly SocietyQueueItem[];
  memory: readonly InstitutionMemoryRecord[];
}
