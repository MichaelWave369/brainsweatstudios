import { agentModule } from './agent-module.mjs';
const args = process.argv.slice(2), origins = [];
for (let i = 0; i < args.length; i += 2) { if (args[i] !== '--allow-origin' || !args[i + 1]) throw new Error('Only --allow-origin EXACT_ORIGIN is supported.'); origins.push(args[i + 1]); }
const { createAgentBridge, LOCAL_ORIGINS } = await agentModule('src/agents/bridge.ts');
const bridge = await createAgentBridge({ origins: [...LOCAL_ORIGINS, ...origins] });
console.log(`Agent bridge listening at ${bridge.origin}; fixed Ollama destination http://127.0.0.1:11434. Allowed origins: ${bridge.origins.join(', ')}. No model installation or cloud adapter.`);
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => { void bridge.close(); });
