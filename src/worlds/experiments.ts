import { clone, exact, freeze, hash, integer, plain } from '../runtime/data.ts';
import { assertData, requireWorld } from './compiler.ts';
import { baselineController, validateWorldController, verifyWorldReceipt, type WorldController, type WorldReceipt } from './receipts.ts';
import { WorldSession } from './session.ts';
import type { WorldPack, WorldSpec } from './types.ts';

export type Partition='TRAIN'|'VALIDATION'|'HOLDOUT'|'TRANSFER';
export type Mutation={type:'reserve-scale';resource:string;percent:number}|{type:'event-shift';event:string;ticks:number}|{type:'blocked-location';location:string};
export interface FamilyManifest {schema:'world-family@1';id:string;version:'1.0.0';base:WorldSpec;allowedMutations:Mutation[];curricula:{id:string;days:7|14|30}[];holdoutPolicy:'frozen-no-tuning';metrics:WorldSpec['metrics'];controllers:'public-observation-only'}
export interface WorldInstance {id:string;partition:Partition;seed:number;spec:WorldSpec;worldHash:string;changed:Mutation[]}
export interface WorldExperiment {schema:'world-experiment@1';family:FamilyManifest;instances:WorldInstance[];controllers:WorldController[];digest:string}
export interface TrialSummary {instance:string;partition:Partition;controller:string;seed:number;worldHash:string;receiptHash:string;success:boolean;ticks:number;completion:number;reserves:number;blocked:number;conflicts:number;recoveries:number;recoveryTicks:number;inspections:number;failure:string;requests:number}
export interface Distribution {count:number;mean:number;median:number;min:number;max:number;successRate:number;failures:Record<string,number>}
export interface BatchReport {schema:'world-batch@1';manifestHash:string;trials:TrialSummary[];groups:{controller:string;partition:Partition;completion:Distribution;reserves:Distribution;recoveryTicks:Distribution}[];digest:string}
export function mutateWorld(input:WorldSpec,mutations:Mutation[]):WorldSpec {
  const s=clone(requireWorld(input).spec) as WorldSpec;
  if(!Array.isArray(mutations)||mutations.length>4)throw new Error('Use at most four bounded transfer mutations.');
  for(const m of mutations){if(!plain(m))throw new Error('Invalid mutation.');
    if(m.type==='reserve-scale'&&exact(m,['type','resource','percent'])&&integer(m.percent,50,150)){const r=s.resources.find(r=>r.id===m.resource);if(!r)throw new Error('Unknown mutation resource.');r.initial=Math.max(r.min,Math.min(r.max,Math.round(r.initial*m.percent/100)));}
    else if(m.type==='event-shift'&&exact(m,['type','event','ticks'])&&integer(m.ticks,-24,24)){const e=s.events.find(e=>e.id===m.event);if(!e||e.at===null)throw new Error('Shift only fixed-time events.');e.at=Math.max(1,Math.min(s.clock.maxTicks,e.at+m.ticks));}
    else if(m.type==='blocked-location'&&exact(m,['type','location'])&&s.locations.some(l=>l.id===m.location)){for(const l of s.locations)l.neighbors=l.id===m.location?[]:l.neighbors.filter(n=>n!==m.location);}
    else throw new Error('Unsupported transfer capability or range.');
  }
  return clone(requireWorld(s).spec) as WorldSpec;
}
export const familyManifest=(base:WorldSpec):FamilyManifest=>({schema:'world-family@1',id:base.id,version:'1.0.0',base:clone(requireWorld(base).spec) as WorldSpec,allowedMutations:[{type:'reserve-scale',resource:base.resources[0]?.id||'',percent:70},{type:'event-shift',event:base.events.find(e=>e.at!==null)?.id||'',ticks:12}],curricula:[{id:'foundation',days:7},{id:'endurance',days:14},{id:'long-horizon',days:30}],holdoutPolicy:'frozen-no-tuning',metrics:clone(base.metrics),controllers:'public-observation-only'});
export function generateExperiment(base:WorldSpec,count=2,controllers:WorldController[]=[baselineController('maintenance','maintenance-first'),baselineController('reactive','reactive')]):WorldExperiment {
  if(!integer(count,1,25))throw new Error('Use 1–25 instances per partition.');const family=familyManifest(base),instances:WorldInstance[]=[];
  for(const [group,offset] of [['TRAIN',10000],['VALIDATION',20000],['HOLDOUT',30000],['TRANSFER',40000]] as const)for(let i=0;i<count;i++){const seed=offset+i*17,changed=group==='TRANSFER'?family.allowedMutations:[],spec=mutateWorld(base,changed),worldHash=requireWorld(spec).hash;instances.push({id:hash({worldHash,seed}),partition:group,seed,spec,worldHash,changed:clone(changed)});}
  const data={schema:'world-experiment@1' as const,family,instances,controllers:controllers.map(validateWorldController)};return freeze({...data,digest:hash(data)});
}
export function validateWorldExperiment(input:unknown):WorldExperiment {
  assertData(input,4000000,200000,24);if(!plain(input)||!exact(input,['schema','family','instances','controllers','digest'])||input.schema!=='world-experiment@1'||!plain(input.family)||!exact(input.family,['schema','id','version','base','allowedMutations','curricula','holdoutPolicy','metrics','controllers'])||input.family.schema!=='world-family@1'||input.family.version!=='1.0.0'||input.family.holdoutPolicy!=='frozen-no-tuning'||input.family.controllers!=='public-observation-only'||!Array.isArray(input.family.allowedMutations)||input.family.allowedMutations.length>4||!Array.isArray(input.instances)||input.instances.length<1||input.instances.length>100||!Array.isArray(input.controllers)||input.controllers.length<1||input.controllers.length>4)throw new Error('Invalid bounded family experiment.');
  const r=input as unknown as WorldExperiment;const{digest,...data}=r;if(digest!==hash(data))throw new Error('Experiment integrity differs.');const base=requireWorld(r.family.base);if(base.spec.id!==r.family.id||hash(r.family.metrics)!==hash(base.spec.metrics)||hash(r.family.curricula)!==hash(familyManifest(r.family.base).curricula))throw new Error('Family anchor differs.');mutateWorld(r.family.base,r.family.allowedMutations);
  const seen=new Set<string>();for(const i of r.instances){if(!plain(i)||!exact(i,['id','partition','seed','spec','worldHash','changed'])||!['TRAIN','VALIDATION','HOLDOUT','TRANSFER'].includes(i.partition)||!integer(i.seed,0,999999)||!Array.isArray(i.changed))throw new Error('Invalid family instance.');const expected=mutateWorld(r.family.base,i.changed),worldHash=requireWorld(expected).hash;if(hash(i.spec)!==hash(expected)||i.worldHash!==worldHash||i.id!==hash({worldHash,seed:i.seed})||seen.has(i.id))throw new Error('Instance hash or split leakage differs.');if(i.changed.some(m=>!r.family.allowedMutations.some(a=>hash(a)===hash(m)))||i.partition!=='TRANSFER'&&i.changed.length)throw new Error('Undeclared domain variation.');seen.add(i.id);}
  const controllers=r.controllers.map(validateWorldController);if(new Set(controllers.map(c=>c.id)).size!==controllers.length||controllers.some(c=>c.family==='human'||c.provider==='ollama'))throw new Error('Local batches require offline baselines or mock providers.');return freeze(clone(r));
}
export function describeDistribution(values:number[],successes:boolean[],reasons:string[]):Distribution {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;if(!n)throw new Error('Empty distribution.');return{count:n,mean:values.reduce((a,b)=>a+b,0)/n,median:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,min:sorted[0],max:sorted[n-1],successRate:successes.filter(Boolean).length/n,failures:reasons.reduce<Record<string,number>>((m,r)=>{if(r!=='campaign-complete')m[r]=(m[r]||0)+1;return m;},{})};
}
export function summarizeBatch(manifest:WorldExperiment,trials:TrialSummary[]):BatchReport {
  const groups=manifest.controllers.flatMap(c=>(['TRAIN','VALIDATION','HOLDOUT','TRANSFER'] as const).flatMap(partition=>{const rows=trials.filter(t=>t.controller===c.id&&t.partition===partition);if(!rows.length)return[];const success=rows.map(r=>r.success),reasons=rows.map(r=>r.failure);return[{controller:c.id,partition,completion:describeDistribution(rows.map(r=>r.completion),success,reasons),reserves:describeDistribution(rows.map(r=>r.reserves),success,reasons),recoveryTicks:describeDistribution(rows.map(r=>r.recoveryTicks),success,reasons)}];}));const base={schema:'world-batch@1' as const,manifestHash:manifest.digest,trials:clone(trials),groups};return freeze({...base,digest:hash(base)});
}
export async function* runWorldBatch(input:unknown):AsyncGenerator<{summary:TrialSummary;receipt:WorldReceipt},BatchReport>{
  const manifest=validateWorldExperiment(input),trials:TrialSummary[]=[];
  for(const instance of manifest.instances)for(const c of manifest.controllers){const pack:WorldPack={schema:'brain-sweat-pack@1',id:'experiment-pack',version:'1.0.0',worlds:[instance.spec]},bindings=Object.fromEntries(instance.spec.roles.map(r=>[r.id,{...c,id:c.id}]));const s=new WorldSession(pack,instance.spec.id,instance.seed,bindings);while(!s.env.result().terminal&&s.status==='READY')await s.step();const receipt=verifyWorldReceipt(s.receipt()),r=receipt.result;const summary:TrialSummary={instance:instance.id,partition:instance.partition,controller:c.id,seed:instance.seed,worldHash:instance.worldHash,receiptHash:receipt.digest,success:r.success,ticks:r.tick,completion:r.completion,reserves:Object.values(r.reserves).reduce((a,b)=>a+b,0),blocked:r.blocked,conflicts:r.conflicts,recoveries:r.recoveries,recoveryTicks:r.recoveryTicks,inspections:r.inspections,failure:r.reason,requests:Object.values(receipt.requests).reduce((a,b)=>a+b,0)};trials.push(summary);yield{summary,receipt};}
  return summarizeBatch(manifest,trials);
}
