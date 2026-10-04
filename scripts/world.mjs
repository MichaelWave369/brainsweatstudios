import { readFile } from 'node:fs/promises';
import { agentModule } from './agent-module.mjs';
const {worldCommand}=await agentModule('src/worlds/cli.ts');
const [command,...args]=process.argv.slice(2);
let file=null;if(['validate','verify','batch'].includes(command)){if(!args[0])throw new Error('Provide a local JSON file.');file=await readFile(args[0],'utf8');}
console.log(JSON.stringify(await worldCommand(command,args,file),null,2));
