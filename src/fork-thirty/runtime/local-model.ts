import { controllerSpec } from '../../agents/contracts';
import { createPassport, validatePassport } from '../../career/validation';
import type { AgentPassport } from '../../career/types';
import { FAMILY_IDS } from '../../families/types';
import { validateWorldController } from '../../worlds/receipts';
import { cast } from '../cast';
import type { ForkThirtyLocalModelBinding } from './contracts';

const castById = new Map(cast.map(agent => [agent.id, agent]));

function requireCast(agentId: string) {
  const agent = castById.get(agentId);
  if (!agent) throw new Error(`Unknown Fork-Thirty resident: ${agentId}`);
  return agent;
}

function validModelId(model: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(model);
}

export function createCastPassport(agentId: string): AgentPassport {
  const resident = requireCast(agentId);
  const base = createPassport(resident.id, resident.displayName);
  return validatePassport({
    ...base,
    compatibleWorlds: [...new Set([...base.compatibleWorlds, ...FAMILY_IDS])],
    publicCapabilities: [...new Set([...base.publicCapabilities, 'family-artifacts'])],
  });
}

export function createLocalModelBinding(
  agentId: string,
  model: string,
  overrides: Partial<Pick<ForkThirtyLocalModelBinding, 'context' | 'requestBudget' | 'timeoutMs' | 'temperature' | 'seed'>> = {},
): ForkThirtyLocalModelBinding {
  requireCast(agentId);
  if (!validModelId(model)) throw new Error('Choose a valid local model identifier.');

  const value: ForkThirtyLocalModelBinding = {
    schema: 'fork-thirty-local-model-binding@1',
    agentId,
    provider: 'ollama',
    model,
    transport: 'loopback-agent-bridge',
    policy: 'proposal-only',
    context: overrides.context ?? 'BOUNDED_NOTEBOOK',
    requestBudget: overrides.requestBudget ?? 512,
    timeoutMs: overrides.timeoutMs ?? 10000,
    temperature: overrides.temperature ?? 0,
    seed: overrides.seed ?? 369,
    authority: Object.freeze([]),
  };

  validateWorldController({
    id: `ft-${agentId}-local`,
    family: 'model',
    provider: 'ollama',
    model: value.model,
    baseline: 'maintenance-first',
    context: value.context,
    requestBudget: value.requestBudget,
    timeoutMs: value.timeoutMs,
    decisionInterval: 1,
    temperature: value.temperature,
    seed: value.seed,
  });

  return Object.freeze(value);
}

export function bindCastLocalModel(
  passport: AgentPassport,
  binding: ForkThirtyLocalModelBinding,
): AgentPassport {
  const current = validatePassport(passport);
  requireCast(binding.agentId);
  if (current.id !== binding.agentId) throw new Error('Local model binding must match the Fork-Thirty passport.');
  if (binding.schema !== 'fork-thirty-local-model-binding@1' || binding.provider !== 'ollama' || binding.transport !== 'loopback-agent-bridge' || binding.policy !== 'proposal-only' || binding.authority.length !== 0) {
    throw new Error('Invalid Fork-Thirty local model binding.');
  }

  const world = validateWorldController({
    ...current.controller.world,
    id: `ft-${binding.agentId}-local`,
    family: 'model',
    provider: 'ollama',
    model: binding.model,
    context: binding.context,
    requestBudget: binding.requestBudget,
    timeoutMs: binding.timeoutMs,
    decisionInterval: 1,
    temperature: binding.temperature,
    seed: binding.seed,
  });

  const garageBase = controllerSpec('model', 'ollama', binding.model);
  const garage = {
    ...garageBase,
    id: `ft-${binding.agentId}-garage`,
    settings: {
      ...garageBase.settings,
      temperature: binding.temperature,
      seed: binding.seed,
      format: 'schema' as const,
    },
  };

  return validatePassport({
    ...current,
    controller: { world, garage },
  });
}

export function isForkThirtyPassport(passport: Pick<AgentPassport, 'id'>): boolean {
  return castById.has(passport.id);
}
