import { AGENT_VERSION, AgentError, type ProviderAdapter, type ProviderRequest } from './contracts.ts';
import { referenceAction } from './reference.ts';
import { choosePublicAction } from '../worlds/controllers.ts';
import type { WorldObservation } from '../worlds/types.ts';
import { chooseFamilyAction } from '../families/runtime.ts';
import { FAMILY_IDS, type FamilyId, type FamilyObservation } from '../families/types.ts';
export function mockAdapter(): ProviderAdapter {
  return { id: 'mock', version: AGENT_VERSION, async models() { return [{ id: 'mock-policy', sizeBytes: null, contextLength: null, capabilities: ['deterministic', 'structured', 'fault-injection'], digest: null, local: true }]; }, async propose(request: ProviderRequest, signal: AbortSignal) {
    const mode = request.controller.settings.mockMode;
    if (signal.aborted) throw new AgentError('CANCELLED', 'Mock request was cancelled.');
    if (mode === 'timeout') await new Promise<never>((_, reject) => { const aborted = () => reject(new AgentError('CANCELLED', 'Mock request was cancelled.')); signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted(); });
    if (mode === 'refusal') throw new AgentError('REFUSAL', 'Mock provider declined to act.');
    const action = mode === 'legal' ? request.observation.legalActions[0] : mode === 'blocked' && request.observation.sequence <= 2 ? { type: request.observation.legalActions.some(a => a.type === 'west') ? 'west' : request.observation.legalActions[0].type } : mode === 'task-failure' && request.observation.sequence === 1 ? { type: request.observation.legalActions.some(a => a.type === 'interact') ? 'interact' : request.observation.legalActions[0].type } : mode === 'resource-failure' && request.observation.sequence <= 6 ? { type: request.observation.legalActions.some(a => a.type === 'wait') ? 'wait' : 'coast' } : request.observation.schema === 'model-observation@2' ? {type:'wait'} : referenceAction(request.observation);
    const worldAction = request.observation.schema === 'model-observation@2' ? { type: FAMILY_IDS.includes(request.observation.world as FamilyId) ? chooseFamilyAction(request.observation.state.familyPublic as FamilyObservation) : choosePublicAction({role:request.observation.agent.role,resources:request.observation.state.resources as WorldObservation['resources'],entities:request.observation.state.entities as WorldObservation['entities'],flags:request.observation.state.flags as WorldObservation['flags'],legal:request.observation.legalActions.map(a=>a.type)}) } : action;
    const text = mode === 'malformed' ? '{not json' : mode === 'oversized' ? 'x'.repeat(request.budgets.responseBytes + 1) : mode === 'illegal' || mode === 'alternating' && request.observation.sequence % 2 === 1 ? JSON.stringify({ action: { type: 'teleport' } }) : JSON.stringify({ action:worldAction, note: 'Deterministic public-observation policy.' });
    return { text, usage: { inputTokens: null, outputTokens: null }, model: request.controller.model };
  } };
}
