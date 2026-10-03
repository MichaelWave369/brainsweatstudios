import { authoredController } from '../runtime/controllers.ts';
import { controllerFromPackage } from '../runtime/packages.ts';
import type { ArenaKind } from '../runtime/arenaRules.ts';
import type { Observation } from '../runtime/types.ts';
import type { Intent } from '../runtime/garageWorlds.ts';
import { AgentError, type ControllerSpec, type ModelObservation } from './contracts.ts';

// This deliberately consumes only the same public observation as any model.
export function referenceAction(o: ModelObservation, spec?: ControllerSpec): Intent {
  const state = o.state;
  if (spec?.package) {
    if (spec.package.compatible[0].environment !== o.world || spec.package.compatible[0].version !== o.environmentVersion) throw new AgentError('VERSION', 'Frozen package is incompatible with this world.');
    const controller = controllerFromPackage(spec.package);
    return { type: controller.chooseAction({ schema: 'observation@1', environment: o.world, tick: o.tick, state, target: o.target, map: o.map, conditions: o.conditions, observationIndex: o.observationIndex } as Observation, o.legalActions.map(a => ({ action: a.type, enabled: true, description: '' })) as Parameters<typeof controller.chooseAction>[1]).action };
  }
  if (o.world === 'survey') {
    const position = Number(state.position), scanned = state.scanned as number[];
    if (state.carrying) return { type: position === 0 ? 'deliver' : 'west' };
    if (scanned[position] === -1) return { type: 'scan' };
    if (scanned[position] === 1) return { type: 'collect' };
    const target = scanned.includes(1) ? scanned.indexOf(1) : scanned.findIndex(v => v === -1);
    return { type: target < position ? 'west' : 'east' };
  }
  if (o.world === 'community') {
    const d = state.district as Record<string, boolean>, supplies = Number(state.supplies);
    if (o.agent.role === 'logistics') return { type: supplies < 2 ? 'deliver:supplies' : d.power && !d.water ? 'restore:water' : 'wait' };
    return { type: !d.power ? supplies > 0 ? 'restore:power' : 'signal:need-supplies' : !d.water ? 'wait' : !d.roads ? supplies > 0 ? 'restore:roads' : 'signal:need-supplies' : !d.comms ? supplies >= Number(state.supplyCostForComms) ? 'restore:comms' : 'signal:need-supplies' : 'wait' };
  }
  if (o.world === 'signal-maze') return { type: (state.missionRoute as string[])[Number(state.progress)] };
  if (o.world !== 'rover') {
    return { type: authoredController(o.world as ArenaKind).chooseAction({ schema: 'observation@1', environment: o.world, tick: o.tick, state, target: o.target, map: o.map, conditions: o.conditions, observationIndex: null } as Observation, []).action };
  }
  const start = [Number(state.x), Number(state.y)], target = o.target!, queue = [{ p: start, first: '' }], seen = new Set([start.join(',')]);
  for (let i = 0; i < queue.length; i++) {
    const row = queue[i];
    if (row.p[0] === target[0] && row.p[1] === target[1] && row.first) return { type: row.first };
    for (const [dx, dy, type] of [[0, -1, 'north'], [1, 0, 'east'], [0, 1, 'south'], [-1, 0, 'west']] as const) {
      const p = [row.p[0] + dx, row.p[1] + dy], key = p.join(',');
      if (p[0] < 0 || p[0] > 6 || p[1] < 0 || p[1] > 6 || seen.has(key) || o.map.some(w => w[0] === p[0] && w[1] === p[1])) continue;
      seen.add(key); queue.push({ p, first: row.first || type });
    }
  }
  return o.legalActions[0];
}
