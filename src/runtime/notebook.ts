import { clone, exact, plain } from './data.ts';
import { validateExperiment, type Experiment } from './experiments.ts';
import { validatePackage, type ControllerPackage } from './packages.ts';
import { verifyReceipt, type Receipt } from './receipts.ts';

export interface LabSave { experiments: Experiment[]; receipt: Receipt | null; controller: ControllerPackage | null }
export const freshLab = (): LabSave => ({ experiments: [], receipt: null, controller: null });
export function validateLab(input: unknown): LabSave {
  if (input === undefined) return freshLab();
  if (!plain(input) || !exact(input, ['experiments', 'receipt', 'controller']) || !Array.isArray(input.experiments) || input.experiments.length > 3 || JSON.stringify(input).length > 600000) throw new Error('Invalid or excessive experiment notebook.');
  return { experiments: input.experiments.map(validateExperiment), receipt: input.receipt === null ? null : verifyReceipt(input.receipt), controller: input.controller === null ? null : validatePackage(input.controller) };
}
export function rememberExperiment(lab: LabSave, manifest: Experiment, controller: ControllerPackage, receipt: Receipt): LabSave {
  return { experiments: [clone(manifest), ...lab.experiments.filter(e => e.experimentId !== manifest.experimentId)].slice(0, 3), controller: clone(controller), receipt: clone(receipt) };
}
