import { arenaStart, arenaStep, arenaObjective, arenaObstacles, arenaScore, policyActions, policyConditions, conditionMatches, type ArenaState } from './arenaRules.ts';
import { roverStart, roverStep, roverTarget, roverWalls, roverObservation, roverMoves, type RoverEpisode } from './roverRules.ts';
import { clone, exact, finite, freeze, hash, integer, plain } from './data.ts';
import { ENVIRONMENTS, ENVIRONMENT_VERSION, type Environment, type EnvironmentConfig, type SimulationState, type EpisodeResult, type Observation, type Action } from './types.ts';

export function configuration(environment: EnvironmentConfig['environment'], seed = 0, difficulty = 0, variant: EnvironmentConfig['variant'] = 'standard', mode: EnvironmentConfig['mode'] = 'courier'): EnvironmentConfig {
  return { environment, version: ENVIRONMENT_VERSION, seed, difficulty, variant, mode };
}
export function validateConfig(value: unknown): EnvironmentConfig {
  if (!plain(value) || !exact(value, ['environment', 'version', 'seed', 'difficulty', 'variant', 'mode']) || !ENVIRONMENTS.includes(value.environment as EnvironmentConfig['environment']) || value.version !== ENVIRONMENT_VERSION || !integer(value.seed, 0, 999999) || !integer(value.difficulty, 0, 2) || !['standard', 'constraints', 'transfer'].includes(String(value.variant)) || !['courier', 'storm'].includes(String(value.mode)) || value.environment !== 'rover' && value.mode !== 'courier') throw new Error('Incompatible or invalid environment configuration.');
  return clone(value) as unknown as EnvironmentConfig;
}
const isRover = (state: SimulationState): state is RoverEpisode => 'layout' in state;
function start(config: EnvironmentConfig): SimulationState {
  if (config.environment === 'rover') return roverStart(config.seed, config.mode);
  const state = arenaStart(config.environment, config.seed, config.difficulty);
  if (config.variant !== 'standard') { state.energy = config.environment === 'space' ? (config.variant === 'transfer' ? 68 : 80) : 24; state.water = 9; }
  if (config.environment === 'space' && config.variant === 'transfer') { state.x = 42 + config.seed % 5 * 6; state.y = -6 - config.seed % 3; state.vx = 0.4; state.vy = 0.2; }
  return state;
}
function validateState(value: unknown, config: EnvironmentConfig): SimulationState {
  const initial = start(config);
  if (!plain(value) || !exact(value, Object.keys(initial)) || !Array.isArray(value.trace) || value.trace.length !== 0 || value.seed !== config.seed || !integer(value.tick, 0, config.environment === 'rover' ? 80 : 120) || !integer(value.collisions, 0, value.tick as number) || !finite(value.x, -104, 104) || !finite(value.y, -104, 104)) throw new Error('Invalid environment snapshot state.');
  if (config.environment === 'rover') {
    if (value.mode !== config.mode || !integer(value.layout, 0, 2) || value.layout !== config.seed % 3 || !integer(value.x, 0, 6) || !integer(value.y, 0, 6) || typeof value.carrying !== 'boolean' || !finite(value.reward, -200, 100) || !integer(value.random, 0, 2 ** 32 - 1) || value.battery !== 80 - Number(value.tick) || !['ready', 'complete', 'timeout'].includes(String(value.status))) throw new Error('Invalid rover snapshot state.');
  } else {
    if (value.kind !== config.environment || value.difficulty !== config.difficulty || !finite(value.energy, 0, 100) || !finite(value.water, 0, 12) || !finite(value.vx, -3, 3) || !finite(value.vy, -3, 3) || !integer(value.progress, 0, 6) || !integer(value.phase, 0, 2) || typeof value.hasBall !== 'boolean' || !Array.isArray(value.collected) || value.collected.length > 5 || !value.collected.every((v, i) => v === i) || !['ready', 'complete', 'timeout', 'depleted'].includes(String(value.status)) || config.environment !== 'space' && (!integer(value.x, 0, 8) || !integer(value.y, 0, 6))) throw new Error('Invalid arena snapshot state.');
  }
  return clone(value) as unknown as SimulationState;
}
export function createEnvironment(input: EnvironmentConfig): Environment {
  let config = validateConfig(input), state = start(config);
  let observationCache: Observation | null = null;
  const result = (): EpisodeResult => {
    const terminal = state.status !== 'ready', success = state.status === 'complete';
    return { terminal, reason: success ? 'goal' : state.status === 'timeout' ? 'tick-limit' : terminal ? 'resource-exhausted' : 'running', success, ticks: state.tick, score: isRover(state) ? (success ? Math.max(60, 100 - state.collisions * 2) : 0) : arenaScore(state), reward: isRover(state) ? state.reward : arenaScore(state), collisions: state.collisions };
  };
  const observe = (): Observation => {
    if (observationCache) return observationCache;
    const { trace: _trace, ...view } = state; void _trace;
    if ('random' in view) delete (view as Partial<RoverEpisode>).random;
    const publicState = 'collected' in view ? { ...view, collected: [...view.collected] } : view;
    observationCache = freeze({ schema: 'observation@1', environment: config.environment, tick: state.tick, state: publicState, target: isRover(state) ? roverTarget(state, config.variant) : arenaObjective(state, config.variant), conditions: isRover(state) ? [] : policyConditions.filter(c => conditionMatches(state as ArenaState, c, config.variant)), observationIndex: isRover(state) ? roverObservation(state) : null, map: isRover(state) ? roverWalls(state.layout, config.variant) : config.environment === 'space' ? [] : arenaObstacles(config.seed, config.variant) });
    return observationCache;
  };
  const availableActions = () => (config.environment === 'rover' ? roverMoves : policyActions).map(action => ({ action, enabled: state.status === 'ready', description: action === 'interact' ? 'Try the objective; its preconditions still apply.' : action === 'refill' ? 'Route to the marked water station.' : 'One simulation tick; blocked movement may cost a tick.' }));
  return {
    get config() { return freeze(clone(config)); },
    reset(seed = config.seed) { config = validateConfig({ ...config, seed }); state = start(config); observationCache = null; return observe(); },
    observe, availableActions,
    step(proposed: unknown) {
      if (typeof proposed !== 'string' || !availableActions().some(a => a.action === proposed && a.enabled)) throw new Error('Action is unavailable or invalid; the world has not advanced.');
      const action = proposed as Action, before = state, old = result();
      const next = isRover(state) ? roverStep(state, roverMoves.indexOf(action as typeof roverMoves[number]), config.variant) : arenaStep(state, action, 'Validated action', config.variant);
      const row = next.trace[next.trace.length - 1];
      const executedAction = isRover(next) ? roverMoves[(row as RoverEpisode['trace'][number]).action] : action;
      state = { ...next, trace: [] };
      observationCache = null;
      const current = result(), events: import('./types.ts').TraceEvent[] = [];
      if (executedAction !== action) events.push({ type: 'wind', detail: `Requested ${action}; wind executed ${executedAction}.` });
      if (state.x !== before.x || state.y !== before.y) events.push({ type: 'move', detail: `Position ${state.x}, ${state.y}.` });
      if (state.collisions > before.collisions) events.push({ type: 'collision', detail: 'The blocked move consumed a tick.' });
      if (isRover(state) ? state.carrying !== (before as RoverEpisode).carrying || current.success : state.progress !== (before as ArenaState).progress || state.phase !== (before as ArenaState).phase || state.hasBall !== (before as ArenaState).hasBall) events.push({ type: 'objective', detail: isRover(state) ? state.carrying ? 'Parcel collected or delivered.' : 'Objective changed.' : (row as ArenaState['trace'][number]).reason });
      if (action === 'rest' || action === 'refill') events.push({ type: 'resource', detail: 'Resource rule applied; inspect reserves.' });
      if (current.terminal) events.push({ type: 'terminal', detail: current.reason });
      return freeze({ observation: observe(), action, executedAction, reward: isRover(next) ? (row as RoverEpisode['trace'][number]).reward : current.score - old.score, events, result: current });
    },
    snapshot: () => clone({ schema: 'snapshot@1', config, state }),
    restore(value: unknown) {
      if (!plain(value) || !exact(value, ['schema', 'config', 'state']) || value.schema !== 'snapshot@1') throw new Error('Invalid snapshot.');
      const nextConfig = validateConfig(value.config);
      if (hash(nextConfig) !== hash(config)) throw new Error('Snapshot belongs to a different episode configuration.');
      const next = validateState(value.state, nextConfig); state = next; observationCache = null; return observe();
    },
    stateHash: () => hash({ config, state }),
    isTerminal: () => state.status !== 'ready', result,
  };
}
