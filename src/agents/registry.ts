import { mockAdapter } from './mock.ts';
import { ollamaAdapter, DEFAULT_BRIDGE } from './ollama.ts';
export const PROVIDERS = [
  { id: 'mock', title: 'Offline mock', connectionRequired: false },
  { id: 'ollama', title: 'Local Ollama', connectionRequired: true },
] as const;
// Provider discovery/transport is separate from world ids and simulation rules.
// A future provider adds its contract id and factory here; it never changes a world.
export function createProvider(id: typeof PROVIDERS[number]['id'], address = DEFAULT_BRIDGE) {
  return id === 'mock' ? mockAdapter() : ollamaAdapter(address);
}
