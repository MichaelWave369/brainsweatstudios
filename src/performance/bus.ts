import { validateBundle } from './specs.ts';
import type { PerformanceBundle } from './types.ts';

/** Provider-neutral seam. An optional Commonline integration implements this
 * contract on the operator side; no endpoint, credentials or network fallback
 * are embedded in scores or the core studio. */
export interface PerformanceBus {
  id: string;
  syntheticOnly: true;
  prepare(bundle: PerformanceBundle, signal: AbortSignal): Promise<{ accepted: true; bundleHash: string }>;
  stop(): void;
}
export async function preparePerformance(bus: PerformanceBus, bundle: PerformanceBundle, signal: AbortSignal) {
  if (bus.syntheticOnly !== true || signal.aborted) throw new Error('Synthetic performance bus is unavailable.');
  const checked = validateBundle(bundle);
  const { hash } = await import('../runtime/data.ts');
  const result = await bus.prepare(checked, signal);
  if (signal.aborted || result.accepted !== true || result.bundleHash !== hash(checked)) { bus.stop(); throw new Error('Performance bus acknowledgement differs.'); }
  return result;
}
