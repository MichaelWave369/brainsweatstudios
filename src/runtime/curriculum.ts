import { configuration } from './environment.ts';
import { integer } from './data.ts';
import type { EnvironmentId, Split, Variant } from './types.ts';

export interface CurriculumStage { id: string; title: string; difficulty: number; trainingVariant: Variant; lesson: string }
export const CURRICULUM: readonly CurriculumStage[] = [
  { id: 'explorer', title: 'Foundation · Explorer', difficulty: 0, trainingVariant: 'standard', lesson: 'Reach a direct objective with the original rules.' },
  { id: 'builder', title: 'Constraints · Builder', difficulty: 1, trainingVariant: 'standard', lesson: 'Complete more objectives before the tick limit.' },
  { id: 'master', title: 'Endurance · Master', difficulty: 2, trainingVariant: 'standard', lesson: 'Manage longer routes and delayed consequences.' },
  { id: 'reserves', title: 'Limited reserves', difficulty: 2, trainingVariant: 'constraints', lesson: 'Lower arena reserves; rover has a 64-tick limit.' },
  { id: 'unseen', title: 'Unfamiliar conditions', difficulty: 2, trainingVariant: 'standard', lesson: 'Freeze the controller before testing changed layouts and dynamics.' },
  { id: 'transfer', title: 'Transfer check', difficulty: 2, trainingVariant: 'constraints', lesson: 'Train with constraints, then compare bounded transfer failures.' },
];
export function curriculum(id: string): CurriculumStage {
  const stage = CURRICULUM.find(s => s.id === id); if (!stage) throw new Error('Unknown curriculum stage.'); return stage;
}
export function seedGroups(seed: number): Record<Split, number[]> {
  if (!integer(seed, 0, 99)) throw new Error('Experiment seed must be 0–99.');
  const seeds = (base: number) => Array.from({ length: 8 }, (_, i) => base + seed * 101 + i * 17);
  return { TRAIN: seeds(1000), VALIDATION: seeds(40000), HOLDOUT: seeds(20000) };
}
export const episodeConfig = (environment: EnvironmentId, seed: number, stageId: string, mode: 'courier' | 'storm', transfer = false) => {
  const stage = curriculum(stageId); return configuration(environment, seed, stage.difficulty, transfer ? 'transfer' : stage.trainingVariant, mode);
};
export const TRANSFER_NOTES: Record<EnvironmentId, string> = {
  sports: 'Unseen barrier column and a 24-unit energy cap. The goal rules stay the same.',
  outpost: 'Unfamiliar supply sites and barriers, nine-unit water capacity and faster water use.',
  scenario: 'The task sites change order; observe, protect and dispatch still occur in that causal order.',
  space: 'Unseen relative positions and initial velocity, with a 68-unit fuel budget. The soft-dock limits stay the same.',
  rover: 'Unseen barriers and a shifted parcel site; windy mode increases drift from 12% to 22%. The 294-row learner still sees its original compressed observation index.',
};
