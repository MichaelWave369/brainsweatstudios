import { mkdir, writeFile } from 'node:fs/promises';
import { agentModule } from './agent-module.mjs';
const { createAgentBridge, LOCAL_ORIGINS } = await agentModule('src/agents/bridge.ts');
const { ollamaAdapter } = await agentModule('src/agents/ollama.ts');
const { createAgentSession } = await agentModule('src/agents/session.ts');
const { controllerSpec, DEFAULT_BUDGETS } = await agentModule('src/agents/contracts.ts');
const { worldConfig } = await agentModule('src/runtime/garageWorlds.ts');
const { verifyAgentReceipt } = await agentModule('src/agents/receipts.ts');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--model')) throw new Error('Use --model EXACT_INSTALLED_MODEL or omit it to list availability.');
const report = { schema: 'ollama-qualification@1', date: new Date().toISOString(), status: 'unavailable', models: [], selected: args[1] || null, trials: [], explanation: '' };
const bridge = await createAgentBridge({ port: 0 });
const localFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, Origin: LOCAL_ORIGINS[0] } });
try {
  const adapter = ollamaAdapter(bridge.origin, localFetch), controller = new AbortController(), timer = setTimeout(() => controller.abort(), 2500);
  let models; try { await adapter.connect(controller.signal); models = await adapter.models(controller.signal); } finally { clearTimeout(timer); }
  report.models = models;
  if (!models.length) report.explanation = 'Ollama is reachable but has no supported installed local model. Nothing was downloaded.';
  else if (!args[1]) { report.status = 'model-selection-required'; report.explanation = 'Choose an installed model explicitly with --model. No inference was requested.'; }
  else {
    const selected = models.find(m => m.id === args[1]); if (!selected) throw new Error('Selected model is not in the local installed inventory.');
    const metadata = await localFetch(bridge.origin + '/health', { headers: { Origin: LOCAL_ORIGINS[0] } }).then(r => r.json());
    report.selectedMetadata = await localFetch(bridge.origin + '/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Brain-Sweat-Bridge': metadata.sessionToken }, body: JSON.stringify({ model: selected.id }), signal: AbortSignal.timeout(5000) }).then(r => r.json());
    const spec = controllerSpec('model', 'ollama', selected.id), budgets = { ...DEFAULT_BUDGETS, maxTicks: 32, maxRequests: 36, timeoutMs: 10000, retries: 0 };
    for (const world of ['survey', 'signal-maze']) {
      const session = createAgentSession({ config: worldConfig(world, 20017), controllers: { pilot: spec }, providers: [adapter], budgets });
      while (!session.result().terminal && session.status !== 'ERROR' && session.receipt().ending !== 'budget') await session.step();
      const receipt = verifyAgentReceipt(session.receipt()); report.trials.push({ world, seed: 20017, result: receipt.result, ending: receipt.ending, requests: receipt.records.reduce((n, r) => n + r.attempts.length, 0), errors: receipt.records.flatMap(r => r.attempts.filter(a => a.code).map(a => a.code)), worldTraceHash: receipt.worldTraceHash, modelTraceHash: receipt.modelTraceHash });
    }
    report.status = 'qualified'; report.explanation = 'These are measured bounded-world trials with world replay verified. Model regeneration is not guaranteed; no weights or prompts were tuned.';
  }
} catch { report.explanation = 'No successful qualification: local Ollama or the selected model was unavailable, timed out or incompatible. No model was installed or cloud provider contacted.'; }
finally { await bridge.close(); }
await mkdir('reports', { recursive: true }); await writeFile('reports/ollama-qualification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
