import { readFile } from 'node:fs/promises';
import { agentModule } from './agent-module.mjs';
const { circuitCommand } = await agentModule('src/circuit/cli.ts');
const [command, ...args] = process.argv.slice(2), index = args.indexOf('--input');
const file = index >= 0 ? await readFile(args[index + 1], 'utf8') : null;
if (index >= 0) args.splice(index, 2);
console.log(JSON.stringify(await circuitCommand(command, args, file), null, 2));
