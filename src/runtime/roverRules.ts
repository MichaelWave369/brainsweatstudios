import type { Variant } from './types.ts';
// Canonical deterministic rover dynamics; learning stays in training/models.
export type RoverMode = 'courier' | 'storm';
export function randomStep(seed: number) { return (Math.imul(seed, 1664525) + 1013904223) >>> 0; }
export const ROVER_SIZE = 7, Q_ROWS = 294;
export const roverMoves = ['north', 'east', 'south', 'west'] as const;
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export interface RoverStep { tick: number; x: number; y: number; action: number; reward: number; carrying: boolean; collision: boolean }
export interface RoverEpisode { seed: number; layout: number; mode: RoverMode; x: number; y: number; carrying: boolean; tick: number; reward: number; collisions: number; battery: number; status: 'ready' | 'complete' | 'timeout'; random: number; trace: RoverStep[] }
export function roverWalls(layout: number, variant: Variant = 'standard'): [number, number][] {
  if (variant === 'transfer') return [[2, 1], [2, 2], [2, 4], [2, 5], [4, 3]];
  return [[3, 1], [3, 2], [3, 4], [3, 5], ...(layout === 0 ? [[1, 3] as [number, number]] : layout === 1 ? [[5, 3] as [number, number]] : [[2, 2] as [number, number]])];
}
export function roverStart(seed: number, mode: RoverMode): RoverEpisode {
  return { seed, layout: seed % 3, mode, x: seed % 2, y: 6, carrying: false, tick: 0, reward: 0, collisions: 0, battery: 80, status: 'ready', random: randomStep(seed + 1), trace: [] };
}
export const roverObservation = (e: RoverEpisode) => e.layout * 98 + (e.y * 7 + e.x) * 2 + Number(e.carrying);
export const roverTarget = (e: RoverEpisode, variant: Variant = 'standard'): [number, number] => e.carrying ? [0, 6] : [variant === 'transfer' ? 5 : 6, 0];
export function roverStep(e: RoverEpisode, action: number, variant: Variant = 'standard'): RoverEpisode {
  if (e.status !== 'ready') return e;
  const random = randomStep(e.random), drift = e.mode === 'storm' && random / 2 ** 32 < (variant === 'transfer' ? 0.22 : 0.12);
  const actual = drift ? (action + 1) % 4 : action, [dx, dy] = vectors[actual];
  let x = e.x + dx, y = e.y + dy;
  const collision = x < 0 || y < 0 || x >= 7 || y >= 7 || roverWalls(e.layout, variant).some(p => p[0] === x && p[1] === y);
  if (collision) { x = e.x; y = e.y; }
  const target = roverTarget(e, variant), before = Math.abs(e.x - target[0]) + Math.abs(e.y - target[1]), after = Math.abs(x - target[0]) + Math.abs(y - target[1]);
  let reward = -0.12 + (before - after) * 0.2 - (collision ? 1.5 : 0), carrying = e.carrying, status: RoverEpisode['status'] = 'ready';
  if (x === target[0] && y === target[1]) { if (carrying) { status = 'complete'; reward += 25; } else { carrying = true; reward += 6; } }
  const tick = e.tick + 1; if (status === 'ready' && tick >= (variant === 'constraints' ? 64 : 80)) { status = 'timeout'; reward -= 5; }
  return { ...e, x, y, carrying, tick, random, reward: e.reward + reward, status, collisions: e.collisions + Number(collision), battery: 80 - tick, trace: [...e.trace, { tick, x, y, action: actual, reward, carrying, collision }] };
}
export function greedyAction(q: number[][], observation: number) { const values = q[observation]; let best = 0; for (let i = 1; i < 4; i++) if (values[i] > values[best]) best = i; return best; }
