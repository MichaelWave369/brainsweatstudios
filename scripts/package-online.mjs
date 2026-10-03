import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const target=path.resolve('supabase/functions/brain-sweat-online');
await mkdir(target,{recursive:true});
const sources={
  'server.ts':'src/online/server.ts','store.ts':'src/online/store.ts',
  'types.ts':'src/online/types.ts','models.ts':'src/games/rung4/models.ts',
};
for(const [name,source]of Object.entries(sources)){
  let content=await readFile(source,'utf8');
  content=content.replaceAll("'../games/rung4/models.ts'","'./models.ts'");
  if(name==='models.ts')content=content.replace("import { clamp } from '../../data/types.ts';","const clamp=(value:number,min=0,max=100)=>Math.min(max,Math.max(min,value));");
  await writeFile(path.join(target,name),content);
}
console.log('Packaged the canonical online handler, store adapter, and bounded agent model.');
