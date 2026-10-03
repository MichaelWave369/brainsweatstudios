import { AGENT_VERSION, AgentError, type ProviderAdapter, type ProviderRequest } from './contracts.ts';
import { referenceAction } from './reference.ts';
export function mockAdapter(): ProviderAdapter {
  return { id: 'mock', version: AGENT_VERSION, async models() { return [{ id: 'mock-policy', sizeBytes: null, contextLength: null, capabilities: ['deterministic', 'structured', 'fault-injection'], digest: null, local: true }]; }, async propose(request: ProviderRequest, signal: AbortSignal) {
    const mode = request.controller.settings.mockMode;
    if (signal.aborted) throw new AgentError('CANCELLED', 'Mock request was cancelled.');
    if (mode === 'timeout') await new Promise<never>((_, reject) => { const aborted = () => reject(new AgentError('CANCELLED', 'Mock request was cancelled.')); signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted(); });
    if (mode === 'refusal') throw new AgentError('REFUSAL', 'Mock provider declined to act.');
    const action = mode === 'legal' ? request.observation.legalActions[0] : mode === 'blocked' ? { type: request.observation.legalActions.some(a => a.type === 'west') ? 'west' : request.observation.legalActions[0].type } : mode === 'task-failure' ? { type: request.observation.legalActions.some(a => a.type === 'interact') ? 'interact' : request.observation.legalActions[0].type } : mode === 'resource-failure' ? { type: request.observation.legalActions.some(a => a.type === 'wait') ? 'wait' : 'coast' } : referenceAction(request.observation);
    const text = mode === 'malformed' ? '{not json' : mode === 'oversized' ? 'x'.repeat(request.budgets.responseBytes + 1) : mode === 'illegal' || mode === 'alternating' && request.observation.sequence % 2 === 1 ? JSON.stringify({ action: { type: 'teleport' } }) : JSON.stringify({ action, note: 'Deterministic public-observation policy.' });
    return { text, usage: { inputTokens: null, outputTokens: null }, model: request.controller.model };
  } };
}
