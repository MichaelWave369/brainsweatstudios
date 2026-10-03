import { clone, freeze, hash, integer } from './data.ts';

export const dispatchActions = ['observe', 'protect', 'dispatch'] as const;
export type DispatchAction = typeof dispatchActions[number];
export interface DispatchState { task: number; phase: number; turn: number; risks: number }
export interface MultiAgentEnvironment<Observation, Action, State> {
  readonly agents: readonly string[];
  readonly ordering: 'ordered';
  observe(agent: string): Observation;
  availableActions(agent: string): readonly Action[];
  step(agent: string, action: unknown): { accepted: boolean; stateHash: string };
  snapshot(): State;
  isTerminal(): boolean;
}
// Shared transition used by the local substrate and the online CAS handler.
// Incorrect legal intents cost a risk and keep the same actor's turn.
export function dispatchStep(state: DispatchState, action: unknown, members: number) {
  if (!integer(members, 1, 20) || !integer(state.task, 0, 2) || !integer(state.phase, 0, 2) || !integer(state.turn, 0, members - 1) || !integer(state.risks, 0, 100000) || !dispatchActions.includes(action as DispatchAction)) throw new Error('Invalid dispatch state or action.');
  const accepted = action === dispatchActions[state.phase];
  const next = { task: state.task, phase: state.phase, turn: state.turn, risks: state.risks };
  if (!accepted) next.risks++;
  else { next.phase++; next.turn = (next.turn + 1) % members; if (next.phase === 3) { next.phase = 0; next.task++; } }
  return { accepted, state: next };
}
export function createDispatchTeam(agents: string[]): MultiAgentEnvironment<{ agent: string; turn: boolean; task: number; phase: number; risks: number }, DispatchAction, DispatchState & { tick: number }> {
  if (agents.length < 2 || agents.length > 4 || new Set(agents).size !== agents.length || !agents.every(a => /^[a-zA-Z0-9-]{1,32}$/.test(a))) throw new Error('Use two to four unique local agent ids.');
  const members = freeze([...agents]); let state = { task: 0, phase: 0, turn: 0, risks: 0, tick: 0 };
  const terminal = () => state.task === 3 || state.tick >= 30;
  const observe = (agent: string) => { if (!members.includes(agent)) throw new Error('Unknown agent.'); return freeze({ agent, turn: members[state.turn] === agent && !terminal(), task: state.task, phase: state.phase, risks: state.risks }); };
  return { agents: members, ordering: 'ordered', observe, availableActions(agent) { return observe(agent).turn ? [...dispatchActions] : []; },
    step(agent, action) { if (!observe(agent).turn) throw new Error('Wait for your ordered turn.'); const next = dispatchStep(state, action, members.length); state = { ...next.state, tick: state.tick + 1 }; return { accepted: next.accepted, stateHash: hash(state) }; },
    snapshot: () => clone(state), isTerminal: terminal,
  };
}
