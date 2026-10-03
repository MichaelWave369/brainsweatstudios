import { AGENT_IDS, arenaScore, arenaStart, policyActions, policyConditions, runEpisode, type ArenaKind, type PolicyRule } from '../games/rung4/models.ts';
import type { EntityData, EntityType, Evaluation, OnlineSession, OnlineStore, OnlineView, StoredRow, TeamSignal } from './types.ts';
const adjectives=['Copper','Mint','Solar','Indigo','Amber','Silver','Moss','Lunar'];
const animals=['Otter','Fox','Raven','Orca','Lynx','Owl','Gecko','Hare'];
export const clanNames=['Copper Crew','Orbit Builders','Signal Squad','River Rangers','Circuit Circle','Blueprint Guild','Trail Team','Launch League'];
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const fail=(message:string,status=400):never=>{throw new ApiError(message,status);};
class ApiError extends Error { status:number;constructor(message:string,status:number){super(message);this.status=status;} }
const random=(max:number)=>crypto.getRandomValues(new Uint32Array(1))[0]%max;
const invite=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>alphabet[v&31]).join('');
const expires=(now:number,ms:number)=>new Date(now+ms).toISOString();
export async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');}
function readRules(value:unknown):PolicyRule[] {
  if(!Array.isArray(value)||value.length<1||value.length>8||!value.every(r=>object(r)&&Object.keys(r).length===2&&policyConditions.includes(r.when as PolicyRule['when'])&&policyActions.includes(r.action as PolicyRule['action'])))return fail('Provide 1–8 valid controller rules.');
  return value.map(r=>({when:r.when,action:r.action}));
}
export function evaluateController(arena:ArenaKind,seeds:number[],rules:PolicyRule[]):Evaluation {
  const rounds=seeds.map(seed=>{const episode=runEpisode(arenaStart(arena,seed,1),rules);return {seed,score:arenaScore(episode),ticks:episode.tick,complete:episode.status==='complete'};});
  return {rules:rules.map(r=>({...r})),rounds,total:rounds.reduce((sum,r)=>sum+r.score,0)};
}
function view(row:StoredRow,actor:string):OnlineView {
  const data=row.data as unknown as EntityData;
  const results=Object.fromEntries(Object.entries(data.submissions).filter(([id])=>data.status==='complete'||id===actor).map(([id,{rounds,total}])=>[id,{rounds,total}]));
  const {submissions,...publicData}=data;
  return {id:row.id,type:row.bucket as EntityType,version:row.version,expiresAt:row.expiresAt,...publicData,submitted:Object.keys(submissions),results};
}
const member=(data:EntityData,actor:string)=>data.members.some(m=>m.id===actor);
function fields(body:Record<string,unknown>,allowed:string[]){if(Object.keys(body).some(k=>!['op',...allowed].includes(k)))fail('Unexpected request fields.');}
function entityType(value:unknown):EntityType {if(!['room','clan','tournament'].includes(String(value)))return fail('Choose a room, clan, or tournament.');return value as EntityType;}
function arenaKind(value:unknown):ArenaKind {if(!(AGENT_IDS as readonly unknown[]).includes(value))return fail('Choose one of the four agent arenas.');return value as ArenaKind;}
async function readBody(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Use a JSON request.',415);
  if(Number(request.headers.get('content-length')||0)>16000)fail('Request too large.',413);
  const reader=request.body?.getReader();if(!reader)fail('A request body is required.');let bytes=0;const decoder=new TextDecoder();let source='';
  while(true){const {done,value}=await reader!.read();if(done)break;bytes+=value.length;if(bytes>16000){await reader!.cancel();fail('Request too large.',413);}source+=decoder.decode(value,{stream:true});}source+=decoder.decode();
  let body:unknown;try{body=JSON.parse(source);}catch{return fail('Invalid JSON request.');}if(!object(body)||typeof body.op!=='string')return fail('Choose a request operation.');return body;
}
export function createOnlineHandler(store:OnlineStore,options:{origins:string[];pepper:string;now?:()=>number}) {
  const now=options.now||Date.now;
  const alive=(row:StoredRow|null)=>row&&Date.parse(row.expiresAt)>now()?row:null;
  async function limit(key:string,maximum:number,window:number){
    const slot=Math.floor(now()/window),lookup=`rate:${key}:${slot}`;
    for(let attempt=0;attempt<8;attempt++){
      const existing=alive(await store.find(lookup));if(existing){if(Number(existing.data.count)>=maximum)fail('Too many requests. Try again later.',429);if(await store.cas({...existing,data:{count:Number(existing.data.count)+1},version:existing.version+1},existing.version))return;}
      else if(await store.insert({id:crypto.randomUUID(),bucket:'rate',lookup,data:{count:1},version:0,expiresAt:expires(now(),window*2)}))return;
    }fail('The service is busy. Try again.',503);
  }
  async function rows(actor:string){return (await store.list(actor)).filter(r=>alive(r)&&['room','clan','tournament'].includes(r.bucket));}
  async function snapshot(actor:{id:string;name:string}):Promise<OnlineSession>{return {actor,entities:(await rows(actor.id)).map(r=>view(r,actor.id))};}
  async function authorized(id:unknown,actor:string){if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))return fail('Choose an existing private group.');const row=alive(await store.get(id));if(!row||!['room','clan','tournament'].includes(row.bucket)||!member(row.data as unknown as EntityData,actor))return fail('That private group is unavailable.',404);return row;}
  async function mutate(id:string,actor:string,version:unknown,change:(data:EntityData,row:StoredRow)=>void){
    const row=await authorized(id,actor);if(!Number.isInteger(version)||version!==row.version)fail('The room changed. Refresh before trying that action.',409);
    const data=structuredClone(row.data) as unknown as EntityData;change(data,row);
    if(!await store.cas({...row,data:data as unknown as Record<string,unknown>,version:row.version+1},row.version))fail('The room changed. Refresh before trying that action.',409);
  }
  return async(request:Request):Promise<Response>=>{
    const origin=request.headers.get('origin');const allowed=!origin||options.origins.includes(origin);
    const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
    if(origin&&allowed)headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Headers']='authorization, content-type, apikey';headers['Access-Control-Allow-Methods']='POST, OPTIONS';
    const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
    try{
      if(!allowed)fail('This origin is not allowed.',403);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      if(request.method!=='POST')fail('Use POST.',405);
      const body=await readBody(request),token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      if(!token)fail('A device credential is required.',401);
      const lookup=`device:${await sha256(token!)}`;
      const previousDevice=await store.find(lookup);let device=alive(previousDevice);
      if(body.op==='connect'){
        fields(body,[]);
        if(!device){
          if(previousDevice)await store.remove(previousDevice.id);
          const address=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
          await limit(await sha256(`${options.pepper}:connect:${address}`),12,3600000);
          const actor={id:crypto.randomUUID(),name:`${adjectives[random(8)]} ${animals[random(8)]} ${1000+random(9000)}`};
          const candidate:StoredRow={id:actor.id,bucket:'device',lookup,data:actor,version:0,expiresAt:expires(now(),90*86400000)};
          if(await store.insert(candidate))device=candidate;else device=alive(await store.find(lookup));
        }
      }
      if(!device)fail('Reconnect this device before using online play.',401);
      const actor=device!.data as {id:string;name:string};
      await limit(actor.id,240,60000);
      if(random(32)===0)await store.cleanup(new Date(now()).toISOString());
      if(body.op==='connect'||body.op==='list'){fields(body,[]);return respond(await snapshot(actor));}
      if(body.op==='create'){
        await limit(`create:${actor.id}`,12,3600000);
        fields(body,['type','mode','arena','name','clan']);const type=entityType(body.type), existing=await rows(actor.id),count=existing.filter(r=>r.bucket===type).length;
        if(count>=(type==='clan'?1:type==='room'?4:3))fail('Leave an existing group before creating another.');
        const clan=typeof body.clan==='string'?body.clan:'';
        if(clan){const parent=await authorized(clan,actor.id);if(parent.bucket!=='clan')fail('Choose an existing clan.');}
        const mode=body.mode===undefined?'dispatch':body.mode;if(!['dispatch','duel'].includes(String(mode)))fail('Choose cooperative dispatch or agent duel.');
        const arena=body.arena===undefined?'sports':arenaKind(body.arena);
        if(type==='clan'&&!clanNames.includes(String(body.name)))fail('Choose a studio clan name.');
        const name=type==='clan'?String(body.name):type==='tournament'?'Agent League':mode==='dispatch'?'Community Dispatch':'Agent Duel';
        const data:EntityData={owner:actor.id,name,code:invite(),members:[{...actor,ready:false}],status:'lobby',arena,mode:mode as EntityData['mode'],seeds:[],submissions:{},task:0,phase:0,turn:0,risks:0,log:[],signals:[],clan};
        const row:StoredRow={id:crypto.randomUUID(),bucket:type,lookup:`${type}:${data.code}`,data:data as unknown as Record<string,unknown>,version:0,expiresAt:expires(now(),type==='clan'?30*86400000:86400000)};
        if(!await store.insert(row))fail('Please retry creating the group.',503);
        return respond({entity:view(row,actor.id),session:await snapshot(actor)});
      }
      if(body.op==='join'){
        fields(body,['type','code']);const type=entityType(body.type),code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
        await limit(`join:${actor.id}`,20,60000);
        if(!/^[A-HJ-NP-Z2-9]{12}$/.test(code))fail('Use a 12-character invitation code.');
        if((await rows(actor.id)).filter(r=>r.bucket===type).length>=(type==='clan'?1:type==='room'?4:3))fail('Leave an existing group before joining another.');
        for(let attempt=0;attempt<6;attempt++){
          const row=alive(await store.find(`${type}:${code}`));if(!row)fail('That invitation is unavailable.',404);
          const data=structuredClone(row!.data) as unknown as EntityData;
          if(member(data,actor.id))return respond({entity:view(row!,actor.id),session:await snapshot(actor)});
          if(data.status!=='lobby'&&type!=='clan')fail('This event has already started.');
          if(data.members.length>=(type==='clan'?20:type==='tournament'?16:4))fail('This private group is full.');
          data.members.push({...actor,ready:false});
          if(await store.cas({...row!,data:data as unknown as Record<string,unknown>,version:row!.version+1},row!.version))return respond({entity:view({...row!,data:data as unknown as Record<string,unknown>,version:row!.version+1},actor.id),session:await snapshot(actor)});
        }fail('The group changed. Try joining again.',409);
      }
      if(body.op==='leave'||body.op==='delete-device'){
        fields(body,body.op==='leave'?['id','version']:[]);
        const targets=body.op==='leave'?[await authorized(body.id,actor.id)]:await rows(actor.id);
        for(const target of targets){
          for(let attempt=0;attempt<6;attempt++){
            const row=alive(await store.get(target.id));if(!row)break;const data=structuredClone(row.data) as unknown as EntityData;
            if(body.op==='leave'&&body.version!==row.version)fail('The group changed. Refresh before leaving.',409);
            data.members=data.members.filter(m=>m.id!==actor.id);delete data.submissions[actor.id];data.log=data.log.filter(l=>l.actor!==actor.id);data.signals=data.signals.filter(s=>s.actor!==actor.id);
            if(!data.members.length){if(await store.cas({...row,data:data as unknown as Record<string,unknown>,version:row.version+1},row.version)){await store.remove(row.id);break;}}
            else{if(data.owner===actor.id)data.owner=data.members[0].id;if(data.status==='active')data.status='closed';data.turn=0;if(await store.cas({...row,data:data as unknown as Record<string,unknown>,version:row.version+1},row.version))break;}
            if(attempt===5)fail('The group changed. Try leaving again.',409);
          }
        }
        if(body.op==='delete-device'){await store.remove(device!.id);return respond({deleted:true});}
        return respond(await snapshot(actor));
      }
      if(!['ready','start','dispatch','submit','signal','transfer'].includes(String(body.op)))fail('Unknown operation.');
      fields(body,['id','version',...(body.op==='dispatch'?['action']:body.op==='submit'?['rules']:body.op==='signal'?['signal']:body.op==='transfer'?['member']:[])]);
      const row=await authorized(body.id,actor.id);
      await mutate(row.id,actor.id,body.version,(data,current)=>{
        if(body.op==='signal'){
          if(!['ready','help','good-round'].includes(String(body.signal)))fail('Choose a studio team signal.');
          data.signals=[...data.signals.filter(s=>s.actor!==actor.id),{actor:actor.id,signal:body.signal as TeamSignal}].slice(-20);return;
        }
        if(body.op==='transfer'){if(data.owner!==actor.id||!data.members.some(m=>m.id===body.member))fail('Only the owner can transfer to an existing member.',403);data.owner=String(body.member);return;}
        if(current.bucket==='clan')fail('Choose a room or tournament for this action.');
        if(body.op==='ready'){if(data.status!=='lobby')fail('This event is no longer in its lobby.');data.members=data.members.map(m=>m.id===actor.id?{...m,ready:!m.ready}:m);return;}
        if(body.op==='start'){
          if(data.owner!==actor.id)fail('Only the host can start.',403);if(data.status!=='lobby'||data.members.length<2||!data.members.every(m=>m.ready))fail('At least two players must all be ready.');
          data.status='active';data.seeds=[random(10000),random(10000),random(10000)];return;
        }
        if(data.status!=='active')fail('Start a ready event before taking this action.');
        if(body.op==='dispatch'){
          if(current.bucket!=='room'||data.mode!=='dispatch')fail('This is not a cooperative dispatch room.');
          if(data.members[data.turn].id!==actor.id)fail('Wait for your team turn.',409);
          const actions=['observe','protect','dispatch'];if(!actions.includes(String(body.action)))fail('Choose observe, protect, or dispatch.');const accepted=body.action===actions[data.phase];
          data.log=[...data.log,{actor:actor.id,name:actor.name,task:data.task,action:String(body.action),accepted}].slice(-30);
          if(!accepted){data.risks++;return;}data.phase++;data.turn=(data.turn+1)%data.members.length;
          if(data.phase===3){data.phase=0;data.task++;}if(data.task===3)data.status='complete';return;
        }
        if(body.op==='submit'){
          if(current.bucket==='room'&&data.mode!=='duel')fail('Choose an agent competition for controller submissions.');
          if(data.submissions[actor.id])fail('Your controller is already locked for this event.');
          const rules=readRules(body.rules);data.submissions[actor.id]=evaluateController(data.arena,data.seeds,rules);
          if(data.members.every(m=>data.submissions[m.id]))data.status='complete';
        }
      });
      return respond(await snapshot(actor));
    }catch(error){return respond({error:error instanceof ApiError?error.message:'Online service unavailable. Retry in a moment.'},error instanceof ApiError?error.status:503);}
  };
}
