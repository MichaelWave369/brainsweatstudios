import { readFile } from 'node:fs/promises';
import { agentModule } from './agent-module.mjs';
const {familyCommand}=await agentModule('src/families/cli.ts');
const [command,...args]=process.argv.slice(2);
let file=null;const index=args.indexOf('--input');if(index>=0){file=await readFile(args[index+1],'utf8');args.splice(index,2);}if(command==='verify')file=await readFile(args[0],'utf8');
console.log(JSON.stringify(await familyCommand(command,args,file),null,2));
