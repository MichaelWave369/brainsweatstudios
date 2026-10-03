import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
const target=path.resolve('supabase/functions/brain-sweat-online');
await mkdir(target,{recursive:true});
const sources={
  'server.ts':'src/online/server.ts','store.ts':'src/online/store.ts',
  'types.ts':'src/online/types.ts',
};
for(const name of ['types','data','arenaRules','roverRules','environment','controllers','receipts','multiAgent'])sources[`runtime/${name}.ts`]=`src/runtime/${name}.ts`;
await rm(path.join(target,'models.ts'),{force:true});
for(const [name,source]of Object.entries(sources)){
  let content=await readFile(source,'utf8');
  if(!name.startsWith('runtime/'))content=content.replaceAll("'../runtime/","'./runtime/");
  await mkdir(path.dirname(path.join(target,name)),{recursive:true});
  await writeFile(path.join(target,name),content);
}
console.log('Packaged the canonical online handler, store and shared headless runtime.');
