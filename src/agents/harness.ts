import { GARAGE_WORLDS, worldConfig } from '../runtime/garageWorlds.ts';
import { DEFAULT_BUDGETS, controllerSpec, type ControllerSpec } from './contracts.ts';
import { createAgentSession } from './session.ts';
import { verifyAgentReceipt } from './receipts.ts';
import { mockAdapter } from './mock.ts';
import { createModelExperiment, rerunModelExperiment, runModelExperiment } from './experiments.ts';

export async function runAgentHarness() {
  const started = performance.now(), providers = [mockAdapter()]; let episodes = 0, ticks = 0, successes = 0, replays = 0;
  for (const world of GARAGE_WORLDS) for (const variant of ['standard', 'transfer'] as const) for (const seed of [3, 20017]) {
    const controllers: Record<string, ControllerSpec> = world === 'community' ? { engineer: controllerSpec(), logistics: controllerSpec() } : { pilot: controllerSpec() };
    const session = createAgentSession({ config: worldConfig(world, seed, 1, variant), controllers, providers });
    while (!session.result().terminal && session.status !== 'ERROR' && session.ending !== 'budget') await session.step();
    const receipt = verifyAgentReceipt(session.receipt()); episodes++; ticks += receipt.result.ticks; successes += Number(receipt.result.success); replays++;
  }
  const fault = controllerSpec(); fault.settings.mockMode = 'alternating';
  const session = createAgentSession({ config: worldConfig('signal-maze'), controllers: { pilot: fault }, providers });
  while (!session.result().terminal) await session.step();
  if (!session.result().success || !session.records.every(r => r.attempts[0].code === 'ILLEGAL_ACTION' && r.attempts.length === 2)) throw new Error('Bounded invalid-action recovery failed.');
  verifyAgentReceipt(session.receipt()); replays++;
  const spec = createModelExperiment('survey', controllerSpec(), controllerSpec('reference'), 'explorer', 3, 'RECENT_WINDOW', DEFAULT_BUDGETS, 1);
  const experiment = await runModelExperiment(spec, providers), rerun = await rerunModelExperiment(experiment.manifest, providers);
  if (!rerun.worldReplayMatch || !rerun.modelRegenerationMatch) throw new Error('Mock model experiment failed deterministic rerun.');
  return { agentVersion: '1.0.0', provider: 'deterministic-mock', episodes, ticks, successes, verifiedReplays: replays, frozenExperimentTrials: experiment.manifest.report!.trials.length, recoveredInvalidActions: session.records.length, milliseconds: Math.round(performance.now() - started), realModelRequired: false };
}
