import { renderPerformance } from './render.ts';
import type { PerformanceBundle } from './types.ts';

self.onmessage = async (event: MessageEvent<PerformanceBundle>) => {
  try {
    const result = await renderPerformance(event.data);
    self.postMessage({ ok: true, result }, { transfer: [result.wav.buffer, result.midi.buffer] });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Local render failed.' });
  }
};
