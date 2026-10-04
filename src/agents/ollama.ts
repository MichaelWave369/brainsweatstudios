import { exact, plain } from '../runtime/data.ts';
import { AGENT_VERSION, AgentError, validateModelInfo, validateProviderResponse, type ModelInfo, type ProviderAdapter, type ProviderRequest, type ProviderResponse } from './contracts.ts';
export const DEFAULT_BRIDGE = 'http://127.0.0.1:11435';
export function bridgeAddress(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) throw new AgentError('MALFORMED', 'Use an HTTP loopback bridge address with an explicit port.');
  return url.origin;
}
export async function boundedJSON(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new AgentError('EMPTY', 'Provider returned no body.');
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const row = await reader.read(); if (row.done) break; total += row.value.length; if (total > maxBytes) { await reader.cancel(); throw new AgentError('OVERSIZED', 'Provider exceeded the response limit.'); } chunks.push(row.value); } }
  finally { reader.releaseLock(); }
  const data = new Uint8Array(total); let offset = 0; chunks.forEach(c => { data.set(c, offset); offset += c.length; });
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); } catch { throw new AgentError('MALFORMED', 'Provider returned malformed JSON.'); }
}
export function ollamaAdapter(base = DEFAULT_BRIDGE, fetcher: typeof fetch = fetch): ProviderAdapter & { connect(signal: AbortSignal): Promise<void>; disconnect(): void; metadata(model: string, signal: AbortSignal): Promise<ModelInfo> } {
  const address = bridgeAddress(base); let token: string | null = null;
  async function request(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
    try {
      const response = await fetcher(address + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { 'X-Brain-Sweat-Bridge': token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal, credentials: 'omit', cache: 'no-store', redirect: 'error', ...({ targetAddressSpace: 'loopback' } as RequestInit) });
      const result = await boundedJSON(response, 60000);
      if (!response.ok) { if (plain(result) && ['TIMEOUT', 'REFUSAL', 'MALFORMED', 'OVERSIZED', 'UNAVAILABLE', 'VERSION', 'BUDGET', 'DISCONNECTED'].includes(String(result.error))) throw new AgentError(result.error as ConstructorParameters<typeof AgentError>[0], 'The local bridge could not complete this request.'); throw new AgentError(response.status === 408 || response.status === 504 ? 'TIMEOUT' : response.status === 429 ? 'BUDGET' : response.status === 400 ? 'MALFORMED' : 'UNAVAILABLE', 'The local bridge could not complete this request.'); }
      return result;
    } catch (error) { if (error instanceof AgentError) throw error; throw new AgentError(signal.aborted ? 'CANCELLED' : 'UNAVAILABLE', 'Local connection failed. Check the bridge, allowed origin and browser local-network permission, or run the studio locally.'); }
  }
  return { id: 'ollama', version: AGENT_VERSION,
    async connect(signal) { const value = await request('/health', signal); if (!plain(value) || value.schema !== 'agent-bridge@1' || typeof value.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(value.sessionToken)) throw new AgentError('VERSION', 'The bridge version is incompatible.'); token = value.sessionToken; },
    disconnect() { token = null; },
    async metadata(model, signal) { if (!token) throw new AgentError('DISCONNECTED', 'Connect the bridge first.'); const value = await request('/metadata', signal, { model }); if (!plain(value) || !exact(value, ['model'])) throw new AgentError('MALFORMED', 'The bridge returned invalid metadata.'); const info = validateModelInfo(value.model); if (info.id !== model) throw new AgentError('VERSION', 'The bridge returned metadata for a different model.'); return info; },
    async models(signal) { if (!token) throw new AgentError('DISCONNECTED', 'Connect the bridge first.'); const value = await request('/models', signal); if (!plain(value) || !exact(value, ['models']) || !Array.isArray(value.models) || value.models.length > 64) throw new AgentError('MALFORMED', 'The bridge returned an invalid model list.'); const models = value.models.map(validateModelInfo); if (new Set(models.map(m => m.id)).size !== models.length) throw new AgentError('MALFORMED', 'The bridge returned duplicate model identifiers.'); return models; },
    async propose(input: ProviderRequest, signal): Promise<ProviderResponse> { if (!token) throw new AgentError('DISCONNECTED', 'Connect the bridge first.'); return validateProviderResponse(await request('/inference', signal, input), input.budgets.responseBytes); },
  };
}
