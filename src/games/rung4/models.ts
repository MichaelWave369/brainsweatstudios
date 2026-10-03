import { clamp } from '../../data/types.ts';

export const RUNG_FOUR_IDS = ['driving', 'cdl', 'trade', 'lines', 'electric', 'fire', 'swim', 'sports', 'outpost', 'scenario', 'space'] as const;
export type RungFourId = typeof RUNG_FOUR_IDS[number];
export const isRungFour = (id: string): id is RungFourId => (RUNG_FOUR_IDS as readonly string[]).includes(id);
export const AGENT_IDS = ['sports', 'outpost', 'scenario', 'space'] as const;
export type ArenaKind = typeof AGENT_IDS[number];
export const isArena = (id: string): id is ArenaKind => (AGENT_IDS as readonly string[]).includes(id);
export const rounded = (value: number) => Number(value.toFixed(2));

export function stoppingDistance(mph: number, reaction: number, wet: boolean) {
  const speed = mph * 0.44704, deceleration = wet ? 3 : 5;
  return { reaction: speed * reaction, braking: speed * speed / (2 * deceleration), total: speed * reaction + speed * speed / (2 * deceleration) };
}
export const roadChecks = ['Seat belt', 'Clear mirrors and view', 'Lights and tires', 'State manual reviewed'];
export const truckChecks = ['Tires and wheels', 'Lights and reflectors', 'Mirrors and view', 'Cargo restraints', 'Brake warning panel'];
export interface RoadState { checks: string[]; speed: number; reaction: number; gap: number; wet: boolean; phase: number; started: boolean; risks: number; feedback: string; }
export const roadStart = (): RoadState => ({ checks: [], speed: 35, reaction: 1.5, gap: 30, wet: false, phase: 0, started: false, risks: 0, feedback: '' });
export interface RoadEvent { title: string; detail: string; choices: string[]; correct: number; why: string; }
const roadEvents: RoadEvent[] = [
  { title: 'A marked crossing', detail: 'A person is waiting at the crossing ahead.', choices: ['Yield and stop before the crossing', 'Accelerate through the gap', 'Wave them across while continuing'], correct: 0, why: 'Give the person space and keep the crossing clear. Check the current state manual for local crossing rules.' },
  { title: 'The view is blocked', detail: 'A delivery van hides part of the next intersection.', choices: ['Keep the same pace because the road looks empty', 'Slow early and scan the blocked view', 'Follow the van closely'], correct: 1, why: 'Limited visibility gives you less time to respond. Reduce speed and preserve room to stop.' },
  { title: 'A changing signal', detail: 'The model has enough distance to stop before the marked line.', choices: ['Stop gradually behind the line', 'Speed up to beat the signal', 'Stop inside the crossing'], correct: 0, why: 'Plan the stop early rather than trying to win a race with a signal.' },
  { title: 'A phone notification', detail: 'A message appears while the vehicle is moving.', choices: ['Read it during the next turn', 'Hold the phone low', 'Leave it alone and park safely before using it'], correct: 2, why: 'Keep attention on driving. Choose a safe legal parking place before using a device.' },
  { title: 'Reduced traction', detail: 'Rain changes the model braking distance.', choices: ['Keep the dry-road gap', 'Reduce speed and increase following space', 'Make a sudden steering change'], correct: 1, why: 'In this model, weaker deceleration increases braking distance. Real stopping also depends on tires, road, vehicle, and conditions.' },
  { title: 'A larger vehicle', detail: 'You are behind a truck whose driver may have limited visibility.', choices: ['Leave space and keep out of its blind areas', 'Sit close to its rear bumper', 'Assume it can stop like a bicycle'], correct: 0, why: 'Space, visibility, and early planning matter around large vehicles.' },
  { title: 'A safe arrival', detail: 'The destination is on a busy street.', choices: ['Stop in the traffic lane', 'Choose an allowed parking place and secure the vehicle', 'Open a door without checking'], correct: 1, why: 'Finish the trip by checking the surroundings and securing the parked vehicle.' },
  { title: 'An unfamiliar local rule', detail: 'The route includes a rule that differs between jurisdictions.', choices: ['Guess from a social post', 'Assume every state uses the same rule', 'Check the official state manual before the trip'], correct: 2, why: 'DMV licensing and many road rules are state-specific. This studio teaches US fundamentals rather than an official exam syllabus.' },
];
export const roadEvent = (mission: number, phase: number) => roadEvents[(mission + phase) % roadEvents.length];
export function roadDecision(state: RoadState, choice: number, mission: number) {
  const event = roadEvent(mission, state.phase);
  if (!state.started || state.phase >= 4) return state;
  if (choice !== event.correct) return { ...state, risks: state.risks + 1, feedback: `Pause and revise. ${event.why}` };
  return { ...state, phase: state.phase + 1, feedback: event.why };
}
export const roadReady = (state: RoadState) => state.speed <= 40 && stoppingDistance(state.speed, state.reaction, state.wet).total <= state.gap;
export interface TruckState { checks: string[]; faultReported: boolean; cleared: boolean; front: number; rear: number; secured: boolean; phase: number; started: boolean; risks: number; feedback: string; }
export const truckStart = (): TruckState => ({ checks: [], faultReported: false, cleared: false, front: 12, rear: 24, secured: false, phase: 0, started: false, risks: 0, feedback: '' });
export const truckRating = (mission: number, difficulty: number) => 40 - mission % 3 - difficulty * 2;
export const truckReady = (state: TruckState, mission: number, difficulty: number) => truckChecks.every(c => state.checks.includes(c)) && state.faultReported && state.cleared && state.secured && state.front + state.rear <= truckRating(mission, difficulty) && Math.abs(state.front - state.rear) <= 4;

export interface TradeBrief { width: number; height: number; stock: number; tolerance: number; }
export const tradeBrief = (mission: number, difficulty: number): TradeBrief => { const width = 120 + mission * 10, height = 80 + difficulty * 10; return { width, height, stock: 2 * (width + height) + 60, tolerance: difficulty === 2 ? 0.5 : difficulty === 1 ? 1 : 2 }; };
export interface TradeState { length: number; measured: boolean; pieces: number[]; used: number; joined: boolean; inspected: boolean; feedback: string; }
export const tradeStart = (): TradeState => ({ length: 100, measured: false, pieces: [], used: 0, joined: false, inspected: false, feedback: '' });
export function cutPiece(state: TradeState, brief: TradeBrief) {
  if (!state.measured || state.pieces.length >= 4 || state.used + state.length + 2 > brief.stock) return { ...state, feedback: 'Measure first, and check that enough virtual stock remains.' };
  return { ...state, pieces: [...state.pieces, state.length], used: state.used + state.length + 2, measured: false, joined: false, inspected: false, feedback: 'Virtual cut recorded. The model uses a 2 mm kerf per cut.' };
}
export const frameFits = (state: TradeState, brief: TradeBrief) => state.pieces.length === 4 && state.pieces.every((n, i) => Math.abs(n - (i % 2 ? brief.height : brief.width)) <= brief.tolerance);
export const lineNodes = ['Clinic branch', 'Water pump branch', 'Transit branch', 'School branch', 'Homes branch', 'Supply hub branch'];
export const damagedLines = (mission: number, difficulty: number) => [...new Set([mission % 6, (mission + 2) % 6, ...(difficulty ? [(mission + 4) % 6] : [])])];
export const lineActions = ['Observe from a safe station', 'Mark the exclusion zone', 'Notify utility dispatch', 'Receive authorized isolation confirmation', 'Assign a qualified line crew', 'Receive work-complete clearance', 'Authorize restoration in the model'];
export interface LineState { stages: number[]; selected: number; risks: number; feedback: string; }
export const lineStart = (): LineState => ({ stages: Array(6).fill(0), selected: 0, risks: 0, feedback: '' });
export function lineAction(state: LineState, action: number, faults: number[]) {
  if (!faults.includes(state.selected) || state.stages[state.selected] >= 7) return { ...state, feedback: 'Choose an unfinished damaged branch.' };
  const phase = state.stages[state.selected];
  if (action !== phase) return { ...state, risks: state.risks + 1, feedback: 'Hold the plan. Observation, a protected zone, utility coordination, authorized isolation, a qualified crew, and clearance come before restoration.' };
  return { ...state, stages: state.stages.map((p, i) => i === state.selected ? p + 1 : p), feedback: `${lineActions[action]} recorded for ${lineNodes[state.selected]}.` };
}

export interface CircuitConfig { voltage: number; r1: number; r2: number; mode: 'series' | 'parallel'; fuse: number; }
export function circuit(config: CircuitConfig) {
  const resistance = config.mode === 'series' ? config.r1 + config.r2 : 1 / (1 / config.r1 + 1 / config.r2), current = config.voltage / resistance;
  return { resistance, current, power: config.voltage * current, tripped: current > config.fuse, branch1: config.mode === 'series' ? current : config.voltage / config.r1, branch2: config.mode === 'series' ? current : config.voltage / config.r2 };
}
export const electricParts = ['Virtual battery', 'Load A', 'Load B', 'Virtual meter', 'Protection module'];
export interface ElectricState { parts: string[]; config: CircuitConfig; powered: boolean; measured: boolean; tests: number; }
export const electricStart = (): ElectricState => ({ parts: [], config: { voltage: 12, r1: 12, r2: 12, mode: 'parallel', fuse: 2 }, powered: false, measured: false, tests: 0 });
export const electricBrief = (mission: number, difficulty: number) => ({ mode: mission % 2 ? 'series' as const : 'parallel' as const, min: rounded(0.5 + mission * 0.1 + difficulty * 0.1), max: 2 });

export type Move = 'north' | 'east' | 'south' | 'west';
export const vectors: Record<Move, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
export const fireObstacles = (mission: number) => [[3, 1], [3, 2], [3, 3], [5, 2], [5, 3], [5, 4], ...(mission % 2 ? [[2, 0]] : [[6, 0]])];
export const fireExit = (mission: number) => ({ x: mission % 2 ? 7 : 0, y: 0 });
export const fireLayers = ['Bedroom alarm', 'Hall alarm', 'Unblocked exit routes', 'Outside meeting plan'];
export interface FireState { x: number; y: number; layers: string[]; moves: number; risks: number; outside: boolean; meeting: boolean; help: boolean; feedback: string; }
export const fireStart = (): FireState => ({ x: 1, y: 4, layers: [], moves: 0, risks: 0, outside: false, meeting: false, help: false, feedback: '' });
export function fireMove(state: FireState, move: Move, mission: number) {
  if (state.outside || !fireLayers.every(l => state.layers.includes(l))) return state;
  const [dx, dy] = vectors[move], x = state.x + dx, y = state.y + dy;
  if (x < 0 || y < 0 || x > 7 || y > 5 || fireObstacles(mission).some(p => p[0] === x && p[1] === y)) return { ...state, risks: state.risks + 1, feedback: 'That route is blocked in this exercise. Use the other clear route; never enter a smoke-filled area.' };
  const exit = fireExit(mission), outside = x === exit.x && y === exit.y;
  return { ...state, x, y, moves: state.moves + 1, outside, feedback: outside ? 'You reached the outside. Meet at the planned point and request help in the simulation. Stay outside.' : 'Clear route advanced one tile.' };
}
export const waterLayers = ['Attentive water watcher', 'Lifeguarded location', 'Fitted approved life jacket', 'Buddy and permission plan'];
export interface WaterSafetyState { layers: string[]; stage: number; risks: number; feedback: string; }
export const waterSafetyStart = (): WaterSafetyState => ({ layers: [], stage: 0, risks: 0, feedback: '' });
export function waterSafetyEvent(mission: number, stage: number): RoadEvent {
  if (stage === 0) return { title: ['River current', 'Beach warning', 'Unfenced pool', 'Busy dock'][mission % 4], detail: 'The planned outing has a warning or missing protection.', choices: ['Pause the outing and choose a safer supervised plan', 'Assume a strong swimmer can ignore it', 'Replace a life jacket with an inflatable toy'], correct: 0, why: 'Match the activity to conditions and abilities. Supervision and fitted approved life jackets are separate layers of protection.' };
  if (stage === 1) return { title: 'Someone needs help', detail: 'You are at a stable shore position. Trained help and reaching/throwing equipment are available.', choices: ['Enter the water without training', 'Alert trained help and assist from shore with reaching or throwing equipment', 'Wait because they are not shouting'], correct: 1, why: 'Call for trained help. Assist from a secure position on land; an untrained entry can create another emergency.' };
  return { title: 'Keep the response organized', detail: 'The lifeguard is responding. Others approach the scene.', choices: ['Crowd the responder', 'Return to the activity immediately', 'Keep access clear and follow the trained responder’s directions'], correct: 2, why: 'Keep the response area clear and support the trained responder. Real swimming, rescue, first-aid, and CPR skills require hands-on instruction.' };
}

export const policyConditions = ['always', 'low-energy', 'low-water', 'at-objective', 'blocked', 'fast-approach', 'docking-window'] as const;
export const policyActions = ['approach', 'interact', 'rest', 'refill', 'north', 'east', 'south', 'west', 'brake', 'coast'] as const;
export type PolicyCondition = typeof policyConditions[number];
export type PolicyAction = typeof policyActions[number];
export interface PolicyRule { when: PolicyCondition; action: PolicyAction; }
export interface TraceStep { tick: number; action: PolicyAction; reason: string; x: number; y: number; energy: number; water: number; progress: number; }
export interface ArenaState { kind: ArenaKind; seed: number; difficulty: number; tick: number; x: number; y: number; vx: number; vy: number; energy: number; water: number; progress: number; phase: number; hasBall: boolean; collisions: number; collected: number[]; status: 'ready' | 'complete' | 'timeout' | 'depleted'; trace: TraceStep[]; }
export const arenaStart = (kind: ArenaKind, seed: number, difficulty = 0): ArenaState => ({ kind, seed, difficulty, tick: 0, x: kind === 'space' ? 30 + seed % 8 * 5 : 0, y: kind === 'space' ? 3 + seed % 4 : 3, vx: 0, vy: 0, energy: kind === 'space' ? 100 : 35, water: 12, progress: 0, phase: 0, hasBall: false, collisions: 0, collected: [], status: 'ready', trace: [] });
export const arenaObstacles = (seed: number) => [[4, 1], [4, 2], [4, 4], [4, 5], ...(seed % 2 ? [[6, 2]] : [[2, 4]])];
export const arenaSupplies: [number, number][] = [[2, 1], [5, 5], [8, 3], [3, 5], [7, 1]];
export const arenaTaskCount = (state: ArenaState) => state.kind === 'sports' ? 1 + state.difficulty : 3 + state.difficulty;
export function arenaObjective(state: ArenaState): [number, number] {
  if (state.kind === 'sports') return state.hasBall ? [8, 3] : [2 + (state.seed + state.progress) % 3, 3];
  if (state.kind === 'outpost') return state.collected.length >= arenaTaskCount(state) ? [0, 3] : arenaSupplies[state.collected.length];
  if (state.kind === 'scenario') return arenaSupplies[state.progress] || [0, 3];
  return [0, 0];
}
export function routeMoves(start: [number, number], goal: [number, number], obstacles: number[][], width = 9, height = 7): Move[] {
  const queue: { point: [number, number]; path: Move[] }[] = [{ point: start, path: [] }], seen = new Set([start.join(',')]);
  while (queue.length) { const node = queue.shift()!; if (node.point[0] === goal[0] && node.point[1] === goal[1]) return node.path;
    for (const move of Object.keys(vectors) as Move[]) { const v = vectors[move], point: [number, number] = [node.point[0] + v[0], node.point[1] + v[1]], key = point.join(','); if (point[0] < 0 || point[1] < 0 || point[0] >= width || point[1] >= height || seen.has(key) || obstacles.some(p => p[0] === point[0] && p[1] === point[1])) continue; seen.add(key); queue.push({ point, path: [...node.path, move] }); }
  } return [];
}
export const workedPolicy = (kind: ArenaKind): PolicyRule[] => kind === 'space' ? [{ when: 'docking-window', action: 'interact' }, { when: 'fast-approach', action: 'brake' }, { when: 'always', action: 'approach' }] : [{ when: 'low-energy', action: 'rest' }, ...(kind === 'outpost' ? [{ when: 'low-water' as const, action: 'refill' as const }] : []), { when: 'at-objective', action: 'interact' }, { when: 'always', action: 'approach' }];
export function conditionMatches(state: ArenaState, when: PolicyCondition) {
  const target = arenaObjective(state), distance = Math.hypot(state.x - target[0], state.y - target[1]);
  if (when === 'always') return true;
  if (when === 'low-energy') return state.energy <= 8;
  if (when === 'low-water') return state.kind === 'outpost' && state.water <= 4;
  if (when === 'at-objective') return distance < 0.01;
  if (when === 'docking-window') return state.kind === 'space' && Math.abs(state.x) <= 2 && Math.abs(state.y) <= 1 && Math.hypot(state.vx, state.vy) <= 0.8;
  if (when === 'fast-approach') return state.kind === 'space' && distance < 8 && Math.hypot(state.vx, state.vy) > 1.4;
  return routeMoves([state.x, state.y], target, arenaObstacles(state.seed)).length === 0 && distance > 0;
}
export function policyChoice(state: ArenaState, rules: PolicyRule[]) { const rule = rules.find(r => conditionMatches(state, r.when)); return { action: rule?.action || 'coast' as PolicyAction, reason: rule ? `First matching rule: ${rule.when}` : 'No rule matched; coast.' }; }
export function arenaStep(state: ArenaState, action: PolicyAction, reason = 'Manual control'): ArenaState {
  if (state.status !== 'ready') return state;
  const next: ArenaState = { ...state, collected: [...state.collected], trace: [...state.trace], tick: state.tick + 1 };
  if (state.kind === 'space') {
    if (action === 'interact' && conditionMatches(state, 'docking-window')) { next.status = 'complete'; next.progress = 1; reason += ' · Soft docking accepted.'; }
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
    if (action === 'approach') movement = routeMoves([next.x, next.y], arenaObjective(next), arenaObstacles(next.seed))[0];
    if (action === 'refill' && next.kind === 'outpost') { if (next.x === 0 && next.y === 0) { next.water = 12; reason += ' · Water refilled at the marked station.'; } else movement = routeMoves([next.x, next.y], [0, 0], arenaObstacles(next.seed))[0]; }
    if (movement) { const v = vectors[movement], x = next.x + v[0], y = next.y + v[1]; if (x < 0 || y < 0 || x > 8 || y > 6 || arenaObstacles(next.seed).some(p => p[0] === x && p[1] === y)) { next.collisions++; reason += ' · Blocked move.'; } else { next.x = x; next.y = y; } }
    if (action === 'rest') next.energy = Math.min(35, next.energy + 12); else next.energy = Math.max(0, next.energy - 1);
    if (next.kind === 'outpost') next.water = Math.max(0, rounded(next.water - 0.18 - next.difficulty * 0.03));
    const target = arenaObjective(state), arrived = next.x === target[0] && next.y === target[1];
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
