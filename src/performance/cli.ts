import { FamilySession } from '../families/session.ts';
import { createFamilyEnvironment } from '../families/runtime.ts';
import { requireData } from '../families/specs.ts';
import { parseJSON } from '../runtime/data.ts';
import { baselineController } from '../worlds/receipts.ts';
import { composeScore, defaultRenderSettings, performanceConfig, validateBundle, voicesForScore } from './specs.ts';
import { renderPerformance } from './render.ts';
import type { PerformanceMode } from './types.ts';

export async function performanceCommand(command: string, args: string[], input: string | null = null) {
  const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  if (command === 'render') { requireData(input, 'Supply a local performance bundle.'); return renderPerformance(validateBundle(parseJSON(input, 1250000))); }
  if (command === 'verify') { requireData(input, 'Supply a local performance bundle.'); const b = validateBundle(parseJSON(input, 1250000)); return { verified: true, digest: b.performance.digest }; }
  requireData(['compose', 'run'].includes(command), 'Use compose, run, render or verify.');
  const mode = (option('--mode') ?? 'choir') as PerformanceMode, seed = Number(option('--seed') ?? 17);
  const score = composeScore(mode, seed, Number(option('--key') ?? 0), Number(option('--tempo') ?? 108), Number(option('--meter') ?? 4));
  if (command === 'compose') return performanceConfig(score, seed);
  const kind = option('--controller') ?? 'baseline'; requireData(['baseline', 'mock'].includes(kind), 'Use baseline or offline mock.');
  const config = performanceConfig(score, seed), env = createFamilyEnvironment(config), controller = { ...baselineController('performance-controller'), ...(kind === 'mock' ? { family: 'model' as const, provider: 'mock' as const, model: 'mock-policy' } : {}) };
  const session = new FamilySession(config, Object.fromEntries(env.roles.map(role => [role, controller])));
  while (!session.env.result().terminal) requireData(await session.step(), session.error || 'Performance halted.');
  return validateBundle({ schema: 'performance-bundle@1', performance: session.receipt(), voices: voicesForScore(score), settings: defaultRenderSettings() });
}
