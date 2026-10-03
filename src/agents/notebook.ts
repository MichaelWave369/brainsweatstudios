import { clone, exact, plain } from '../runtime/data.ts';
import { bytes } from './contracts.ts';
import { validateModelExperiment, type ModelExperiment } from './experiments.ts';
import { verifyAgentReceipt } from './receipts.ts';
import type { AgentReceipt } from './session.ts';
export interface GarageSave { schema: 'agent-garage@1'; receipt: AgentReceipt | null; experiments: ModelExperiment[] }
export const freshGarage = (): GarageSave => ({ schema: 'agent-garage@1', receipt: null, experiments: [] });
export function validateGarage(input: unknown): GarageSave {
  if (input === undefined) return freshGarage();
  if (!plain(input) || !exact(input, ['schema', 'receipt', 'experiments']) || input.schema !== 'agent-garage@1' || !Array.isArray(input.experiments) || input.experiments.length > 2 || bytes(input) > 500000) throw new Error('Invalid or excessive agent garage save.');
  return { schema: 'agent-garage@1', receipt: input.receipt === null ? null : verifyAgentReceipt(input.receipt), experiments: input.experiments.map(validateModelExperiment) };
}
export function rememberGarage(save: GarageSave, receipt: AgentReceipt, manifest?: ModelExperiment): GarageSave {
  const result: GarageSave = { schema: 'agent-garage@1', receipt: clone(verifyAgentReceipt(receipt)), experiments: manifest ? [clone(validateModelExperiment(manifest)), ...save.experiments.filter(m => m.id !== manifest.id)].slice(0, 2) : clone(save.experiments) };
  // Preserve the current receipt and newest completed comparison; imported
  // legacy receipts may need all older comparison history removed to fit.
  while (bytes(result) > 500000 && result.experiments.length && (!manifest || result.experiments.length > 1)) result.experiments.pop();
  return validateGarage(result);
}
