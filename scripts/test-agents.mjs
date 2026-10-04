import { agentModule } from './agent-module.mjs';
const { runAgentHarness } = await agentModule('src/agents/harness.ts');
console.log(JSON.stringify(await runAgentHarness(), null, 2));
