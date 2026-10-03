import { canonical, clone, exact, finite, freeze, hash, integer, plain } from '../runtime/data.ts';
import { createGarageWorld, validateWorldConfig } from '../runtime/garageWorlds.ts';
import { AGENT_VERSION, ACTION_VERSION, CONTEXTS, OBSERVATION_VERSION, TEMPLATE_VERSION, bytes, freshNotebook, hostNotebook, modelObservation, parseProposal, validateBudgets, validateController, validateNotebook, validateRequest, type ErrorCode, type Notebook } from './contracts.ts';
import { contextData, traceHashes, type AgentReceipt, type AgentRecord, type Handoff } from './session.ts';

const codes: (ErrorCode | null)[] = [null, 'ILLEGAL_ACTION', 'MALFORMED', 'OVERSIZED', 'EMPTY', 'REFUSAL', 'TIMEOUT', 'UNAVAILABLE', 'VERSION', 'STALE', 'CANCELLED', 'BUDGET', 'DISCONNECTED'];
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export function verifyAgentReceipt(input: unknown): AgentReceipt {
  if (!plain(input) || !exact(input, ['schema', 'agentVersion', 'template', 'observationSchema', 'actionSchema', 'episode', 'config', 'initialControllers', 'contextStrategy', 'budgets', 'initialHash', 'records', 'handoffs', 'result', 'finalHash', 'ending', 'requestsUsed', 'worldTraceHash', 'modelTraceHash', 'digest']) || input.schema !== 'model-episode@1' || input.agentVersion !== AGENT_VERSION || input.template !== TEMPLATE_VERSION || input.observationSchema !== OBSERVATION_VERSION || input.actionSchema !== ACTION_VERSION || !CONTEXTS.includes(input.contextStrategy as typeof CONTEXTS[number]) || !Array.isArray(input.records) || input.records.length > 240 || !Array.isArray(input.handoffs) || input.handoffs.length > 32 || bytes(input) > 500000 || !['running', 'complete', 'stopped', 'budget', 'error'].includes(String(input.ending)) || !plain(input.initialControllers) || !integer(input.requestsUsed, 0, 240)) throw new Error('Invalid or incompatible model receipt.');
  const { digest, ...payload } = input; if (hash(payload) !== digest) throw new Error('Model receipt integrity differs.');
  const config = validateWorldConfig(input.config), budgets = validateBudgets(input.budgets), world = createGarageWorld(config);
  const initialControllers = Object.fromEntries(Object.entries(input.initialControllers).map(([id, c]) => [id, validateController(c)])), controllers = { ...initialControllers };
  if (Object.keys(controllers).sort().join(',') !== [...world.agents].sort().join(',') || input.initialHash !== world.stateHash() || input.episode !== hash({ config, initialControllers, budgets, strategy: input.contextStrategy }).slice(0, 24)) throw new Error('Receipt initial configuration differs.');
  const handoffs = input.handoffs;
  const records: AgentRecord[] = [], notes: Record<string, Notebook> = Object.fromEntries(world.agents.map(id => [id, freshNotebook()]));
  let handoffIndex = 0, lastSequence = 0;
  const applyHandoffs = (afterRecord: number) => {
    while (handoffIndex < handoffs.length && (handoffs[handoffIndex] as Handoff).afterRecord === afterRecord) {
      const h = handoffs[handoffIndex++];
      if (!plain(h) || !exact(h, ['tick', 'afterRecord', 'agentId', 'from', 'to', 'reason']) || h.tick !== world.result().ticks || !Object.hasOwn(controllers, String(h.agentId)) || typeof h.reason !== 'string' || h.reason.length > 200 || !same(validateController(h.from), controllers[String(h.agentId)])) throw new Error('Invalid controller handoff.');
      controllers[String(h.agentId)] = validateController(h.to);
    }
  };
  for (let index = 0; index < input.records.length; index++) {
    applyHandoffs(index); const raw = input.records[index];
    if (!plain(raw) || !exact(raw, ['index', 'controller', 'observation', 'context', 'attempts', 'validated', 'transition', 'stateHash', 'worldMs', 'notebook']) || raw.index !== index || !Array.isArray(raw.attempts) || raw.attempts.length < 1 || raw.attempts.length > budgets.retries + 1 || !finite(raw.worldMs, 0, 60000) || !plain(raw.observation)) throw new Error('Invalid model trace record.');
    const agentId = world.observe(world.agents[0]).turn, spec = controllers[agentId];
    if (!same(validateController(raw.controller), spec) || !integer(raw.observation.sequence, lastSequence + 1, budgets.maxRequests) || world.result().terminal || world.result().ticks >= budgets.maxTicks) throw new Error('Controller, actor, sequence or tick differs.');
    const prior = records.filter(r => r.observation.agent.id === agentId), expected = modelObservation(world, agentId, String(input.episode), Number(raw.observation.sequence), budgets, prior.filter(r => r.transition).at(-1)?.transition?.events || []);
    const context = contextData(input.contextStrategy as typeof CONTEXTS[number], prior, notes[agentId]);
    if (!same(raw.observation, expected) || !same(raw.context, context)) throw new Error('Observation, mask or bounded context differs.');
    validateRequest({ schema: 'provider-request@1', template: TEMPLATE_VERSION, controller: spec, observation: expected, context, budgets });
    for (const [aIndex, a] of raw.attempts.entries()) {
      if (!plain(a) || !exact(a, ['sequence', 'providerMs', 'code', 'proposed', 'note', 'confidence', 'usage']) || !integer(a.sequence, lastSequence + 1, budgets.maxRequests) || aIndex === 0 && a.sequence !== expected.sequence || !finite(a.providerMs, 0, 120000) || !codes.includes(a.code as ErrorCode | null) || a.note !== null && (typeof a.note !== 'string' || a.note.length > 200) || a.confidence !== null && !finite(a.confidence, 0, 1) || a.proposed !== null && (!plain(a.proposed) || !exact(a.proposed, ['type']) || typeof a.proposed.type !== 'string' || a.proposed.type.length > 32) || !plain(a.usage) || !exact(a.usage, ['inputTokens', 'outputTokens']) || !Object.values(a.usage).every(n => n === null || integer(n, 0, 10000000))) throw new Error('Invalid bounded provider attempt.');
      if (aIndex < raw.attempts.length - 1 && (a.code === null || ['CANCELLED', 'STALE', 'DISCONNECTED', 'VERSION', 'BUDGET'].includes(String(a.code)))) throw new Error('Attempt retry order differs.');
      lastSequence = a.sequence as number;
    }
    const last = raw.attempts.at(-1)!;
    if (raw.transition === null) { if (raw.validated !== null || last.code === null || raw.stateHash !== world.stateHash() || !same(raw.notebook, notes[agentId])) throw new Error('Rejected proposal changed the world or notebook.'); }
    else {
      const validated = parseProposal(JSON.stringify(raw.validated), world.legalActions(agentId), budgets);
      if (last.code !== null || !same(last.proposed, validated.action) || last.note !== (validated.note ?? null) || last.confidence !== (validated.confidence ?? null)) throw new Error('Proposed and validated action differ.');
      const next = world.step(agentId, validated.action);
      if (!same(raw.transition, next) || raw.stateHash !== world.stateHash()) throw new Error('Recorded world execution differs.');
      // Notebook entries are untrusted public annotations, strictly bounded. A
      // model update is preserved; host summaries must match actual events.
      if (validated.notebook) notes[agentId] = validated.notebook;
      else notes[agentId] = hostNotebook(notes[agentId], next, budgets.notebookBytes);
      if (!same(raw.notebook, notes[agentId])) throw new Error('Notebook update differs.');
    }
    validateNotebook(raw.notebook, budgets.notebookBytes); records.push(raw as unknown as AgentRecord);
  }
  applyHandoffs(input.records.length);
  if (lastSequence > Number(input.requestsUsed) || Number(input.requestsUsed) > budgets.maxRequests || handoffIndex !== handoffs.length || input.finalHash !== world.stateHash() || !same(input.result, world.result()) || input.ending === 'complete' && !world.result().terminal || world.result().terminal && input.ending !== 'complete' || !same(traceHashes(config, String(input.initialHash), records, world.stateHash()), { worldTraceHash: input.worldTraceHash, modelTraceHash: input.modelTraceHash })) throw new Error('Receipt ending, trace or final state differs.');
  return freeze(clone(input)) as unknown as AgentReceipt;
}
export function inspectAgentReceipt(receipt: AgentReceipt, record: number) {
  if (!integer(record, 0, receipt.records.length)) throw new Error('Choose a recorded decision.');
  return clone(record === 0 ? receipt.records[0]?.observation || null : receipt.records[record - 1]);
}
