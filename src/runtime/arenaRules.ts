import type { Variant } from './types.ts';
// Canonical arena rules. Legacy defaults are behavior-compatible with V5.
const clamp=(value:number,min=0,max=100)=>Math.min(max,Math.max(min,value));
const rounded=(value:number)=>Number(value.toFixed(2));
export const AGENT_IDS = ['sports', 'outpost', 'scenario', 'space'] as const;
export type ArenaKind = typeof AGENT_IDS[number];
export const isArena = (id: string): id is ArenaKind => (AGENT_IDS as readonly string[]).includes(id);
export type Move = 'north' | 'east' | 'south' | 'west';
export const vectors: Record<Move, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
export const fireObstacles = (mission: number) => [[3, 1], [3, 2], [3, 3], [5, 2], [5, 3], [5, 4], ...(mission % 2 ? [[2, 0]] : [[6, 0]])];
export const fireExit = (mission: number) => ({ x: mission % 2 ? 7 : 0, y: 0 });
export const fireLayers = ['Bedroom alarm', 'Hall alarm', 'Unblocked exit routes', 'Outside meeting plan'];
export const policyConditions = ['always', 'low-energy', 'low-water', 'at-objective', 'blocked', 'fast-approach', 'docking-window'] as const;
export const policyActions = ['approach', 'interact', 'rest', 'refill', 'north', 'east', 'south', 'west', 'brake', 'coast'] as const;
export type PolicyCondition = typeof policyConditions[number];
export type PolicyAction = typeof policyActions[number];
export interface PolicyRule { when: PolicyCondition; action: PolicyAction; }
export interface TraceStep { tick: number; action: PolicyAction; reason: string; x: number; y: number; energy: number; water: number; progress: number; }
export interface ArenaState { kind: ArenaKind; seed: number; difficulty: number; tick: number; x: number; y: number; vx: number; vy: number; energy: number; water: number; progress: number; phase: number; hasBall: boolean; collisions: number; collected: number[]; status: 'ready' | 'complete' | 'timeout' | 'depleted'; trace: TraceStep[]; }
export const arenaStart = (kind: ArenaKind, seed: number, difficulty = 0): ArenaState => ({ kind, seed, difficulty, tick: 0, x: kind === 'space' ? 30 + seed % 8 * 5 : 0, y: kind === 'space' ? 3 + seed % 4 : 3, vx: 0, vy: 0, energy: kind === 'space' ? 100 : 35, water: 12, progress: 0, phase: 0, hasBall: false, collisions: 0, collected: [], status: 'ready', trace: [] });
export const arenaObstacles = (seed: number, variant: Variant = 'standard') => variant === 'transfer' ? [[5, 0], [5, 1], [5, 4], [5, 5], [2, 4]] : [[4, 1], [4, 2], [4, 4], [4, 5], ...(seed % 2 ? [[6, 2]] : [[2, 4]])];
export const arenaSupplies: [number, number][] = [[2, 1], [5, 5], [8, 3], [3, 5], [7, 1]];
export const arenaTaskCount = (state: ArenaState) => state.kind === 'sports' ? 1 + state.difficulty : 3 + state.difficulty;
export function arenaObjective(state: ArenaState, variant: Variant = 'standard'): [number, number] {
  const supplies: [number, number][] = variant === 'transfer' ? (state.kind === 'scenario' ? [...arenaSupplies.slice(2), ...arenaSupplies.slice(0, 2)] : [[1, 1], [6, 5], [8, 2], [2, 5], [7, 0]]) : arenaSupplies;
  if (state.kind === 'sports') return state.hasBall ? [8, 3] : [2 + (state.seed + state.progress) % 3, 3];
  if (state.kind === 'outpost') return state.collected.length >= arenaTaskCount(state) ? [0, 3] : supplies[state.collected.length];
  if (state.kind === 'scenario') return supplies[state.progress] || [0, 3];
  return [0, 0];
}
const routeCache = new Map<string, Move[]>();
export function routeMoves(start: [number, number], goal: [number, number], obstacles: number[][], width = 9, height = 7): Move[] {
  const key = [start.join(','), goal.join(','), obstacles.map(p => p.join(',')).join(';'), width, height].join('|');
  const cached = routeCache.get(key); if (cached) return [...cached];
  const remember = (path: Move[]) => { if (routeCache.size >= 4096) routeCache.clear(); routeCache.set(key, [...path]); return path; };
  const queue: { point: [number, number]; path: Move[] }[] = [{ point: start, path: [] }], seen = new Set([start.join(',')]);
  while (queue.length) { const node = queue.shift()!; if (node.point[0] === goal[0] && node.point[1] === goal[1]) return remember(node.path);
    for (const move of Object.keys(vectors) as Move[]) { const v = vectors[move], point: [number, number] = [node.point[0] + v[0], node.point[1] + v[1]], key = point.join(','); if (point[0] < 0 || point[1] < 0 || point[0] >= width || point[1] >= height || seen.has(key) || obstacles.some(p => p[0] === point[0] && p[1] === point[1])) continue; seen.add(key); queue.push({ point, path: [...node.path, move] }); }
  } return remember([]);
}
export const workedPolicy = (kind: ArenaKind): PolicyRule[] => kind === 'space' ? [{ when: 'docking-window', action: 'interact' }, { when: 'fast-approach', action: 'brake' }, { when: 'always', action: 'approach' }] : [{ when: 'low-energy', action: 'rest' }, ...(kind === 'outpost' ? [{ when: 'low-water' as const, action: 'refill' as const }] : []), { when: 'at-objective', action: 'interact' }, { when: 'always', action: 'approach' }];
export function conditionMatches(state: ArenaState, when: PolicyCondition, variant: Variant = 'standard') {
  const target = arenaObjective(state, variant), distance = Math.hypot(state.x - target[0], state.y - target[1]);
  if (when === 'always') return true;
  if (when === 'low-energy') return state.energy <= 8;
  if (when === 'low-water') return state.kind === 'outpost' && state.water <= 4;
  if (when === 'at-objective') return distance < 0.01;
  if (when === 'docking-window') return state.kind === 'space' && Math.abs(state.x) <= 2 && Math.abs(state.y) <= 1 && Math.hypot(state.vx, state.vy) <= 0.8;
  if (when === 'fast-approach') return state.kind === 'space' && distance < 8 && Math.hypot(state.vx, state.vy) > 1.4;
  return routeMoves([state.x, state.y], target, arenaObstacles(state.seed, variant)).length === 0 && distance > 0;
}
export function policyChoice(state: ArenaState, rules: PolicyRule[], variant: Variant = 'standard') { const rule = rules.find(r => conditionMatches(state, r.when, variant)); return { action: rule?.action || 'coast' as PolicyAction, reason: rule ? `First matching rule: ${rule.when}` : 'No rule matched; coast.' }; }
export function arenaStep(state: ArenaState, action: PolicyAction, reason = 'Manual control', variant: Variant = 'standard'): ArenaState {
  if (state.status !== 'ready') return state;
  const next: ArenaState = { ...state, collected: [...state.collected], trace: [...state.trace], tick: state.tick + 1 };
  if (state.kind === 'space') {
    if (action === 'interact' && conditionMatches(state, 'docking-window', variant)) { next.status = 'complete'; next.progress = 1; reason += ' · Soft docking accepted.'; }
    else {
      if (action === 'brake') { next.vx -= Math.sign(next.vx) * Math.min(0.3, Math.abs(next.vx)); next.vy -= Math.sign(next.vy) * Math.min(0.3, Math.abs(next.vy)); }
      if (action === 'approach') { const desiredX = -Math.sign(next.x) * Math.min(1.5, Math.abs(next.x) * 0.3), desiredY = -Math.sign(next.y) * Math.min(1, Math.abs(next.y) * 0.3); next.vx += clamp(desiredX - next.vx, -0.3, 0.3); next.vy += clamp(desiredY - next.vy, -0.3, 0.3); }
      if (action in vectors) { const v = vectors[action as Move]; next.vx = clamp(next.vx + v[0] * 0.3, -3, 3); next.vy = clamp(next.vy + v[1] * 0.3, -3, 3); }
      if (action !== 'coast') next.energy = Math.max(0, next.energy - 1 - state.difficulty * 0.1);
      next.x = rounded(next.x + next.vx); next.y = rounded(next.y + next.vy);
      if (Math.abs(next.x) > 100 || Math.abs(next.y) > 100) next.status = 'depleted';
    }
  } else {
    let movement: Move | undefined;
    if (action in vectors) movement = action as Move;
    if (action === 'approach') movement = routeMoves([next.x, next.y], arenaObjective(next, variant), arenaObstacles(next.seed, variant))[0];
    if (action === 'refill' && next.kind === 'outpost') { if (next.x === 0 && next.y === 0) { next.water = variant === 'standard' ? 12 : 9; reason += ' · Water refilled at the marked station.'; } else movement = routeMoves([next.x, next.y], [0, 0], arenaObstacles(next.seed, variant))[0]; }
    if (movement) { const v = vectors[movement], x = next.x + v[0], y = next.y + v[1]; if (x < 0 || y < 0 || x > 8 || y > 6 || arenaObstacles(next.seed, variant).some(p => p[0] === x && p[1] === y)) { next.collisions++; reason += ' · Blocked move.'; } else { next.x = x; next.y = y; } }
    if (action === 'rest') next.energy = Math.min(variant === 'standard' ? 35 : 24, next.energy + 12); else next.energy = Math.max(0, next.energy - 1);
    if (next.kind === 'outpost') next.water = Math.max(0, rounded(next.water - (variant === 'standard' ? 0.18 : 0.26) - next.difficulty * 0.03));
    const target = arenaObjective(state, variant), arrived = next.x === target[0] && next.y === target[1];
    if (action === 'interact' && arrived) {
      if (next.kind === 'sports') { if (!next.hasBall) { next.hasBall = true; reason += ' · Ball controlled.'; } else { next.progress++; next.hasBall = false; reason += ' · Goal scored.'; if (next.progress >= arenaTaskCount(next)) next.status = 'complete'; } }
      if (next.kind === 'outpost') { if (next.collected.length >= arenaTaskCount(next)) { next.progress++; next.status = 'complete'; reason += ' · Shelter delivery complete.'; } else { next.collected.push(next.collected.length); next.progress++; reason += ' · Supply collected.'; } }
      if (next.kind === 'scenario') { next.phase++; reason += ` · ${['Observation logged', 'Protected zone confirmed', 'Qualified response dispatched'][next.phase - 1]}.`; if (next.phase >= 3) { next.phase = 0; next.progress++; if (next.progress >= arenaTaskCount(next)) next.status = 'complete'; } }
    }
  }
  if (next.status === 'ready' && (next.energy <= 0 || next.kind === 'outpost' && next.water <= 0)) next.status = 'depleted';
  if (next.status === 'ready' && next.tick >= 120) next.status = 'timeout';
  next.trace = [...next.trace, { tick: next.tick, action, reason, x: next.x, y: next.y, energy: rounded(next.energy), water: next.water, progress: next.progress }].slice(-120);
  return next;
}
export function runEpisode(initial: ArenaState, rules: PolicyRule[]) { let next = initial; while (next.status === 'ready' && next.tick < 120) { const choice = policyChoice(next, rules); next = arenaStep(next, choice.action, choice.reason); } return next; }
export const arenaScore = (state: ArenaState) => state.status === 'complete' ? Math.max(60, 100 - state.collisions * 5) : Math.min(50, Math.round(state.progress / arenaTaskCount(state) * 50));
