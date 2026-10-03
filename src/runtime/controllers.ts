import { policyActions, policyConditions, workedPolicy, type ArenaKind, type PolicyRule } from './arenaRules.ts';
import { greedyAction, Q_ROWS, roverMoves } from './roverRules.ts';
import { clone, exact, finite, freeze, hash, plain } from './data.ts';
import type { Action, ActionSpec, Controller, ControllerFamily, Decision, Observation } from './types.ts';

export function validateRules(value: unknown): PolicyRule[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8 || !Array.from(value).every(r => plain(r) && exact(r, ['when', 'action']) && policyConditions.includes(r.when as PolicyRule['when']) && policyActions.includes(r.action as Action))) throw new Error('Provide 1–8 valid condition/action rules.');
  return clone(value) as PolicyRule[];
}
export function validateQ(value: unknown): number[][] {
  if (!Array.isArray(value) || value.length !== Q_ROWS || !Array.from(value).every(row => Array.isArray(row) && row.length === 4 && Array.from(row).every(v => finite(v, -100, 100)))) throw new Error('Expected a finite 294 × 4 value table.');
  return clone(value) as number[][];
}
export function ruleController(input: PolicyRule[], family: 'rules' | 'authored' = 'rules'): Controller {
  const rules = freeze(validateRules(input)), metadata = freeze({ family, version: '1.0.0', hash: hash({ family, rules }) });
  return { metadata: () => metadata, reset() {}, chooseAction(observation) {
    const rule = rules.findIndex(r => observation.conditions.includes(r.when));
    return rule < 0 ? { action: 'coast', reason: 'No rule matched; coast.' } : { action: rules[rule].action, rule, reason: `First matching rule: ${rules[rule].when}` };
  } };
}
export const authoredController = (kind: ArenaKind) => ruleController(workedPolicy(kind), 'authored');
export function qController(input: number[][]): Controller {
  const q = freeze(validateQ(input)), metadata = freeze({ family: 'q-learning' as const, version: '1.0.0', hash: hash({ family: 'q-learning', q }) });
  return { metadata: () => metadata, reset() {}, chooseAction(observation) {
    if (observation.environment !== 'rover' || observation.observationIndex === null) throw new Error('This value table requires the rover observation schema.');
    const index = observation.observationIndex, action = greedyAction(q, index);
    return { action: roverMoves[action], values: [...q[index]], reason: 'Greedy frozen value table; first action wins equal values.' };
  } };
}
export function replayController(actions: readonly Action[]): Controller {
  if (actions.length > 120 || !actions.every(a => policyActions.includes(a))) throw new Error('Invalid replay actions.');
  const sequence = [...actions]; let index = 0;
  return { metadata: () => ({ family: 'replay', version: '1.0.0', hash: hash(sequence) }), reset() { index = 0; }, chooseAction() {
    const action = sequence[index++]; if (!action) throw new Error('Replay ended before the environment.');
    return { action, reason: `Recorded intent ${index}.` };
  } };
}
export function humanController() {
  let pending: Action | null = null;
  const controller: Controller = { metadata: () => ({ family: 'human', version: '1.0.0', hash: hash('human-input@1') }), reset() { pending = null; }, chooseAction() {
    if (!pending) throw new Error('Waiting for human input.'); const action = pending; pending = null; return { action, reason: 'Human input.' };
  } };
  return { ...controller, propose(action: Action) { pending = action; } };
}
export function validateDecision(value: unknown): Decision {
  if (!plain(value) || Object.keys(value).some(k => !['action', 'reason', 'rule', 'values'].includes(k)) || !policyActions.includes(value.action as Action) || value.reason !== undefined && (typeof value.reason !== 'string' || value.reason.length > 500) || value.rule !== undefined && (!Number.isInteger(value.rule) || Number(value.rule) < 0 || Number(value.rule) > 7) || value.values !== undefined && (!Array.isArray(value.values) || value.values.length !== 4 || !value.values.every(v => finite(v, -100, 100)))) throw new Error('Invalid controller decision.');
  return { ...value, ...(Array.isArray(value.values) ? { values: [...value.values] } : {}) } as unknown as Decision;
}
export function validateMetadata(value: unknown) {
  if (!plain(value) || !exact(value, ['family', 'version', 'hash']) || !(['human', 'authored', 'rules', 'replay', 'q-learning'] as ControllerFamily[]).includes(value.family as ControllerFamily) || value.version !== '1.0.0' || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash)) throw new Error('Incompatible controller metadata.');
  return clone(value) as unknown as ReturnType<Controller['metadata']>;
}
export function choose(controller: Controller, observation: Observation, actions: ActionSpec[]) {
  return validateDecision(controller.chooseAction(freeze(observation), freeze(actions)));
}
