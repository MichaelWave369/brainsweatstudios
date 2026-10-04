/// <reference lib="webworker" />
import { runWorldBatch } from "./experiments.ts";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (e) => {
  try {
    const iterator = runWorldBatch(e.data);
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        scope.postMessage({ type: "complete", report: next.value });
        break;
      }
      scope.postMessage({
        type: "trial",
        summary: next.value.summary,
        receipt: next.value.receipt,
      });
    }
  } catch {
    scope.postMessage({
      type: "error",
      message: "The frozen experiment could not be validated or completed.",
    });
  }
};
