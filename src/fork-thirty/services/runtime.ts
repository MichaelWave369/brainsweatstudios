import { cast } from '../cast';
import type { AgentMemoryScope } from '../contracts';
import {
  SERVICE_HANDOFF_LIMIT,
  SERVICE_LIFECYCLE_LIMIT,
  SERVICE_MEMORY_LIMIT,
  type AgentHandoffRecord,
  type AgentPresence,
  type AgentServiceState,
  type AgentServiceStatus,
  type HandoffStatus,
  type ServiceCommand,
  type ServiceLifecycleReceipt,
  type ServiceMemoryRecord,
} from './contracts';

const knownAgentIds = new Set(cast.map(agent => agent.id));
const statuses = new Set<AgentServiceStatus>(['STOPPED', 'STARTING', 'READY', 'BUSY', 'PAUSED']);
const presences = new Set<AgentPresence>(['OFFLINE', 'AVAILABLE', 'BUSY', 'PAUSED']);
const memoryScopes = new Set<AgentMemoryScope>(['episode', 'world', 'career']);
const handoffStatuses = new Set<HandoffStatus>(['PROPOSED', 'ACCEPTED', 'REJECTED', 'COMPLETED']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid ${label}`);
  return Number(value);
}

function boundedText(value: unknown, label: string, max: number, optional = false): string | undefined {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new Error(`Invalid ${label}`);
  return value;
}

function assertKnownAgent(agentId: string): void {
  if (!knownAgentIds.has(agentId)) throw new Error(`Unknown Fork-Thirty agent: ${agentId}`);
}

export function presenceForStatus(status: AgentServiceStatus): AgentPresence {
  if (status === 'READY') return 'AVAILABLE';
  if (status === 'BUSY') return 'BUSY';
  if (status === 'PAUSED') return 'PAUSED';
  return 'OFFLINE';
}

function freezeState(state: AgentServiceState): AgentServiceState {
  return Object.freeze({
    ...state,
    memory: Object.freeze([...state.memory]),
    handoffs: Object.freeze([...state.handoffs]),
    lifecycle: Object.freeze([...state.lifecycle]),
  });
}

export function createAgentServiceState(agentId: string): AgentServiceState {
  assertKnownAgent(agentId);
  return freezeState({
    schema: 'fork-thirty-service-state@1',
    agentId,
    status: 'STOPPED',
    presence: 'OFFLINE',
    logicalTick: 0,
    revision: 0,
    activeTaskRef: null,
    memory: [],
    handoffs: [],
    lifecycle: [],
  });
}

function nextStatus(state: AgentServiceState, command: ServiceCommand): AgentServiceStatus {
  if (command.type === 'START' && state.status === 'STOPPED') return 'STARTING';
  if (command.type === 'READY' && state.status === 'STARTING') return 'READY';
  if (command.type === 'BEGIN' && state.status === 'READY') return 'BUSY';
  if (command.type === 'IDLE' && state.status === 'BUSY') return 'READY';
  if (command.type === 'PAUSE' && (state.status === 'READY' || state.status === 'BUSY')) return 'PAUSED';
  if (command.type === 'RESUME' && state.status === 'PAUSED') return state.activeTaskRef ? 'BUSY' : 'READY';
  if (command.type === 'STOP' && state.status !== 'STOPPED') return 'STOPPED';
  throw new Error(`Invalid service transition: ${state.status} + ${command.type}`);
}

export function transitionAgentService(state: AgentServiceState, command: ServiceCommand): AgentServiceState {
  const to = nextStatus(state, command);
  if ((command.type === 'START' || command.type === 'PAUSE' || command.type === 'RESUME' || command.type === 'STOP') && command.actor !== 'operator') {
    throw new Error(`${command.type} requires operator authority`);
  }
  if ((command.type === 'READY' || command.type === 'BEGIN' || command.type === 'IDLE') && command.actor !== 'service') {
    throw new Error(`${command.type} requires service authority`);
  }

  let activeTaskRef = state.activeTaskRef;
  if (command.type === 'BEGIN') activeTaskRef = boundedText(command.taskRef, 'taskRef', 160) ?? null;
  if (command.type === 'IDLE' || command.type === 'STOP') activeTaskRef = null;

  const revision = state.revision + 1;
  const tick = state.logicalTick + 1;
  const receipt: ServiceLifecycleReceipt = Object.freeze({
    schema: 'fork-thirty-lifecycle@1',
    id: `lifecycle:${state.agentId}:${revision}`,
    agentId: state.agentId,
    from: state.status,
    to,
    command: command.type,
    actor: command.actor,
    tick,
    revision,
  });

  return freezeState({
    ...state,
    status: to,
    presence: presenceForStatus(to),
    logicalTick: tick,
    revision,
    activeTaskRef,
    lifecycle: [...state.lifecycle, receipt].slice(-SERVICE_LIFECYCLE_LIMIT),
  });
}

export function rememberAgentService(
  state: AgentServiceState,
  input: { id: string; scope: AgentMemoryScope; summary: string; sourceRef?: string },
): AgentServiceState {
  if (state.status === 'STOPPED' || state.status === 'STARTING') throw new Error('Service memory requires READY, BUSY or PAUSED state');
  if (state.memory.some(record => record.id === input.id)) throw new Error(`Duplicate service memory id: ${input.id}`);
  if (!memoryScopes.has(input.scope)) throw new Error('Invalid service memory scope');

  const tick = state.logicalTick + 1;
  const record: ServiceMemoryRecord = Object.freeze({
    schema: 'fork-thirty-service-memory@1',
    id: boundedText(input.id, 'memory id', 120) ?? '',
    agentId: state.agentId,
    scope: input.scope,
    summary: boundedText(input.summary, 'memory summary', 500) ?? '',
    ...(input.sourceRef ? { sourceRef: boundedText(input.sourceRef, 'memory sourceRef', 240) } : {}),
    tick,
  });

  return freezeState({
    ...state,
    logicalTick: tick,
    revision: state.revision + 1,
    memory: [...state.memory, record].slice(-SERVICE_MEMORY_LIMIT),
  });
}

export function proposeAgentHandoff(
  state: AgentServiceState,
  input: { toAgentId: string; taskRef: string; note?: string },
): AgentServiceState {
  if (state.status !== 'READY' && state.status !== 'BUSY') throw new Error('Handoff proposals require READY or BUSY state');
  assertKnownAgent(input.toAgentId);
  if (input.toAgentId === state.agentId) throw new Error('Agent cannot hand off to itself');

  const revision = state.revision + 1;
  const tick = state.logicalTick + 1;
  const record: AgentHandoffRecord = Object.freeze({
    schema: 'fork-thirty-handoff@1',
    id: `handoff:${state.agentId}:${revision}`,
    fromAgentId: state.agentId,
    toAgentId: input.toAgentId,
    taskRef: boundedText(input.taskRef, 'handoff taskRef', 160) ?? '',
    status: 'PROPOSED',
    ...(input.note ? { note: boundedText(input.note, 'handoff note', 500) } : {}),
    tick,
  });

  return freezeState({
    ...state,
    logicalTick: tick,
    revision,
    handoffs: [...state.handoffs, record].slice(-SERVICE_HANDOFF_LIMIT),
  });
}

export function resolveAgentHandoff(
  state: AgentServiceState,
  input: { handoffId: string; outcome: Exclude<HandoffStatus, 'PROPOSED'>; actor: 'operator' },
): AgentServiceState {
  if (input.actor !== 'operator') throw new Error('Handoff outcomes require operator authority');
  const index = state.handoffs.findIndex(record => record.id === input.handoffId);
  if (index < 0) throw new Error(`Unknown handoff: ${input.handoffId}`);
  const current = state.handoffs[index];

  const allowed =
    (current.status === 'PROPOSED' && (input.outcome === 'ACCEPTED' || input.outcome === 'REJECTED')) ||
    (current.status === 'ACCEPTED' && input.outcome === 'COMPLETED');
  if (!allowed) throw new Error(`Invalid handoff transition: ${current.status} -> ${input.outcome}`);

  const tick = state.logicalTick + 1;
  const handoffs = [...state.handoffs];
  handoffs[index] = Object.freeze({ ...current, status: input.outcome, tick });

  return freezeState({
    ...state,
    logicalTick: tick,
    revision: state.revision + 1,
    handoffs,
  });
}

export function restoreAgentServiceState(value: unknown): AgentServiceState {
  if (!isRecord(value) || value.schema !== 'fork-thirty-service-state@1') throw new Error('Invalid service state schema');
  const agentId = boundedText(value.agentId, 'agentId', 120) ?? '';
  assertKnownAgent(agentId);
  if (typeof value.status !== 'string' || !statuses.has(value.status as AgentServiceStatus)) throw new Error('Invalid service status');
  const status = value.status as AgentServiceStatus;
  if (typeof value.presence !== 'string' || !presences.has(value.presence as AgentPresence)) throw new Error('Invalid service presence');
  if (value.presence !== presenceForStatus(status)) throw new Error('Service presence does not match lifecycle status');

  const logicalTick = integer(value.logicalTick, 'logicalTick');
  const revision = integer(value.revision, 'revision');
  const activeTaskRef = value.activeTaskRef === null ? null : boundedText(value.activeTaskRef, 'activeTaskRef', 160) ?? null;
  if (!Array.isArray(value.memory) || value.memory.length > SERVICE_MEMORY_LIMIT) throw new Error('Invalid service memory');
  if (!Array.isArray(value.handoffs) || value.handoffs.length > SERVICE_HANDOFF_LIMIT) throw new Error('Invalid service handoffs');
  if (!Array.isArray(value.lifecycle) || value.lifecycle.length > SERVICE_LIFECYCLE_LIMIT) throw new Error('Invalid service lifecycle');

  const memory = value.memory.map(item => {
    if (!isRecord(item) || item.schema !== 'fork-thirty-service-memory@1' || item.agentId !== agentId) throw new Error('Invalid service memory record');
    if (typeof item.scope !== 'string' || !memoryScopes.has(item.scope as AgentMemoryScope)) throw new Error('Invalid service memory scope');
    return Object.freeze({
      schema: 'fork-thirty-service-memory@1' as const,
      id: boundedText(item.id, 'memory id', 120) ?? '',
      agentId,
      scope: item.scope as AgentMemoryScope,
      summary: boundedText(item.summary, 'memory summary', 500) ?? '',
      ...(item.sourceRef === undefined ? {} : { sourceRef: boundedText(item.sourceRef, 'memory sourceRef', 240) }),
      tick: integer(item.tick, 'memory tick'),
    });
  });

  const handoffs = value.handoffs.map(item => {
    if (!isRecord(item) || item.schema !== 'fork-thirty-handoff@1' || item.fromAgentId !== agentId) throw new Error('Invalid handoff record');
    const toAgentId = boundedText(item.toAgentId, 'handoff target', 120) ?? '';
    assertKnownAgent(toAgentId);
    if (typeof item.status !== 'string' || !handoffStatuses.has(item.status as HandoffStatus)) throw new Error('Invalid handoff status');
    return Object.freeze({
      schema: 'fork-thirty-handoff@1' as const,
      id: boundedText(item.id, 'handoff id', 160) ?? '',
      fromAgentId: agentId,
      toAgentId,
      taskRef: boundedText(item.taskRef, 'handoff taskRef', 160) ?? '',
      status: item.status as HandoffStatus,
      ...(item.note === undefined ? {} : { note: boundedText(item.note, 'handoff note', 500) }),
      tick: integer(item.tick, 'handoff tick'),
    });
  });

  const lifecycle = value.lifecycle.map(item => {
    if (!isRecord(item) || item.schema !== 'fork-thirty-lifecycle@1' || item.agentId !== agentId) throw new Error('Invalid lifecycle receipt');
    if (typeof item.from !== 'string' || !statuses.has(item.from as AgentServiceStatus)) throw new Error('Invalid lifecycle from status');
    if (typeof item.to !== 'string' || !statuses.has(item.to as AgentServiceStatus)) throw new Error('Invalid lifecycle to status');
    if (typeof item.actor !== 'string' || (item.actor !== 'operator' && item.actor !== 'service')) throw new Error('Invalid lifecycle actor');
    if (typeof item.command !== 'string' || !['START', 'READY', 'BEGIN', 'IDLE', 'PAUSE', 'RESUME', 'STOP'].includes(item.command)) throw new Error('Invalid lifecycle command');
    return Object.freeze({
      schema: 'fork-thirty-lifecycle@1' as const,
      id: boundedText(item.id, 'lifecycle id', 160) ?? '',
      agentId,
      from: item.from as AgentServiceStatus,
      to: item.to as AgentServiceStatus,
      command: item.command as ServiceCommand['type'],
      actor: item.actor as 'operator' | 'service',
      tick: integer(item.tick, 'lifecycle tick'),
      revision: integer(item.revision, 'lifecycle revision'),
    });
  });

  return freezeState({
    schema: 'fork-thirty-service-state@1',
    agentId,
    status,
    presence: presenceForStatus(status),
    logicalTick,
    revision,
    activeTaskRef,
    memory,
    handoffs,
    lifecycle,
  });
}
