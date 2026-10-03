import { describe, it, expect } from 'vitest';
import { noteFrequency } from '../src/systems/labAudio';
import { frequencyAccuracy } from '../src/games/FrequencyLab';
import { compositionScore } from '../src/games/MusicMaker';
import { gardenTurn } from '../src/games/BotanyGarden';

describe('creative science models', () => {
  it('uses hertz for pitch and doubles each musical octave', () => { expect(noteFrequency(69)).toBe(440); expect(noteFrequency(81)).toBe(880); expect(noteFrequency(57)).toBe(220); });
  it('accepts exact frequency matches and gives lower accuracy for a different octave', () => { expect(frequencyAccuracy(440, 440)).toBe(1); expect(frequencyAccuracy(880, 440)).toBe(0); expect(frequencyAccuracy(435, 440)).toBeLessThan(1); });
  it('musical scoring values rhythm, pitch variety, and silent performance', () => { const beats = Array.from({ length: 16 }, (_, i) => i % 4 === 0 ? 1 : i % 4 === 2 ? 2 : 0); const melody = [0, -1, 2, -1, 4, -1, 3, -1, 0, -1, 1, -1, 5, -1, 4, -1]; expect(compositionScore(beats, melody, 6, 2, 2)).toBe(100); expect(compositionScore(beats, Array(16).fill(0), 6, 2, 2)).toBeLessThan(80); expect(compositionScore(Array(16).fill(0), Array(16).fill(-1), 0, 0, 0)).toBeLessThan(60); });
  it('the garden model distinguishes suitable light from the wrong light', () => { const plant = { type: 1, moisture: 55, health: 80, growth: 0, light: 3 }; const suitable = gardenTurn(plant, 1, 5, true, false); const unsuitable = gardenTurn({ ...plant, light: 9 }, 1, 5, true, false); expect(suitable.growth).toBeGreaterThan(unsuitable.growth); expect(suitable.health).toBeGreaterThan(unsuitable.health); });
  it('the garden model penalizes dry soil and wet undrained containers', () => { const plant = { type: 0, moisture: 95, health: 80, growth: 0, light: 6 }; expect(gardenTurn(plant, 2, 5, false, false).health).toBeLessThan(gardenTurn(plant, 2, 5, true, false).health); expect(gardenTurn({ ...plant, moisture: 10 }, 0, 12, true, false).health).toBeLessThan(plant.health); });
  it('mulch conserves fictional moisture without creating water', () => { const plant = { type: 0, moisture: 55, health: 80, growth: 0, light: 6 }; const withMulch = gardenTurn(plant, 0, 12, true, true); expect(withMulch.moisture).toBeGreaterThan(gardenTurn(plant, 0, 12, true, false).moisture); expect(withMulch.moisture).toBeLessThan(55); });
});
