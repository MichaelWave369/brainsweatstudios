import { runCircuitBatch } from './cli.ts';
import type { CircuitSave } from './types.ts';
self.onmessage = async (event: MessageEvent<{ save: CircuitSave; seasonId: string; seeds: number }>) => {
    try { const result = await runCircuitBatch(event.data.save, event.data.seasonId, event.data.seeds, count => self.postMessage({ type: 'progress', count })); self.postMessage({ type: 'complete', result }); }
    catch (e) { self.postMessage({ type: 'error', error: e instanceof Error ? e.message : 'Circuit batch rejected.' }); }
};
