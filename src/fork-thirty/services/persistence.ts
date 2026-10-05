import { cast } from '../cast';
import type { AgentServiceDirectory, AgentServiceState } from './contracts';
import { createAgentServiceState, restoreAgentServiceState } from './runtime';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function freezeDirectory(directory: AgentServiceDirectory): AgentServiceDirectory {
  return Object.freeze({
    ...directory,
    services: Object.freeze([...directory.services]),
  });
}

export function createAgentServiceDirectory(): AgentServiceDirectory {
  return freezeDirectory({
    schema: 'fork-thirty-service-directory@1',
    revision: 0,
    services: cast.map(agent => createAgentServiceState(agent.id)),
  });
}

export function replaceAgentService(
  directory: AgentServiceDirectory,
  service: AgentServiceState,
): AgentServiceDirectory {
  const index = directory.services.findIndex(item => item.agentId === service.agentId);
  if (index < 0) throw new Error(`Unknown directory service: ${service.agentId}`);
  const services = [...directory.services];
  services[index] = restoreAgentServiceState(service);
  return freezeDirectory({
    schema: 'fork-thirty-service-directory@1',
    revision: directory.revision + 1,
    services,
  });
}

export function encodeAgentServiceDirectory(directory: AgentServiceDirectory): string {
  return JSON.stringify(directory);
}

export function decodeAgentServiceDirectory(raw: string): AgentServiceDirectory {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid service directory JSON');
  }
  if (!isRecord(parsed) || parsed.schema !== 'fork-thirty-service-directory@1') {
    throw new Error('Invalid service directory schema');
  }
  if (!Number.isSafeInteger(parsed.revision) || Number(parsed.revision) < 0) {
    throw new Error('Invalid service directory revision');
  }
  if (!Array.isArray(parsed.services) || parsed.services.length !== cast.length) {
    throw new Error('Invalid service directory members');
  }

  const restored = parsed.services.map(restoreAgentServiceState);
  const byId = new Map(restored.map(service => [service.agentId, service]));
  if (byId.size !== cast.length || cast.some(agent => !byId.has(agent.id))) {
    throw new Error('Service directory must contain each Fork-Thirty agent exactly once');
  }

  return freezeDirectory({
    schema: 'fork-thirty-service-directory@1',
    revision: Number(parsed.revision),
    services: cast.map(agent => byId.get(agent.id) as AgentServiceState),
  });
}
