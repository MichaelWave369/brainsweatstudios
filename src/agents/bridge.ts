// Optional Node-only edge. It is never imported by the website or world runtime.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { plain } from '../runtime/data.ts';
import { AgentError, MISSION_INSTRUCTIONS, proposalSchema, validateRequest, type ModelInfo } from './contracts.ts';
import { boundedJSON } from './ollama.ts';

export const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
export function validateOrigins(origins: string[]) {
  if (origins.length < 1 || origins.length > 8 || !origins.every(s => { try { const u = new URL(s); return u.origin === s && !u.username && !u.password && (u.protocol === 'https:' || u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)); } catch { return false; } })) throw new Error('Use exact HTTPS or HTTP loopback origins, never a wildcard.');
  return [...new Set(origins)];
}
export async function createAgentBridge(options: { port?: number; ollamaPort?: number; origins?: string[]; fetcher?: typeof fetch; timeoutMs?: number } = {}) {
  const port = options.port ?? 11435, upstreamPort = options.ollamaPort ?? 11434, origins = validateOrigins(options.origins || LOCAL_ORIGINS), fetcher = options.fetcher || fetch;
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535) throw new Error('Invalid loopback port.');
  const upstream = `http://127.0.0.1:${upstreamPort}`, token = randomBytes(32).toString('hex');
  let active = 0, closed = false, windowStart = Date.now(), requests = 0;
  const pending = new Set<AbortController>();
  const server = createServer((req, res) => { void handle(req, res); });
  server.requestTimeout = 65000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000; server.maxConnections = 16;
  async function upstreamJSON(path: '/api/tags' | '/api/show' | '/api/chat', signal: AbortSignal, body?: unknown, limit = 60000) {
    const response = await fetcher(upstream + path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal, redirect: 'error', credentials: 'omit' });
    if (!response.ok) { await response.body?.cancel(); throw new AgentError(response.status === 404 ? 'UNAVAILABLE' : 'REFUSAL', 'The selected local model could not complete the request.'); }
    return boundedJSON(response, limit);
  }
  async function modelList(signal: AbortSignal): Promise<ModelInfo[]> {
    const raw = await upstreamJSON('/api/tags', signal);
    if (!plain(raw) || !Array.isArray(raw.models) || raw.models.length > 128) throw new AgentError('MALFORMED', 'Invalid local model inventory.');
    const models: ModelInfo[] = [];
    for (const row of raw.models.slice(0, 64)) {
      if (!plain(row) || typeof row.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(row.name) || /(?:[-:]cloud)(?:$|:)/i.test(row.name) || row.remote_host || row.remote_model) continue;
      models.push({ id: row.name, sizeBytes: typeof row.size === 'number' && Number.isSafeInteger(row.size) && row.size > 0 ? row.size : null, digest: typeof row.digest === 'string' && /^[a-f0-9]{64}$/.test(row.digest) ? row.digest : null, contextLength: null, capabilities: [], local: true });
    }
    return models;
  }
  async function metadata(model: string, signal: AbortSignal): Promise<ModelInfo> {
    const listed = (await modelList(signal)).find(m => m.id === model); if (!listed) throw new AgentError('UNAVAILABLE', 'Select a model already installed locally.');
    const raw = await upstreamJSON('/api/show', signal, { model }, 180000);
    if (!plain(raw) || raw.remote_host || raw.remote_model) throw new AgentError('UNAVAILABLE', 'Cloud-backed model entries are not supported.');
    const info = plain(raw.model_info) ? raw.model_info : {}, context = Object.entries(info).find(([key, value]) => key.endsWith('.context_length') && Number.isSafeInteger(value));
    return { ...listed, contextLength: context && Number(context[1]) > 0 ? Number(context[1]) : null, capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(0, 12) : [] };
  }
  async function readBody(req: IncomingMessage) {
    if (req.headers['content-type'] !== 'application/json' || req.headers['content-encoding'] || Number(req.headers['content-length'] || 0) > 48000) throw new AgentError('OVERSIZED', 'Use bounded application/json without compression.');
    const chunks: Buffer[] = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 48000) throw new AgentError('OVERSIZED', 'Request body exceeded its limit.'); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AgentError('MALFORMED', 'Malformed request JSON.'); }
  }
  function send(res: ServerResponse, code: number, value: unknown) { if (!res.destroyed) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); } }
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const address = server.address(), actualPort = typeof address === 'object' && address ? address.port : port, allowedHosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
    if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || !allowedHosts.includes(req.headers.host || '') || !origins.includes(String(req.headers.origin)) || req.headers['x-forwarded-host'] || req.headers['x-forwarded-for']) return send(res, 403, { error: 'ORIGIN_OR_HOST' });
    res.setHeader('Access-Control-Allow-Origin', String(req.headers.origin)); res.setHeader('Vary', 'Origin');
    const path = req.url, routes = ['/health', '/models', '/metadata', '/inference', '/shutdown'];
    if (!routes.includes(path || '')) return send(res, 404, { error: 'ROUTE' });
    if (req.method === 'OPTIONS') {
      if (!['GET', 'POST'].includes(String(req.headers['access-control-request-method'])) || String(req.headers['access-control-request-headers'] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).some(h => !['content-type', 'x-brain-sweat-bridge'].includes(h))) return send(res, 403, { error: 'PREFLIGHT' });
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brain-Sweat-Bridge'); res.setHeader('Access-Control-Allow-Private-Network', 'true'); res.writeHead(204); return res.end();
    }
    if (req.method !== (path === '/health' || path === '/models' ? 'GET' : 'POST')) return send(res, 405, { error: 'METHOD' });
    if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requests = 0; }
    if (++requests > 180 || active >= 2 || closed) return send(res, 429, { error: 'LIMIT' });
    if (path === '/health') return send(res, 200, { schema: 'agent-bridge@1', provider: 'ollama', sessionToken: token, scope: 'loopback-only' });
    const supplied = req.headers['x-brain-sweat-bridge'];
    if (typeof supplied !== 'string' || supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return send(res, 403, { error: 'SESSION' });
    const controller = new AbortController(); pending.add(controller); active++;
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
    const disconnected = () => { if (!res.writableEnded) controller.abort(); }; res.on('close', disconnected);
    try {
      if (path === '/models') return send(res, 200, { models: await modelList(controller.signal) });
      const body = await readBody(req);
      if (path === '/shutdown') { if (!plain(body) || Object.keys(body).length) throw new AgentError('MALFORMED', 'Shutdown accepts an empty object.'); send(res, 200, { stopped: true }); closed = true; pending.forEach(c => c.abort()); server.close(); return; }
      if (path === '/metadata') { if (!plain(body) || Object.keys(body).join(',') !== 'model' || typeof body.model !== 'string') throw new AgentError('MALFORMED', 'Metadata accepts only model.'); return send(res, 200, { model: await metadata(body.model, controller.signal) }); }
      const request = validateRequest(body);
      if (request.controller.provider !== 'ollama' || request.controller.family !== 'model' || request.controller.package !== null) throw new AgentError('MALFORMED', 'Inference accepts only an Ollama model controller.');
      const info = await metadata(request.controller.model, controller.signal);
      if (info.capabilities.length && !info.capabilities.includes('completion')) throw new AgentError('UNAVAILABLE', 'This installed model does not advertise text completion.');
      const deadline = setTimeout(() => controller.abort(), request.budgets.timeoutMs);
      try {
        const output = await upstreamJSON('/api/chat', controller.signal, { model: info.id, stream: false, think: false, format: request.controller.settings.format === 'schema' ? proposalSchema(request.observation.legalActions) : 'json', messages: [{ role: 'system', content: MISSION_INSTRUCTIONS }, { role: 'user', content: JSON.stringify({ observation: request.observation, context: request.context }) }], options: { temperature: request.controller.settings.temperature, seed: request.controller.settings.seed, num_predict: 256, num_ctx: Math.min(info.contextLength || 4096, 8192) } }, request.budgets.responseBytes + 16000);
        if (!plain(output) || !plain(output.message) || typeof output.message.content !== 'string' || output.message.tool_calls || output.done !== true || output.model !== info.id) throw new AgentError('MALFORMED', 'Unexpected local model response.');
        if (new TextEncoder().encode(output.message.content).length > request.budgets.responseBytes) throw new AgentError('OVERSIZED', 'Model proposal exceeded its budget.');
        // Explicit projection discards any provider thinking/private fields.
        const usage = (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 10000000 ? Number(n) : null;
        send(res, 200, { model: info.id, text: output.message.content, usage: { inputTokens: usage(output.prompt_eval_count), outputTokens: usage(output.eval_count) } });
      } finally { clearTimeout(deadline); }
    } catch (error) { const code = controller.signal.aborted ? 'TIMEOUT' : error instanceof AgentError ? error.code : 'UNAVAILABLE'; send(res, code === 'TIMEOUT' ? 504 : code === 'UNAVAILABLE' || code === 'REFUSAL' ? 503 : 400, { error: code }); }
    finally { clearTimeout(timeout); res.off('close', disconnected); pending.delete(controller); active--; }
  }
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address()!;
  return { origin: `http://127.0.0.1:${typeof address === 'object' ? address.port : port}`, origins, close: async () => { closed = true; pending.forEach(c => c.abort()); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
