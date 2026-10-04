import { clone, exact, freeze, hash, integer, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { FAMILY_IDS, type FamilyArtifactType, type FamilyConfig, type FamilyContent, type FamilyId, type FamilyPublicInput, type ScoreSpec, type TrackSpec, type VehicleSpec } from './types.ts';
export function requireData(ok: unknown, message = 'Invalid bounded family data.'): asserts ok { if (!ok) throw new Error(message); }
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(v);
const text = (v: unknown, max=240): v is string => typeof v === 'string' && v.length <= max && !Array.from(v).some(c=>c.charCodeAt(0)<32&&![9,10,13].includes(c.charCodeAt(0)));
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const keys = (v: unknown, k: string[]): v is Record<string,unknown> => plain(v) && exact(v,k);
const list = (v: unknown, max: number, test: (x:unknown)=>boolean): v is unknown[] => Array.isArray(v) && v.length<=max && v.every(test);
export function validateVehicle(v:unknown):VehicleSpec {
    assertData(v,4000,100,4); requireData(keys(v,['schema','id','mass','power','capacity','grip','braking','cooling','reliability','aero','setup']) && v.schema==='vehicle-spec@1' && id(v.id) && ['mass','power','grip','braking','cooling','reliability','aero'].every(k=>integer(v[k],1,10)) && integer(v.capacity,40,100) && keys(v.setup,['wing','gearing']) && integer(v.setup.wing,1,5) && integer(v.setup.gearing,1,5)); return freeze(clone(v)) as unknown as VehicleSpec;
}
export function validateTrack(v:unknown):TrackSpec {
    assertData(v,6000,300,5); requireData(keys(v,['schema','id','segments','weather']) && v.schema==='track-spec@1' && id(v.id) && ['dry','rain'].includes(String(v.weather)) && list(v.segments,12,s=>keys(s,['length','curvature','surface','elevation','risk','sector','pit']) && integer(s.length,60,160) && integer(s.curvature,0,6) && ['smooth','rough'].includes(String(s.surface)) && integer(s.elevation,-2,2) && integer(s.risk,0,3) && integer(s.sector,0,3) && typeof s.pit==='boolean') && v.segments.length>=4 && v.segments.some(s=>(s as {pit:boolean}).pit)); return freeze(clone(v)) as unknown as TrackSpec;
}
export function validateScore(v:unknown):ScoreSpec {
    assertData(v,30000,3500,9);
    requireData(keys(v,['schema','title','bars','meter','key','tempo','chords','cues','parts']) && v.schema==='score-spec@1' && text(v.title,80) && integer(v.bars,1,8) && integer(v.meter,3,4) && integer(v.key,0,11));
    const end=Number(v.bars)*Number(v.meter);
    requireData(list(v.tempo,8,t=>keys(t,['beat','bpm']) && integer(t.beat,0,end-1) && integer(t.bpm,60,160)) && v.tempo.length>0 && (v.tempo[0] as {beat:number}).beat===0 && v.tempo.every((t,i)=>i===0 || (t as {beat:number}).beat>((v.tempo as unknown[])[i-1] as {beat:number}).beat));
    requireData(list(v.chords,16,c=>keys(c,['beat','root','quality']) && integer(c.beat,0,end-1) && integer(c.root,0,11) && ['major','minor'].includes(String(c.quality))));
    requireData(list(v.parts,7,p=>keys(p,['id','instrument','voice','notes']) && id(p.id) && p.id!=='conductor' && keys(p.instrument,['id','kind','range']) && id(p.instrument.id) && ['keys','bass','drum','pad','voice'].includes(String(p.instrument.kind)) && list(p.instrument.range,2,n=>integer(n,24,96)) && p.instrument.range.length===2 && Number(p.instrument.range[0])<=Number(p.instrument.range[1]) && (p.voice===null || keys(p.voice,['id','range','syllables']) && id(p.voice.id) && list(p.voice.range,2,n=>integer(n,24,96)) && p.voice.range.length===2 && Number(p.voice.range[0])<=Number(p.voice.range[1]) && list(p.voice.syllables,8,s=>text(s,12))) && list(p.notes,48,n=>keys(n,['beat','duration','pitch','velocity','syllable']) && integer(n.beat,0,end-1) && integer(n.duration,1,4) && Number(n.beat)+Number(n.duration)<=end && integer(n.pitch,Number((p.instrument as {range:number[]}).range[0]),Number((p.instrument as {range:number[]}).range[1])) && integer(n.velocity,0,100) && text(n.syllable,12)) && p.notes.every((n,i)=>i===0 || Number((n as {beat:number}).beat)>=Number(((p.notes as unknown[])[i-1] as {beat:number;duration:number}).beat)+Number(((p.notes as unknown[])[i-1] as {duration:number}).duration))) && v.parts.length>0 && new Set(v.parts.map(p=>(p as {id:string}).id)).size===v.parts.length);
    const partIds=v.parts.map(p=>(p as {id:string}).id);
    requireData(list(v.cues,32,c=>keys(c,['beat','part','type','level']) && integer(c.beat,0,end) && partIds.includes(String(c.part)) && ['entry','cutoff','dynamics'].includes(String(c.type)) && integer(c.level,0,100)));
    return freeze(clone(v)) as unknown as ScoreSpec;
}
export function validateFamilyContent(type:FamilyArtifactType,v:unknown):FamilyContent {
    assertData(v,30000,3500,10);
    if(type==='vehicle-setup') return validateVehicle(v);
    if(type==='music-score') return validateScore(v);
    if(type==='track-notes') requireData(keys(v,['schema','trackHash','sectors','incidents','pits']) && v.schema==='track-notes@1' && digest(v.trackHash) && list(v.sectors,64,s=>keys(s,['sector','ticks']) && integer(s.sector,0,3) && integer(s.ticks,0,256)) && integer(v.incidents,0,256) && integer(v.pits,0,32));
    else if(type==='performance-plan') requireData(keys(v,['schema','participants','sequence','fallbacks']) && v.schema==='performance-plan@1' && list(v.participants,8,id) && list(v.sequence,64,s=>keys(s,['at','action','music','camera']) && integer(s.at,0,256) && id(s.action) && id(s.music) && id(s.camera)) && list(v.fallbacks,8,s=>text(s,120)));
    else if(type==='cache-route') requireData(keys(v,['schema','mapHash','visited','discoveries','returned']) && v.schema==='cache-route@1' && digest(v.mapHash) && list(v.visited,128,p=>keys(p,['x','y']) && integer(p.x,0,5) && integer(p.y,0,5)) && integer(v.discoveries,0,2) && typeof v.returned==='boolean');
    else if(type==='research-dossier') requireData(keys(v,['schema','finding','sources','compared']) && v.schema==='research-dossier@1' && text(v.finding,120) && list(v.sources,8,s=>keys(s,['url','tick','contentHash','excerpt']) && typeof s.url==='string' && /^synthetic:\/\/circuit\/[a-z0-9-]{1,30}$/.test(s.url) && integer(s.tick,0,256) && digest(s.contentHash) && text(s.excerpt,240)) && typeof v.compared==='boolean');
    else if(type==='show-rundown') requireData(keys(v,['schema','title','segments']) && v.schema==='show-rundown@1' && text(v.title,80) && list(v.segments,8,s=>keys(s,['title','caption','camera','audio','graphic','sourceHashes']) && text(s.title,80) && text(s.caption,240) && id(s.camera) && id(s.audio) && id(s.graphic) && list(s.sourceHashes,8,digest)));
    else requireData(false,'Unknown family artifact.');
    return freeze(clone(v)) as unknown as FamilyContent;
}
export function acceptsArtifact(family:string,type:string) {
    const accepted:Record<string,string[]>={'auto-circuit':['vehicle-setup','track-notes'],'stunt-show':['performance-plan','music-score'],'cache-quest':['cache-route'],'web-scout':['research-dossier'],'stream-studio':['research-dossier','show-rundown','music-score','performance-plan'],'ensemble-lab':['music-score']};
    return accepted[family]?.includes(type) ?? false;
}
export function seedAllowed(partition:string,seed:number){return partition==='CAREER'?seed<1000||seed>=4000:partition==='TRAIN'?seed>=1000&&seed<2000:partition==='HOLDOUT'?seed>=2000&&seed<3000:partition==='TRANSFER'&&seed>=3000&&seed<4000;}
export const emptyFamilyInput=():FamilyPublicInput=>({snapshotHash:hash({notes:[],artifacts:[]}),notes:[],artifacts:[]});
export function validateFamilyInput(v:unknown,family:FamilyId):FamilyPublicInput {
    assertData(v,40000,4500,14); requireData(keys(v,['snapshotHash','notes','artifacts']) && digest(v.snapshotHash) && list(v.notes,6,s=>text(s,120)) && list(v.artifacts,4,a=>keys(a,['type','contentHash','content']) && acceptsArtifact(family,String(a.type)) && digest(a.contentHash)));
    const artifacts=v.artifacts.map(a=>{const item=a as {type:FamilyArtifactType;contentHash:string;content:unknown};const content=validateFamilyContent(item.type,item.content);requireData(hash(content)===item.contentHash,'Admitted family artifact hash differs.');return {...item,content};});
    return freeze({snapshotHash:v.snapshotHash as string,notes:clone(v.notes) as string[],artifacts});
}
export function originalScore(seed=1,choir=false):ScoreSpec {
    const kinds=choir ? ['soprano','alto','tenor','bass','rhythm','accompaniment'] : ['lead','bass','keys','rhythm','texture','voice'];
    const roots=[0,5,7,0,9,5,7,0].map(n=>(n+seed%12)%12);
    return validateScore({schema:'score-spec@1',title:choir?'Signal Garden Choir':'Circuit Lights — original eight bars',bars:8,meter:4,key:seed%12,tempo:[{beat:0,bpm:100},{beat:16,bpm:112}],chords:roots.map((root,i)=>({beat:i*4,root,quality:i===4?'minor':'major'})),cues:kinds.flatMap(part=>[{beat:0,part,type:'entry',level:76},{beat:16,part,type:'dynamics',level:64},{beat:32,part,type:'cutoff',level:0}]),parts:kinds.map((part,i)=>{const isVoice=choir?i<4:i===5,kind=isVoice?'voice':part==='rhythm'?'drum':part==='bass'?'bass':part==='texture'?'pad':'keys',low=i===3&&choir||part==='bass'?36:48;return {id:part,instrument:{id:`synth-${part}`,kind,range:[low,84]},voice:isVoice?{id:`synthetic-${part}`,range:[low,84],syllables:['la','mi','nu','oh']}:null,notes:Array.from({length:16},(_,j)=>({beat:j*2,duration:part==='rhythm'?1:2,pitch:low+12+roots[Math.floor(j/2)]+(i%3)*3,velocity:j<8?76:64,syllable:isVoice?['la','mi','nu','oh'][j%4]:''}))};})});
}
export function familyConfig(family:FamilyId,seed=17,mode:'solo'|'head-to-head'|'multi-car'|'endurance'='solo'):FamilyConfig {
    const count=mode==='multi-car'?4:mode==='solo'?1:2;
    return validateFamilyConfig({schema:'family-config@1',family,seed,maxTicks:family==='auto-circuit'?240:96,race:family==='auto-circuit'?{mode,laps:mode==='endurance'?3:1,vehicles:Array.from({length:count},(_,i)=>({schema:'vehicle-spec@1',id:`car-${i}`,mass:5,power:6,capacity:mode==='endurance'?64:100,grip:7,braking:7,cooling:7,reliability:8,aero:5,setup:{wing:3,gearing:3}})),track:{schema:'track-spec@1',id:'loop-garden',weather:seed%3===0?'rain':'dry',segments:Array.from({length:8},(_,i)=>({length:80+(i+seed)%3*10,curvature:(i*3+seed)%5,surface:i%3===0?'rough':'smooth',elevation:i%3-1,risk:i%2,sector:Math.floor(i/2),pit:i===0}))}}:null,score:family==='ensemble-lab'?originalScore(seed):null});
}
export function validateFamilyConfig(v:unknown):FamilyConfig {
    assertData(v,45000,6000,14);requireData(keys(v,['schema','family','seed','maxTicks','race','score']) && v.schema==='family-config@1' && FAMILY_IDS.includes(v.family as FamilyId) && integer(v.seed,0,2147483647) && integer(v.maxTicks,1,256));
    let race:FamilyConfig['race']=null,score:ScoreSpec|null=null;
    if(v.family==='auto-circuit'){requireData(keys(v.race,['mode','laps','vehicles','track']) && ['solo','head-to-head','multi-car','endurance'].includes(String(v.race.mode)) && integer(v.race.laps,1,4) && Array.isArray(v.race.vehicles));const vehicles=v.race.vehicles.map(validateVehicle);requireData(vehicles.length===(v.race.mode==='solo'?1:v.race.mode==='multi-car'?4:2) && new Set(vehicles.map(c=>c.id)).size===vehicles.length);race={mode:v.race.mode as NonNullable<FamilyConfig['race']>['mode'],laps:v.race.laps,vehicles,track:validateTrack(v.race.track)}; } else requireData(v.race===null);
    if(v.family==='ensemble-lab') score=validateScore(v.score);else requireData(v.score===null);
    return freeze({...clone(v),race,score}) as unknown as FamilyConfig;
}
