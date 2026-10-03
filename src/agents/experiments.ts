import { canonical, clone, exact, freeze, hash, integer, plain } from '../runtime/data.ts';
import { curriculum, seedGroups } from '../runtime/curriculum.ts';
import { createGarageWorld, validateWorldConfig, worldConfig, type WorldConfig, type WorldId } from '../runtime/garageWorlds.ts';
import { ACTION_VERSION, OBSERVATION_VERSION, AgentError, CONTEXTS, DEFAULT_BUDGETS, TEMPLATE_VERSION, bytes, controllerSpec, validateBudgets, validateController, type Budgets, type ContextStrategy, type ControllerSpec, type ProviderAdapter } from './contracts.ts';
import { createAgentSession, type AgentReceipt, type AgentSession } from './session.ts';
import { verifyAgentReceipt } from './receipts.ts';

export interface TrialMetric { split: 'TRAIN' | 'VALIDATION' | 'HOLDOUT'; transfer: boolean; candidate: boolean; seed: number; success: boolean; score: number; ticks: number; resources: number; invalid: number; timeouts: number; retries: number; requests: number; blocked: number; failures: string[]; worldHash: string; modelHash: string }
export interface ModelReport { trials: TrialMetric[]; transferDelta: number; baselineDelta: number; totalRequests: number; recovery: { rejectedThenValid: number; failedTurns: number; blockedThenProgress: number }; usage: { inputTokens: number | null; outputTokens: number | null; monetaryCost: 'UNKNOWN' } }
export interface ModelExperiment {
  schema: 'model-experiment@1'; agentVersion: '1.0.0'; template: typeof TEMPLATE_VERSION; observationSchema: typeof OBSERVATION_VERSION; actionSchema: typeof ACTION_VERSION;
  id: string; config: WorldConfig; curriculum: string; seed: number;
  seeds: ReturnType<typeof seedGroups>; trialsPerSplit: number; maxTotalRequests: number;
  controllers: Record<string, ControllerSpec>; baseline: Record<string, ControllerSpec>;
  context: ContextStrategy; budgets: Budgets; report: ModelReport | null; digest: string;
}
function envelope(spec: Omit<ModelExperiment, 'id' | 'digest'>): ModelExperiment {
  const { report: _report, ...identity } = spec; void _report;
  const payload = { ...spec, id: hash(identity).slice(0, 24) }; return freeze({ ...payload, digest: hash(payload) });
}
export function createModelExperiment(world: WorldId, candidate: ControllerSpec, baseline = controllerSpec('reference'), stage = 'explorer', seed = 3, context: ContextStrategy = 'STATE_ONLY', budgets: Budgets = DEFAULT_BUDGETS, trialsPerSplit = 2, second?: ControllerSpec): ModelExperiment {
  const c = validateController(candidate), b = validateController(baseline), definition = curriculum(stage), config = worldConfig(world, 0, definition.difficulty, definition.trainingVariant), agents = createGarageWorld(config).agents;
  return validateModelExperiment(envelope({ schema: 'model-experiment@1', agentVersion: '1.0.0', template: TEMPLATE_VERSION, observationSchema: OBSERVATION_VERSION, actionSchema: ACTION_VERSION, config, curriculum: stage, seed, seeds: seedGroups(seed), trialsPerSplit, maxTotalRequests: 2000, controllers: Object.fromEntries(agents.map((id, i) => [id, i === 1 && second ? validateController(second) : c])), baseline: Object.fromEntries(agents.map(id => [id, b])), context, budgets: validateBudgets(budgets), report: null }));
}
export function validateModelExperiment(v: unknown): ModelExperiment {
  if (!plain(v) || !exact(v, ['schema', 'agentVersion', 'template', 'observationSchema', 'actionSchema', 'id', 'config', 'curriculum', 'seed', 'seeds', 'trialsPerSplit', 'maxTotalRequests', 'controllers', 'baseline', 'context', 'budgets', 'report', 'digest']) || v.schema !== 'model-experiment@1' || v.agentVersion !== '1.0.0' || v.template !== TEMPLATE_VERSION || v.observationSchema !== OBSERVATION_VERSION || v.actionSchema !== ACTION_VERSION || typeof v.curriculum !== 'string' || !integer(v.seed, 0, 99) || !integer(v.trialsPerSplit, 1, 4) || !integer(v.maxTotalRequests, 1, 6000) || !plain(v.controllers) || !plain(v.baseline) || !CONTEXTS.includes(v.context as ContextStrategy) || bytes(v) > 100000) throw new Error('Invalid or incompatible model experiment manifest.');
  const config = validateWorldConfig(v.config), definition = curriculum(v.curriculum), budgets = validateBudgets(v.budgets), agents = createGarageWorld(config).agents;
  if (config.seed !== 0 || config.difficulty !== definition.difficulty || config.variant !== definition.trainingVariant || canonical(v.seeds) !== canonical(seedGroups(v.seed))) throw new Error('Model experiment seeds or curriculum differ.');
  for (const group of [v.controllers, v.baseline]) { if (Object.keys(group).sort().join(',') !== [...agents].sort().join(',')) throw new Error('Every role needs one frozen controller.'); for (const value of Object.values(group)) { const c = validateController(value); if (c.family === 'human') throw new Error('Frozen experiments cannot await human actions.'); if (c.package && c.package.compatible[0].environment !== config.world) throw new Error('Frozen package is incompatible with this experiment.'); } }
  if (v.report !== null) {
    const report = v.report;
    if (!plain(report) || !exact(report, ['trials', 'transferDelta', 'baselineDelta', 'totalRequests', 'recovery', 'usage']) || !Array.isArray(report.trials) || report.trials.length !== v.trialsPerSplit * 8 || !integer(report.totalRequests, 0, v.maxTotalRequests) || !plain(report.recovery) || !exact(report.recovery, ['rejectedThenValid', 'failedTurns', 'blockedThenProgress']) || !Object.values(report.recovery).every(n => integer(n, 0, 6000)) || !plain(report.usage) || !exact(report.usage, ['inputTokens', 'outputTokens', 'monetaryCost']) || report.usage.monetaryCost !== 'UNKNOWN' || !['inputTokens', 'outputTokens'].every(k => report.usage && plain(report.usage) && (report.usage[k] === null || integer(report.usage[k], 0, 100000000)))) throw new Error('Invalid bounded model report.');
    const groups = [{ split: 'TRAIN', transfer: false }, { split: 'VALIDATION', transfer: false }, { split: 'HOLDOUT', transfer: false }, { split: 'HOLDOUT', transfer: true }];
    for (let i = 0; i < report.trials.length; i++) {
      const trial = report.trials[i], group = groups[Math.floor(i / (v.trialsPerSplit * 2))], candidate = i % (v.trialsPerSplit * 2) < v.trialsPerSplit, seed = seedGroups(v.seed)[group.split as 'TRAIN'][i % v.trialsPerSplit];
      if (!plain(trial) || !exact(trial, ['split', 'transfer', 'candidate', 'seed', 'success', 'score', 'ticks', 'resources', 'invalid', 'timeouts', 'retries', 'requests', 'blocked', 'failures', 'worldHash', 'modelHash']) || trial.split !== group.split || trial.transfer !== group.transfer || trial.candidate !== candidate || trial.seed !== seed || typeof trial.success !== 'boolean' || !['score', 'resources'].every(k => typeof trial[k] === 'number' && Number.isFinite(trial[k]) && Number(trial[k]) >= 0 && Number(trial[k]) <= 100) || !integer(trial.ticks, 0, budgets.maxTicks) || !['invalid', 'timeouts', 'retries', 'requests', 'blocked'].every(k => integer(trial[k], 0, budgets.maxRequests)) || !Array.isArray(trial.failures) || trial.failures.length > 16 || !trial.failures.every(s => typeof s === 'string' && s.length <= 40) || !['worldHash', 'modelHash'].every(k => typeof trial[k] === 'string' && /^[a-f0-9]{64}$/.test(trial[k] as string))) throw new Error('Invalid measured trial.');
    }
    const deltas = reportDeltas(report.trials as unknown as TrialMetric[]); if (report.transferDelta !== deltas.transferDelta || report.baselineDelta !== deltas.baselineDelta || report.totalRequests !== report.trials.reduce((n, t) => n + Number(t.requests), 0)) throw new Error('Model summary differs from measured trials.');
  }
  const { digest, id, report: _report, ...identity } = v; void _report;
  const { digest: _digest, ...payload } = v; void _digest;
  if (id !== hash(identity).slice(0, 24) || digest !== hash(payload)) throw new Error('Model manifest integrity differs.');
  return freeze(clone(v)) as unknown as ModelExperiment;
}
function reportDeltas(trials: TrialMetric[]) {
  const rate = (filter: (t: TrialMetric) => boolean) => { const rows = trials.filter(filter); return rows.filter(t => t.success).length / rows.length * 100; };
  return { transferDelta: rate(t => t.candidate && t.transfer) - rate(t => t.candidate && t.split === 'HOLDOUT' && !t.transfer), baselineDelta: rate(t => t.candidate && t.split === 'HOLDOUT' && !t.transfer) - rate(t => !t.candidate && t.split === 'HOLDOUT' && !t.transfer) };
}
export async function* modelExperimentSteps(input: ModelExperiment, providers: ProviderAdapter[], signal: AbortSignal, control?: { beforeStep: () => Promise<void>; session: (session: AgentSession | null) => void }): AsyncGenerator<{ completed: number; total: number; receipt: AgentReceipt }, { manifest: ModelExperiment; receipt: AgentReceipt }> {
  const spec = validateModelExperiment(input), trials: TrialMetric[] = [], recovery = { rejectedThenValid: 0, failedTurns: 0, blockedThenProgress: 0 };
  let totalRequests = 0, inputTokens: number | null = null, outputTokens: number | null = null, last: AgentReceipt | null = null;
  const groups = [{ split: 'TRAIN', transfer: false }, { split: 'VALIDATION', transfer: false }, { split: 'HOLDOUT', transfer: false }, { split: 'HOLDOUT', transfer: true }] as const;
  for (const group of groups) for (const candidate of [true, false]) for (const seed of spec.seeds[group.split].slice(0, spec.trialsPerSplit)) {
    if (signal.aborted) throw new AgentError('CANCELLED', 'Model experiment cancelled.');
    const session = createAgentSession({ config: { ...spec.config, seed, variant: group.transfer ? 'transfer' : spec.config.variant }, controllers: candidate ? spec.controllers : spec.baseline, providers, context: spec.context, budgets: spec.budgets });
    control?.session(session);
    const cancel = () => session.stop(); signal.addEventListener('abort', cancel, { once: true });
    try { while (!session.result().terminal && session.status !== 'ERROR' && session.ending !== 'budget') { await control?.beforeStep(); if (signal.aborted) throw new AgentError('CANCELLED', 'Model experiment cancelled.'); if (totalRequests + (session.controllers[session.actor()].family === 'model' ? spec.budgets.retries + 1 : 1) > spec.maxTotalRequests) throw new AgentError('BUDGET', 'Experiment reached its total request limit.'); const count = session.requestCount; const row = await session.step(); totalRequests += session.requestCount - count; if (signal.aborted) throw new AgentError('CANCELLED', 'Model experiment cancelled.'); if (!row && session.status !== 'PAUSED') break; } }
    finally { signal.removeEventListener('abort', cancel); control?.session(null); }
    last = verifyAgentReceipt(session.receipt());
    const attempts = last.records.flatMap(r => r.attempts), failures = [...new Set([...attempts.flatMap(a => a.code ? [a.code] : []), ...(last.result.success ? [] : [last.result.reason === 'running' ? last.ending : last.result.reason])])];
    last.records.forEach((r, i) => { if (r.transition && r.attempts.some(a => a.code)) recovery.rejectedThenValid++; if (!r.transition) recovery.failedTurns++; if (i > 0 && last!.records[i - 1].transition?.events.some(e => ['blocked', 'collision', 'precondition'].includes(e.type)) && r.transition?.events.some(e => e.type === 'objective')) recovery.blockedThenProgress++; });
    attempts.forEach(a => { if (a.usage.inputTokens !== null) inputTokens = (inputTokens ?? 0) + a.usage.inputTokens; if (a.usage.outputTokens !== null) outputTokens = (outputTokens ?? 0) + a.usage.outputTokens; });
    trials.push({ ...group, candidate, seed, success: last.result.success, score: last.result.score, ticks: last.result.ticks, resources: last.result.resources, invalid: attempts.filter(a => ['ILLEGAL_ACTION', 'MALFORMED', 'OVERSIZED', 'EMPTY'].includes(String(a.code))).length, timeouts: attempts.filter(a => a.code === 'TIMEOUT').length, retries: last.records.reduce((n, r) => n + Math.max(0, r.attempts.length - 1), 0), requests: last.requestsUsed, blocked: last.result.collisions, failures, worldHash: last.worldTraceHash, modelHash: last.modelTraceHash });
    yield { completed: trials.length, total: spec.trialsPerSplit * 8, receipt: last };
  }
  const { id: _id, digest: _digest, ...initialSpec } = spec; void _id; void _digest;
  const manifest = envelope({ ...initialSpec, report: { trials, ...reportDeltas(trials), totalRequests, recovery, usage: { inputTokens, outputTokens, monetaryCost: 'UNKNOWN' } } });
  return { manifest: validateModelExperiment(manifest), receipt: last! };
}
export async function runModelExperiment(spec: ModelExperiment, providers: ProviderAdapter[], signal = new AbortController().signal) {
  const iterator = modelExperimentSteps(spec, providers, signal); while (true) { const row = await iterator.next(); if (row.done) return row.value; }
}
export async function rerunModelExperiment(input: ModelExperiment, providers: ProviderAdapter[], signal?: AbortSignal) {
  const spec = validateModelExperiment(input), result = await runModelExperiment(spec, providers, signal);
  return { ...result, worldReplayMatch: spec.report !== null && canonical(spec.report.trials.map(t => t.worldHash)) === canonical(result.manifest.report!.trials.map(t => t.worldHash)), modelRegenerationMatch: spec.report !== null && canonical(spec.report.trials.map(t => t.modelHash)) === canonical(result.manifest.report!.trials.map(t => t.modelHash)) };
}
