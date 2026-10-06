import type { WorldController } from '../../worlds/receipts';

export interface ForkThirtyLocalModelBinding {
  schema: 'fork-thirty-local-model-binding@1';
  agentId: string;
  provider: 'ollama';
  model: string;
  transport: 'loopback-agent-bridge';
  policy: 'proposal-only';
  context: WorldController['context'];
  requestBudget: number;
  timeoutMs: number;
  temperature: number;
  seed: number;
  authority: readonly [];
}
