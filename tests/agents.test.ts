import { describe, expect, it } from 'vitest';
import { clone, hash } from '../src/runtime/data';
import { createGarageWorld, GARAGE_WORLDS, worldConfig } from '../src/runtime/garageWorlds';
import { authoredController } from '../src/runtime/controllers';
import { configuration } from '../src/runtime/environment';
import { recordEpisode, verifyReceipt } from '../src/runtime/receipts';
import { AgentError, DEFAULT_BUDGETS, TEMPLATE_VERSION, controllerSpec, freshNotebook, modelObservation, parseProposal, validateBudgets, validateController, validateNotebook, validateRequest, type ControllerSpec, type ProviderAdapter, type ProviderRequest } from '../src/agents/contracts';
import { mockAdapter } from '../src/agents/mock';
import { createAgentSession } from '../src/agents/session';
import { verifyAgentReceipt } from '../src/agents/receipts';
import { createModelExperiment, rerunModelExperiment, runModelExperiment, validateModelExperiment } from '../src/agents/experiments';
import { freshGarage, rememberGarage, validateGarage } from '../src/agents/notebook';

const providers = () => [mockAdapter()];
function session(world = 'survey' as typeof GARAGE_WORLDS[number], spec = controllerSpec(), options = {}) {
  const controllers: Record<string, ControllerSpec> = world === 'community' ? { engineer: spec, logistics: spec } : { pilot: spec };
  return createAgentSession({ config: worldConfig(world), controllers, providers: providers(), ...options });
}
async function finish(s: ReturnType<typeof session>) { for (let i = 0; i < 120 && !s.result().terminal && s.status !== 'ERROR' && s.ending !== 'budget'; i++) await s.step(); return verifyAgentReceipt(s.receipt()); }
function redigest<T extends { digest: string }>(v: T): T { const { digest: _digest, ...payload } = v; void _digest; return { ...v, digest: hash(payload) }; }
function request(): ProviderRequest { const s = session(); return { schema: 'provider-request@1', template: TEMPLATE_VERSION, controller: controllerSpec(), observation: s.observation(), context: { strategy: 'STATE_ONLY', recent: [], summary: [], notebook: null }, budgets: DEFAULT_BUDGETS }; }

describe('model controller boundary', () => {
  it.each(GARAGE_WORLDS)('%s exposes detached observations and uses authority for every action', async world => {
    const w = createGarageWorld(worldConfig(world)), id = w.agents[0], before = w.stateHash(), o = modelObservation(w, id, 'a'.repeat(24), 1, DEFAULT_BUDGETS);
    expect(Object.isFrozen(o.state)).toBe(true); expect(JSON.stringify(o)).not.toContain('"random"'); expect(JSON.stringify(o)).not.toContain('"cache"');
    expect(() => w.step(id, { type: 'teleport' })).toThrow(); expect(() => w.step(id, { type: w.legalActions(id)[0].type, score: 100 })).toThrow(); expect(w.stateHash()).toBe(before);
    const r = await finish(session(world)); expect(r.result.success).toBe(true); expect(r.records.every(row => row.validated?.action.type === row.transition?.action.type)).toBe(true);
  });
  it.each(['not JSON', '{}', '{"action":{"type":"east","position":4}}', '{"action":{"type":"east"},"score":100}', '{"action":{"type":"east"},"confidence":2}', '{"action":{"type":"east"},"chain_of_thought":"hidden"}'])('rejects malformed data %s', text => expect(() => parseProposal(text, [{ type: 'east' }], DEFAULT_BUDGETS)).toThrow(AgentError));
  it('rejects unknown actions, empty/oversized output and extra controller metadata', () => {
    expect(() => parseProposal('{"action":{"type":"teleport"}}', [{ type: 'east' }], DEFAULT_BUDGETS)).toThrow(/unavailable/);
    expect(() => parseProposal('', [], DEFAULT_BUDGETS)).toThrow(/empty/); expect(() => parseProposal('x'.repeat(4097), [], DEFAULT_BUDGETS)).toThrow(/byte/);
    expect(() => validateController({ ...controllerSpec(), apiKey: 'secret' })).toThrow(); expect(() => validateRequest({ ...request(), template: 'mission@999' })).toThrow();
    expect(() => validateBudgets({ ...DEFAULT_BUDGETS, retries: 99 })).toThrow(); expect(() => validateNotebook({ ...freshNotebook(), plans: ['x'.repeat(161)] })).toThrow();
  });
  it('records illegal proposals and bounded retries without executing them', async () => {
    const spec = controllerSpec(); spec.settings.mockMode = 'alternating'; const s = session('signal-maze', spec), r = await finish(s);
    expect(r.result.success).toBe(true); expect(r.records).toHaveLength(6); expect(r.records.every(row => row.attempts.length === 2 && row.attempts[0].code === 'ILLEGAL_ACTION' && row.attempts[0].proposed?.type === 'teleport')).toBe(true);
  });
  it.each(['malformed', 'refusal', 'oversized', 'illegal'] as const)('%s is an inspectable error and leaves the world unchanged', async mode => {
    const spec = controllerSpec(); spec.settings.mockMode = mode; const s = session('survey', spec), before = s.receipt().initialHash; await s.step();
    const r = verifyAgentReceipt(s.receipt()); expect(s.status).toBe('ERROR'); expect(r.finalHash).toBe(before); expect(r.result.ticks).toBe(0); expect(r.records[0].attempts).toHaveLength(2);
  });
  it('timeouts obey the retry cap and cannot advance a world', async () => {
    const spec = controllerSpec(); spec.settings.mockMode = 'timeout'; const s = session('survey', spec, { budgets: { ...DEFAULT_BUDGETS, timeoutMs: 10 } }); await s.step();
    const r = verifyAgentReceipt(s.receipt()); expect(r.records[0].attempts.map(a => a.code)).toEqual(['TIMEOUT', 'TIMEOUT']); expect(r.result.ticks).toBe(0);
  });
  it('pause, stop and manual takeover discard stale responses; handoffs keep the same world', async () => {
    let complete!: (value: { text: string; model: string; usage: { inputTokens: null; outputTokens: null } }) => void;
    let first = true; const delegate = mockAdapter();
    const delayed: ProviderAdapter = { ...delegate, propose: (r, signal) => { if (!first) return delegate.propose(r, signal); first = false; return new Promise(resolve => { complete = resolve; }); } };
    const s = session('survey', controllerSpec(), { providers: [delayed] }), pending = s.step(); s.pause(); expect(s.status).toBe('PAUSED'); expect(await pending).toBeNull();
    complete({ text: '{"action":{"type":"east"}}', model: 'mock-policy', usage: { inputTokens: null, outputTokens: null } }); expect(s.result().ticks).toBe(0);
    s.handoff('pilot', controllerSpec('human'), 'Manual takeover.'); await s.step({ type: 'scan' }); expect(s.result().ticks).toBe(1);
    s.handoff('pilot', controllerSpec('reference')); await s.step(); s.handoff('pilot', controllerSpec()); await s.step(); s.handoff('pilot', controllerSpec('human'));
    const r = verifyAgentReceipt(s.receipt()); expect(r.handoffs).toHaveLength(4); expect(r.records.map(row => row.controller.family)).toEqual(['human', 'reference', 'model']);
    s.stop(); expect(await s.step({ type: 'east' })).toBeNull(); expect(s.result().ticks).toBe(3); expect(verifyAgentReceipt(s.receipt()).ending).toBe('stopped');
  });
  it('provider disconnect, mismatched model and request budgets are explicit', async () => {
    const s = session('survey', controllerSpec(), { providers: [] }); await s.step(); expect(s.lastError).toBe('DISCONNECTED'); expect(verifyAgentReceipt(s.receipt()).result.ticks).toBe(0);
    const wrong: ProviderAdapter = { ...mockAdapter(), async propose() { return { text: '{"action":{"type":"scan"}}', model: 'other', usage: { inputTokens: null, outputTokens: null } }; } };
    const m = session('survey', controllerSpec(), { providers: [wrong] }); await m.step(); expect(m.lastError).toBe('VERSION');
    const budget = session('survey', controllerSpec(), { budgets: { ...DEFAULT_BUDGETS, maxTicks: 2, maxRequests: 2 } }); await budget.step(); await budget.step(); await budget.step(); expect(budget.receipt().ending).toBe('budget'); expect(verifyAgentReceipt(budget.receipt()).result.ticks).toBe(2);
  });
  it('partial observation requires scans with a measurable information cost', () => {
    const w = createGarageWorld(worldConfig('survey', 3)); expect(w.observe('pilot').target).toBeNull(); expect(w.observe('pilot').state.scanned).toEqual([-1,-1,-1,-1,-1,-1]);
    const energy = Number(w.observe('pilot').state.energy); w.step('pilot', { type: 'scan' }); expect(w.observe('pilot').state.scanned).toEqual([0,-1,-1,-1,-1,-1]); expect(w.result().resources).toBe(energy - 2); expect(w.result().ticks).toBe(1);
  });
  it('cooperation enforces ordered roles and bounded explicit signals', async () => {
    const w = createGarageWorld(worldConfig('community')), initial = w.stateHash(); expect(w.legalActions('logistics')).toEqual([]);
    expect(() => w.step('logistics', { type: 'restore:power' })).toThrow(); expect(() => w.step('engineer', { type: 'deliver:supplies' })).toThrow(); expect(w.stateHash()).toBe(initial);
    for (let i = 0; i < 12; i++) w.step(i % 2 ? 'logistics' : 'engineer', { type: 'signal:ready' }); expect((w.observe('engineer').state.signals as unknown[])).toHaveLength(8);
    const r = await finish(session('community')); expect(r.result.success).toBe(true); expect(new Set(r.records.map(row => row.observation.agent.id)).size).toBe(2);
  });
  it.each(['STATE_ONLY', 'RECENT_WINDOW', 'EVENT_SUMMARY', 'BOUNDED_EPISODE_MEMORY'] as const)('%s is bounded, inspectable and replayable', async context => {
    const r = await finish(session('survey', controllerSpec(), { context })); expect(verifyAgentReceipt(r)).toEqual(r); expect(r.records.at(-1)!.context.strategy).toBe(context); expect(r.records.every(row => row.context.recent.length <= 6)).toBe(true);
  });
  it('world replay rejects redigested observation/action/result tampering and supports V6 independently', async () => {
    const r = clone(await finish(session('signal-maze')));
    for (const mutate of [(v: typeof r) => { v.records[0].observation.state.progress = 4; }, (v: typeof r) => { v.records[0].transition!.reward = 999; }, (v: typeof r) => { v.result.score = 1; }, (v: typeof r) => { v.records[0].validated!.action.type = 'wait'; }]) { const v = clone(r); mutate(v); expect(() => verifyAgentReceipt(redigest(v))).toThrow(); }
    expect(verifyReceipt(recordEpisode(configuration('sports', 3), authoredController('sports'))).schema).toBe('episode@1');
  });
  it('frozen model experiments preserve split isolation, transfer and deterministic mock reruns', async () => {
    const spec = createModelExperiment('survey', controllerSpec(), controllerSpec('reference'), 'explorer', 3, 'EVENT_SUMMARY', DEFAULT_BUDGETS, 1), before = clone(spec.controllers);
    const output = await runModelExperiment(spec, providers()); expect(output.manifest.report!.trials).toHaveLength(8); expect(spec.controllers).toEqual(before);
    const rerun = await rerunModelExperiment(output.manifest, providers()); expect(rerun.worldReplayMatch).toBe(true); expect(rerun.modelRegenerationMatch).toBe(true);
    const invalid = clone(output.manifest); invalid.seeds.HOLDOUT[0] = invalid.seeds.TRAIN[0]; expect(() => validateModelExperiment(redigest(invalid))).toThrow();
    const saved = rememberGarage(freshGarage(), output.receipt, output.manifest); expect(validateGarage(saved)).toEqual(saved); expect(validateGarage(undefined)).toEqual(freshGarage());
  });
});
