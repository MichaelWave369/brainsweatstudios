export const RUNG_FOUR_IDS = ['driving', 'cdl', 'trade', 'lines', 'electric', 'fire', 'swim', 'sports', 'outpost', 'scenario', 'space'] as const;
export type RungFourId = typeof RUNG_FOUR_IDS[number];
export const isRungFour = (id: string): id is RungFourId => (RUNG_FOUR_IDS as readonly string[]).includes(id);
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


export * from '../../runtime/arenaRules.ts';
export { stepArenaEpisode as arenaStep, runArenaEpisode as runEpisode } from '../../runtime/legacy.ts';
