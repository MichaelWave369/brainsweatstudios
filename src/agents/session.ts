import { clone, freeze, hash } from '../runtime/data.ts';
import { createGarageWorld, type Intent, type WorldConfig, type WorldResult, type WorldTransition } from '../runtime/garageWorlds.ts';
import { AgentError, DEFAULT_BUDGETS, TEMPLATE_VERSION, bytes, freshNotebook, hostNotebook, modelObservation, parseProposal, validateBudgets, validateController, validateRequest, type Budgets, type ContextData, type ContextStrategy, type ControllerSpec, type ErrorCode, type ModelObservation, type Notebook, type Proposal, type ProviderAdapter, type ProviderResponse } from './contracts.ts';
import { referenceAction } from './reference.ts';

export type AgentStatus = 'IDLE' | 'OBSERVING' | 'REQUESTING' | 'RECEIVED' | 'VALIDATING' | 'ACTING' | 'WAITING' | 'PAUSED' | 'COMPLETE' | 'ERROR';
export interface Attempt { sequence: number; providerMs: number; code: ErrorCode | null; proposed: Intent | null; note: string | null; confidence: number | null; usage: ProviderResponse['usage'] }
export interface AgentRecord { index: number; controller: ControllerSpec; observation: ModelObservation; context: ContextData; attempts: Attempt[]; validated: Proposal | null; transition: WorldTransition | null; stateHash: string; worldMs: number; notebook: Notebook }
export interface Handoff { tick: number; afterRecord: number; agentId: string; from: ControllerSpec; to: ControllerSpec; reason: string }
export interface AgentReceipt {
  schema: 'model-episode@1'; agentVersion: '1.0.0'; template: typeof TEMPLATE_VERSION;
  observationSchema: 'model-observation@1'; actionSchema: 'model-action@1';
  episode: string; config: WorldConfig; initialControllers: Record<string, ControllerSpec>;
  contextStrategy: ContextStrategy; budgets: Budgets; initialHash: string;
  records: AgentRecord[]; handoffs: Handoff[]; result: WorldResult; finalHash: string;
  ending: 'running' | 'complete' | 'stopped' | 'budget' | 'error'; requestsUsed: number; worldTraceHash: string; modelTraceHash: string; digest: string;
}
export interface SessionOptions { config: WorldConfig; controllers: Record<string, ControllerSpec>; providers: ProviderAdapter[]; budgets?: Budgets; context?: ContextStrategy; onChange?: () => void; now?: () => number }
export function contextData(strategy: ContextStrategy, records: readonly AgentRecord[], notebook: Notebook): ContextData {
  const events = records.flatMap(r => r.transition?.events || []), counts = new Map<string, number>();
  events.forEach(e => counts.set(e.type, (counts.get(e.type) || 0) + 1));
  return freeze({ strategy, recent: strategy === 'RECENT_WINDOW' ? records.filter(r => r.transition).slice(-6).map(r => ({ tick: r.observation.tick, action: r.validated!.action.type, events: r.transition!.events.slice(-8).map(e => e.detail) })) : [], summary: strategy === 'EVENT_SUMMARY' || strategy === 'BOUNDED_EPISODE_MEMORY' ? [...counts].slice(0, 12).map(([type, count]) => ({ type, count })) : [], notebook: strategy === 'BOUNDED_EPISODE_MEMORY' ? clone(notebook) : null });
}
export function traceHashes(config: WorldConfig, initialHash: string, records: readonly AgentRecord[], finalHash: string) {
  return { worldTraceHash: hash({ config, initialHash, actions: records.filter(r => r.transition).map(r => ({ agentId: r.observation.agent.id, action: r.validated!.action, transition: r.transition, stateHash: r.stateHash })), finalHash }), modelTraceHash: hash(records.map(r => ({ controller: r.controller, observation: r.observation, context: r.context, attempts: r.attempts.map(({ providerMs: _ms, ...a }) => { void _ms; return a; }), validated: r.validated, notebook: r.notebook }))) };
}
const unknownUsage = () => ({ inputTokens: null, outputTokens: null });
// Store only the action and optional short public note, never raw model output,
// thinking fields, response headers, connection tokens or provider error bodies.
function proposedSummary(text: string): Pick<Attempt, 'proposed' | 'note' | 'confidence'> {
  try { const v = JSON.parse(text); return { proposed: typeof v?.action?.type === 'string' && v.action.type.length <= 32 ? { type: v.action.type } : null, note: typeof v?.note === 'string' && v.note.length <= 200 ? v.note : null, confidence: typeof v?.confidence === 'number' && Number.isFinite(v.confidence) && v.confidence >= 0 && v.confidence <= 1 ? v.confidence : null }; } catch { return { proposed: null, note: null, confidence: null }; }
}
const errorCode = (e: unknown): ErrorCode => e instanceof AgentError ? e.code : 'UNAVAILABLE';
export function createAgentSession(options: SessionOptions) {
  const world = createGarageWorld(options.config), config = world.config, budgets = validateBudgets(options.budgets || DEFAULT_BUDGETS), strategy = options.context || 'STATE_ONLY';
  if (!['STATE_ONLY', 'RECENT_WINDOW', 'EVENT_SUMMARY', 'BOUNDED_EPISODE_MEMORY'].includes(strategy) || Object.keys(options.controllers).sort().join(',') !== [...world.agents].sort().join(',')) throw new AgentError('MALFORMED', 'Bind exactly one controller to every world actor.');
  const initialControllers = Object.fromEntries(world.agents.map(id => [id, validateController(options.controllers[id])])), controllers = { ...initialControllers };
  const providers = new Map(options.providers.map(p => [p.id, p])), initialHash = world.stateHash();
  const episode = hash({ config, initialControllers, budgets, strategy }).slice(0, 24), now = options.now || (() => performance.now());
  const records: AgentRecord[] = [], handoffs: Handoff[] = [], notes = Object.fromEntries(world.agents.map(id => [id, freshNotebook()]));
  let status: AgentStatus = 'IDLE', ending: AgentReceipt['ending'] = 'running', requests = 0, generation = 0, abort: AbortController | null = null, busy = false, paused = false, lastError: ErrorCode | null = null, continuous = false, currentObservation: ModelObservation | null = null;
  const update = (next: AgentStatus) => { status = next; options.onChange?.(); };
  const actor = () => world.observe(world.agents[0]).turn;
  const observation = (agentId = actor()) => modelObservation(world, agentId, episode, Math.min(240, requests + 1), budgets, records.filter(r => r.observation.agent.id === agentId && r.transition).at(-1)?.transition?.events || []);
  const cancelPending = () => { generation++; abort?.abort(); abort = null; };
  const receipt = (): AgentReceipt => {
    const payload = { schema: 'model-episode@1' as const, agentVersion: '1.0.0' as const, template: TEMPLATE_VERSION, observationSchema: 'model-observation@1' as const, actionSchema: 'model-action@1' as const, episode, config: clone(config), initialControllers: clone(initialControllers), contextStrategy: strategy, budgets: clone(budgets), initialHash, records: clone(records), handoffs: clone(handoffs), result: world.result(), finalHash: world.stateHash(), ending, requestsUsed: requests, ...traceHashes(config, initialHash, records, world.stateHash()) };
    return freeze({ ...payload, digest: hash(payload) });
  };
  async function invoke(provider: ProviderAdapter, request: Parameters<ProviderAdapter['propose']>[0], signal: AbortSignal): Promise<ProviderResponse> {
    let timer: ReturnType<typeof setTimeout>;
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([provider.propose(request, signal), new Promise<never>((_, reject) => {
        onAbort = () => reject(new AgentError('CANCELLED', 'Request cancelled.'));
        signal.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => { reject(new AgentError('TIMEOUT', 'Provider exceeded the request deadline.')); abort?.abort(); }, budgets.timeoutMs);
        if (signal.aborted) onAbort();
      })]);
    } finally { clearTimeout(timer!); signal.removeEventListener('abort', onAbort); }
  }
  async function step(manual?: Intent): Promise<AgentRecord | null> {
    if (busy || paused || ending === 'stopped' || world.result().terminal) return null;
    if (world.result().ticks >= budgets.maxTicks || requests >= budgets.maxRequests) { ending = 'budget'; continuous = false; lastError = 'BUDGET'; update('COMPLETE'); return null; }
    const agentId = actor(), spec = controllers[agentId];
    if (spec.family === 'human' && !manual) { continuous = false; update('WAITING'); return null; }
    busy = true; const revision = generation;
    let row: AgentRecord | null = null;
    try {
      update('OBSERVING'); const o = observation(agentId); currentObservation = o;
      const agentRecords = records.filter(r => r.observation.agent.id === agentId), context = contextData(strategy, agentRecords, notes[agentId]);
      row = { index: records.length, controller: spec, observation: o, context, attempts: [], validated: null, transition: null, stateHash: world.stateHash(), worldMs: 0, notebook: clone(notes[agentId]) };
      if (records.length >= 240 || bytes(records) + bytes(row) + budgets.observationBytes + budgets.responseBytes + budgets.notebookBytes + 4000 > 440000) { ending = 'budget'; continuous = false; lastError = 'BUDGET'; update('COMPLETE'); return null; }
      ending = 'running';
      for (let retry = 0; retry <= (spec.family === 'model' ? budgets.retries : 0); retry++) {
        if (requests >= budgets.maxRequests) { lastError = 'BUDGET'; ending = 'budget'; break; }
        requests++; const start = now(), attempt: Attempt = { sequence: requests, providerMs: 0, code: null, proposed: null, note: null, confidence: null, usage: unknownUsage() }; row.attempts.push(attempt);
        try {
          let response: ProviderResponse;
          if (spec.family === 'model') {
            const provider = providers.get(spec.provider as ProviderAdapter['id']); if (!provider) throw new AgentError('DISCONNECTED', 'Connect this controller provider first.');
            abort = new AbortController(); update('REQUESTING');
            const request = validateRequest({ schema: 'provider-request@1', template: TEMPLATE_VERSION, controller: spec, observation: { ...o, sequence: requests }, context, budgets });
            response = await invoke(provider, request, abort.signal);
          } else response = { text: JSON.stringify({ action: spec.family === 'human' ? manual : referenceAction(o, spec) }), usage: unknownUsage(), model: spec.model };
          attempt.providerMs = Math.max(0, now() - start);
          if (revision !== generation || paused || world.observe(agentId).tick !== o.tick || controllers[agentId] !== spec) throw new AgentError('STALE', 'A stale response was discarded.');
          if (response.model !== spec.model) throw new AgentError('VERSION', 'Provider returned a different model identifier.');
          update('RECEIVED');
          if (bytes(response.text) <= budgets.responseBytes) Object.assign(attempt, proposedSummary(response.text));
          if (!Object.values(response.usage).every(n => n === null || Number.isInteger(n) && n >= 0 && n <= 10000000)) throw new AgentError('MALFORMED', 'Provider returned invalid usage counts.');
          attempt.usage = response.usage; update('VALIDATING');
          const validated = parseProposal(response.text, world.legalActions(agentId), budgets);
          // The authority validates again. There is no success/score field in a proposal.
          update('ACTING'); const worldStart = now(), transition = world.step(agentId, validated.action); row.worldMs = Math.max(0, now() - worldStart);
          row.validated = validated; row.transition = transition; row.stateHash = world.stateHash();
          if (validated.notebook) notes[agentId] = validated.notebook;
          else notes[agentId] = hostNotebook(notes[agentId], transition, budgets.notebookBytes);
          row.notebook = clone(notes[agentId]); lastError = null; break;
        } catch (error) {
          attempt.providerMs = Math.max(0, now() - start); attempt.code = errorCode(error); lastError = attempt.code;
          if (revision !== generation) return null;
          if (['CANCELLED', 'STALE', 'DISCONNECTED', 'VERSION', 'BUDGET'].includes(attempt.code)) break;
          if (retry < budgets.retries) update('WAITING');
        } finally { abort = null; }
      }
      if (revision !== generation) return null;
      records.push(freeze(row));
      if (world.result().terminal) { ending = 'complete'; continuous = false; update('COMPLETE'); }
      else if (ending === 'budget') { continuous = false; update('COMPLETE'); }
      else if (row.transition) update('WAITING');
      else { ending = 'error'; continuous = false; update('ERROR'); }
      return row;
    } finally { busy = false; options.onChange?.(); }
  }
  return {
    get status() { return status; }, get busy() { return busy; }, get ending() { return ending; }, get requestCount() { return requests; }, get lastError() { return lastError; }, get continuous() { return continuous; },
    get controllers() { return clone(controllers); }, get records() { return records as readonly AgentRecord[]; },
    observation, currentObservation: () => currentObservation || observation(), result: world.result, receipt,
    notebook: (agentId = actor()) => clone(notes[agentId]), actor, step,
    pause() { paused = true; continuous = false; cancelPending(); update('PAUSED'); },
    resume() { if (ending === 'stopped') return; paused = false; ending = world.result().terminal ? 'complete' : 'running'; lastError = null; update(world.result().terminal ? 'COMPLETE' : 'WAITING'); },
    stop() { paused = false; continuous = false; ending = 'stopped'; cancelPending(); update('COMPLETE'); },
    disconnect() { paused = true; continuous = false; cancelPending(); lastError = 'DISCONNECTED'; update('PAUSED'); },
    run() { if (!paused && ending !== 'stopped' && !world.result().terminal && controllers[actor()].family !== 'human') { continuous = true; ending = 'running'; update('WAITING'); } },
    handoff(agentId: string, next: ControllerSpec, reason = 'Operator changed the controller.') {
      if (!Object.hasOwn(controllers, agentId) || reason.length > 200 || handoffs.length >= 32) throw new AgentError('MALFORMED', 'Invalid or excessive controller handoff.');
      const validated = validateController(next); cancelPending();
      handoffs.push({ tick: world.result().ticks, afterRecord: records.length, agentId, from: controllers[agentId], to: validated, reason });
      controllers[agentId] = validated; paused = false; continuous = false; ending = world.result().terminal ? 'complete' : 'running'; lastError = null; update(world.result().terminal ? 'COMPLETE' : 'WAITING');
    },
  };
}
export type AgentSession = ReturnType<typeof createAgentSession>;
