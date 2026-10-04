import { readFile } from 'node:fs/promises';
import { agentModule } from './agent-module.mjs';
const {replayCommand}=await agentModule('src/replay/cli.ts');
console.log(JSON.stringify(replayCommand(await readFile(process.argv[2],'utf8')),null,2));
