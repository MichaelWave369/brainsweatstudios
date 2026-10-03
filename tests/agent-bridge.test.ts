import { afterEach, describe, expect, it } from 'vitest';
import { request as httpRequest } from 'node:http';
import { createAgentBridge, LOCAL_ORIGINS, validateOrigins } from '../src/agents/bridge';
import { ollamaAdapter, bridgeAddress } from '../src/agents/ollama';
import { controllerSpec, DEFAULT_BUDGETS, TEMPLATE_VERSION, type ProviderRequest } from '../src/agents/contracts';
import { createAgentSession } from '../src/agents/session';
import { worldConfig } from '../src/runtime/garageWorlds';

const bridges: Awaited<ReturnType<typeof createAgentBridge>>[] = [];
afterEach(async () => { await Promise.all(bridges.splice(0).map(b => b.close())); });
const model = 'test-local:latest', origin = LOCAL_ORIGINS[0];
function fakeOllama(calls: { url: string; body: Record<string, unknown> | null }[]): typeof fetch {
  return async (input, options) => { const url = String(input), body = options?.body ? JSON.parse(String(options.body)) : null; calls.push({ url, body });
    return Response.json(url.endsWith('/api/tags') ? { models: [{ name: model, size: 123456, digest: 'a'.repeat(64) }, { name: 'remote:cloud', remote_host: 'cloud.invalid' }] } : url.endsWith('/api/show') ? { capabilities: ['completion'], model_info: { 'test.context_length': 8192 } } : { model, done: true, message: { content: '{"action":{"type":"scan"},"note":"Inspect the current site."}', thinking: 'PRIVATE_THINKING_MUST_BE_DISCARDED' }, prompt_eval_count: 42, eval_count: 10 });
  };
}
async function setup(fetcher?: typeof fetch, timeoutMs?: number) {
  const b = await createAgentBridge({ port: 0, fetcher: fetcher || fakeOllama([]), timeoutMs }); bridges.push(b);
  const health = await fetch(b.origin + '/health', { headers: { Origin: origin } }).then(r => r.json());
  return { ...b, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Brain-Sweat-Bridge': health.sessionToken as string } };
}
function providerRequest(): ProviderRequest {
  const spec = controllerSpec('model', 'ollama', model), s = createAgentSession({ config: worldConfig('survey'), controllers: { pilot: spec }, providers: [] });
  return { schema: 'provider-request@1', template: TEMPLATE_VERSION, controller: spec, observation: s.observation(), context: { strategy: 'STATE_ONLY', recent: [], summary: [], notebook: null }, budgets: DEFAULT_BUDGETS };
}
describe('optional loopback bridge', () => {
  it('lists installed local models, returns metadata and projects out private thinking', async () => {
    const calls: { url: string; body: Record<string, unknown> | null }[] = [], b = await setup(fakeOllama(calls));
    const models = await fetch(b.origin + '/models', { headers: b.headers }).then(r => r.json()); expect(models.models.map((m: { id: string }) => m.id)).toEqual([model]);
    const metadata = await fetch(b.origin + '/metadata', { method: 'POST', headers: b.headers, body: JSON.stringify({ model }) }).then(r => r.json()); expect(metadata.model.contextLength).toBe(8192);
    const response = await fetch(b.origin + '/inference', { method: 'POST', headers: b.headers, body: JSON.stringify(providerRequest()) }); const output = await response.json(); expect(response.status).toBe(200); expect(output.usage).toEqual({ inputTokens: 42, outputTokens: 10 }); expect(JSON.stringify(output)).not.toContain('PRIVATE');
    const inference = calls.find(c => c.url.endsWith('/api/chat'))!.body!; expect(inference.think).toBe(false); expect(inference.stream).toBe(false); expect(inference.tools).toBeUndefined(); expect(calls.every(c => /^http:\/\/127\.0\.0\.1:11434\/api\/(tags|show|chat)$/.test(c.url))).toBe(true);
  });
  it('rejects origins, null origins, forged Host, missing session and unknown routes/methods', async () => {
    const b = await setup();
    for (const Origin of ['https://attacker.invalid', 'null']) expect((await fetch(b.origin + '/health', { headers: { Origin } })).status).toBe(403);
    expect((await fetch(b.origin + '/models', { headers: { Origin: origin } })).status).toBe(403); expect((await fetch(b.origin + '/proxy?url=http://example.invalid', { headers: b.headers })).status).toBe(404);
    expect((await fetch(b.origin + '/inference', { method: 'DELETE', headers: b.headers })).status).toBe(405);
    const status = await new Promise<number>(resolve => { const req = httpRequest(b.origin + '/health', { headers: { Origin: origin, Host: 'attacker.invalid' } }, res => { res.resume(); resolve(res.statusCode!); }); req.end(); }); expect(status).toBe(403);
  });
  it('rejects malformed/oversized bodies, arbitrary URLs, unknown fields and disallowed preflights', async () => {
    const b = await setup();
    for (const body of ['bad json', 'x'.repeat(48001), JSON.stringify({ ...providerRequest(), url: 'https://cloud.invalid' }), JSON.stringify({ model: 'remote:cloud' })]) {
      const r = await fetch(b.origin + '/inference', { method: 'POST', headers: b.headers, body }); expect(r.status).toBe(400);
    }
    const r = await fetch(b.origin + '/inference', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization' } }); expect(r.status).toBe(403);
    expect(() => bridgeAddress('http://192.168.0.1:11435')).toThrow(); expect(() => bridgeAddress('https://cloud.invalid')).toThrow(); expect(() => validateOrigins(['*'])).toThrow(); expect(() => validateOrigins(['http://attacker.invalid'])).toThrow();
  });
  it('limits concurrency, times out providers and returns no upstream bodies', async () => {
    const stalled: typeof fetch = (_url, options) => new Promise((_, reject) => { options!.signal!.addEventListener('abort', () => reject(new Error('provider-private-secret')), { once: true }); });
    const b = await setup(stalled, 40), first = fetch(b.origin + '/models', { headers: b.headers }), second = fetch(b.origin + '/models', { headers: b.headers });
    // Wait for both HTTP requests to enter the bounded upstream rather than rely on a sleep.
    const statuses = await Promise.all([first, second, fetch(b.origin + '/models', { headers: b.headers })]); expect(statuses.map(r => r.status).sort()).toEqual([429, 504, 504]);
    for (const response of statuses) expect(await response.text()).not.toContain('private-secret');
  });
  it('aborts an upstream request when the local client disconnects', async () => {
    let entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; }); let aborted = false;
    const stalled: typeof fetch = (_url, options) => new Promise((_, reject) => { entered(); options!.signal!.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true }); });
    const b = await setup(stalled), client = new AbortController(), promise = fetch(b.origin + '/models', { headers: b.headers, signal: client.signal }).catch(() => null); await ready; client.abort(); await promise;
    await new Promise<void>(resolve => setImmediate(resolve)); await b.close(); expect(aborted).toBe(true);
  });
  it('bounds request floods and rejects non-ASCII session tokens without crashing', async () => {
    const b = await setup();
    const bad = await fetch(b.origin + '/models', { headers: { ...b.headers, 'X-Brain-Sweat-Bridge': 'é'.repeat(64) } }); expect(bad.status).toBe(403);
    let limited = 0; for (let i = 0; i < 185; i++) { const r = await fetch(b.origin + '/health', { headers: { Origin: origin } }); if (r.status === 429) limited++; await r.body?.cancel(); } expect(limited).toBeGreaterThan(0);
  });
  it('rejects unknown provider response shapes, remote model metadata and oversized streamed output', async () => {
    for (const variant of ['tools', 'remote', 'oversized']) {
      const delegate = fakeOllama([]), altered: typeof fetch = async (url, options) => {
        if (variant === 'remote' && String(url).endsWith('/api/show')) return Response.json({ remote_host: 'cloud.invalid', capabilities: ['completion'] });
        if (String(url).endsWith('/api/chat')) return variant === 'oversized' ? Response.json({ model, done: true, message: { content: 'x'.repeat(24000) } }) : Response.json({ model, done: true, message: { content: '{}', tool_calls: [{ function: { name: 'shell' } }] } });
        return delegate(url, options);
      };
      const b = await setup(altered), result = await fetch(b.origin + '/inference', { method: 'POST', headers: b.headers, body: JSON.stringify(providerRequest()) }); expect(result.status).toBe(variant === 'remote' ? 503 : 400); expect(await result.text()).not.toContain('cloud.invalid');
    }
  });
  it('the browser adapter connects only explicitly and never selects a model automatically', async () => {
    const b = await setup(), localFetch: typeof fetch = (url, opts) => fetch(url, { ...opts, headers: { ...opts?.headers, Origin: origin } }), adapter = ollamaAdapter(b.origin, localFetch);
    await expect(adapter.models(new AbortController().signal)).rejects.toThrow(/Connect/); await adapter.connect(new AbortController().signal); const models = await adapter.models(new AbortController().signal); expect(models[0].id).toBe(model);
    const result = await adapter.propose(providerRequest(), new AbortController().signal); expect(result.model).toBe(model); adapter.disconnect(); await expect(adapter.propose(providerRequest(), new AbortController().signal)).rejects.toThrow(/Connect/);
  });
});
