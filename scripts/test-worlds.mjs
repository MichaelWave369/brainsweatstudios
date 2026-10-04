import { agentModule } from './agent-module.mjs';
const {runWorldHarness}=await agentModule('src/worlds/harness.ts');
console.log(JSON.stringify(await runWorldHarness(),null,2));
