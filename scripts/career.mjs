import { readFile } from 'node:fs/promises';
import { agentModule } from './agent-module.mjs';
const {careerCommand}=await agentModule('src/career/cli.ts');
const [command,...args]=process.argv.slice(2);
const index=args.indexOf('--input'),file=index>=0?await readFile(args[index+1],'utf8'):null;
if(index>=0)args.splice(index,2);
console.log(JSON.stringify(await careerCommand(command,args,file),null,2));
