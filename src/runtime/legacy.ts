// Compatibility adapters preserve V5 checkpoint/visual trace shapes. They own
// no rules: every accepted intent is passed to the shared environment.
import { type ArenaState, type PolicyRule, type PolicyAction, type TraceStep } from './arenaRules.ts';
import { choose, humanController, ruleController } from './controllers.ts';
import { configuration, createEnvironment } from './environment.ts';
import type { Decision, Environment } from './types.ts';

function apply(environment: Environment, decision: Decision): { state: ArenaState; row: TraceStep } {
  const transition = environment.step(decision.action), state = environment.snapshot().state as ArenaState;
  const detail = transition.events.find(e => e.type === 'objective')?.detail.replace('Validated action', '') || '';
  const collision = transition.events.some(e => e.type === 'collision') ? ' · Blocked move.' : '';
  const refill = decision.action === 'refill' && state.x === 0 && state.y === 0 && state.kind === 'outpost' ? ' · Water refilled at the marked station.' : '';
  return { state, row: { tick: state.tick, action: decision.action, reason: (decision.reason || 'Manual control') + detail + collision + refill, x: state.x, y: state.y, energy: Number(state.energy.toFixed(2)), water: state.water, progress: state.progress } };
}
export function stepArenaEpisode(state: ArenaState, action: PolicyAction, reason = 'Manual control'): ArenaState {
  if (state.status !== 'ready') return state;
  const config = configuration(state.kind, state.seed, state.difficulty), environment = createEnvironment(config);
  environment.restore({ schema: 'snapshot@1', config, state: { ...state, trace: [] } });
  const human = humanController(); human.propose(action);
  const decision = choose(human, environment.observe(), environment.availableActions());
  const next = apply(environment, { ...decision, reason });
  return { ...next.state, trace: [...state.trace, next.row].slice(-120) };
}
export function runArenaEpisode(initial: ArenaState, rules: PolicyRule[]): ArenaState {
  const config = configuration(initial.kind, initial.seed, initial.difficulty), environment = createEnvironment(config), controller = rules.length ? ruleController(rules) : null;
  environment.restore({ schema: 'snapshot@1', config, state: { ...initial, trace: [] } }); controller?.reset(initial.seed);
  let state = initial; const trace = [...initial.trace];
  while (!environment.isTerminal()) { const next = apply(environment, controller ? choose(controller, environment.observe(), environment.availableActions()) : { action: 'coast', reason: 'No rule matched; coast.' }); state = next.state; trace.push(next.row); }
  return { ...state, trace: trace.slice(-120) };
}
