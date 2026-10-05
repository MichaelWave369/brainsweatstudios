import type { AgentMemoryScope } from '../contracts';

export const SERVICE_MEMORY_LIMIT = 32;
export const SERVICE_HANDOFF_LIMIT = 16;
export const SERVICE_LIFECYCLE_LIMIT = 64;

export type AgentServiceStatus = 'STOPPED' | 'STARTING' | 'READY' | 'BUSY' | 'PAUSED';
export type AgentPresence = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'PAUSED';
export type ServiceActor = 'operator' | 'service';
export type HandoffStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';

export type ServiceCommand =
  | { type: 'START'; actor: 'operator' }
  | { type: 'READY'; actor: 'service' }
  | { type: 'BEGIN'; actor: 'service'; taskRef: string }
  | { type: 'IDLE'; actor: 'service' }
  | { type: 'PAUSE'; actor: 'operator' }
  | { type: 'RESUME'; actor: 'operator' }
  | { type: 'STOP'; actor: 'operator' };

export interface ServiceMemoryRecord {
  schema: 'fork-thirty-service-memory@1';
  id: string;
  agentId: string;
  scope: AgentMemoryScope;
  summary: string;
  sourceRef?: string;
  tick: number;
}

export interface AgentHandoffRecord {
  schema: 'fork-thirty-handoff@1';
  id: string;
  fromAgentId: string;
  toAgentId: string;
  taskRef: string;
  status: HandoffStatus;
  note?: string;
  tick: number;
}

export interface ServiceLifecycleReceipt {
  schema: 'fork-thirty-lifecycle@1';
  id: string;
  agentId: string;
  from: AgentServiceStatus;
  to: AgentServiceStatus;
  command: ServiceCommand['type'];
  actor: ServiceActor;
  tick: number;
  revision: number;
}

export interface AgentServiceState {
  schema: 'fork-thirty-service-state@1';
  agentId: string;
  status: AgentServiceStatus;
  presence: AgentPresence;
  logicalTick: number;
  revision: number;
  activeTaskRef: string | null;
  memory: readonly ServiceMemoryRecord[];
  handoffs: readonly AgentHandoffRecord[];
  lifecycle: readonly ServiceLifecycleReceipt[];
}

export interface AgentServiceDirectory {
  schema: 'fork-thirty-service-directory@1';
  revision: number;
  services: readonly AgentServiceState[];
}
