import { beforeEach, describe, expect, it } from 'vitest';
import { createOnlineHandler, evaluateController, sha256 } from '../src/online/server';
import { MemoryOnlineStore, RestOnlineStore } from '../src/online/store';
import { workedPolicy } from '../src/games/rung4/models';
import type { OnlineSession, OnlineView, StoredRow } from '../src/online/types';
import { competitionStandings } from '../src/online/client';
let store:MemoryOnlineStore,handler:ReturnType<typeof createOnlineHandler>,clock:number;
const tokens=['A','B','C','D','E'].map(letter=>letter.repeat(43));
async function request(actor:number,body:Record<string,unknown>,extra:Record<string,string>={}) {
  const response=await handler(new Request('http://localhost/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[actor]}`,...extra},body:JSON.stringify(body)}));
  return {status:response.status,body:await response.json()};
}
async function connect(actor:number){const r=await request(actor,{op:'connect'});expect(r.status).toBe(200);return r.body as OnlineSession;}
async function create(actor:number,type='room',extra:Record<string,unknown>={}){const r=await request(actor,{op:'create',type,...extra});expect(r.status).toBe(200);return r.body.entity as OnlineView;}
async function current(actor:number,id:string){const r=await request(actor,{op:'list'});expect(r.status).toBe(200);return (r.body as OnlineSession).entities.find(e=>e.id===id)!;}
async function action(actor:number,id:string,op:string,extra:Record<string,unknown>={}){const e=await current(actor,id);return request(actor,{op,id,version:e.version,...extra});}
async function readyEvent(type='room',extra:Record<string,unknown>={}){
  await connect(0);await connect(1);const e=await create(0,type,extra);expect((await request(1,{op:'join',type,code:e.code})).status).toBe(200);
  expect((await action(0,e.id,'ready')).status).toBe(200);expect((await action(1,e.id,'ready')).status).toBe(200);expect((await action(0,e.id,'start')).status).toBe(200);return current(0,e.id);
}
beforeEach(()=>{clock=Date.parse('2026-10-03T12:00:00Z');store=new MemoryOnlineStore();handler=createOnlineHandler(store,{origins:['http://localhost'],pepper:'unit-test',now:()=>clock});});
describe('private online authentication and authorization',()=>{
  it('stores only a token hash and reconnects the same generated identity',async()=>{const first=await connect(0),again=await connect(0);expect(again.actor).toEqual(first.actor);expect(first.actor.name).toMatch(/\d{4}$/);const row=await store.find('device:'+await sha256(tokens[0]));expect(row?.data).toEqual(first.actor);expect(JSON.stringify(row)).not.toContain(tokens[0]);});
  it('requires a credential, validates origins, methods, JSON, and strict fields',async()=>{expect((await request(0,{op:'list'})).status).toBe(401);const missing=await handler(new Request('http://localhost/api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"connect"}'}));expect(missing.status).toBe(401);expect((await request(0,{op:'connect'},{Origin:'https://untrusted.example'})).status).toBe(403);expect((await handler(new Request('http://localhost/api'))).status).toBe(405);expect((await request(0,{op:'connect',email:'not-accepted'})).status).toBe(400);await connect(0);expect((await request(0,{op:'unknown'})).status).toBe(400);expect((await request(0,{op:'create',type:'clan',name:'free chat text'})).status).toBe(400);});
  it('enforces member and host permissions even when entity IDs are known',async()=>{await connect(0);await connect(1);await connect(2);const e=await create(0);expect((await request(2,{op:'signal',id:e.id,version:0,signal:'ready'})).status).toBe(404);expect((await request(2,{op:'list'})).body.entities).toEqual([]);await request(1,{op:'join',type:'room',code:e.code});expect((await action(1,e.id,'start')).status).toBe(403);expect((await action(1,e.id,'transfer',{member:(await connect(1)).actor.id})).status).toBe(403);});
  it('keeps invitation entropy, rejects guesses, and caps room capacity under concurrent joins',async()=>{await Promise.all(tokens.map((_,i)=>connect(i)));const e=await create(0);expect(e.code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);expect((await request(1,{op:'join',type:'room',code:'AAAAAAAAAAAA'})).status).toBe(404);const joined=await Promise.all([1,2,3,4].map(actor=>request(actor,{op:'join',type:'room',code:e.code})));expect(joined.filter(r=>r.status===200)).toHaveLength(3);expect((await current(0,e.id)).members).toHaveLength(4);});
  it('rejects oversized JSON without applying any action',async()=>{await connect(0);const r=await request(0,{op:'create',type:'room',extra:'x'.repeat(16000)});expect(r.status).toBe(413);expect((await request(0,{op:'list'})).body.entities).toEqual([]);});
  it('expires groups and rate-limits invitation guesses',async()=>{await connect(0);const e=await create(0);await connect(1);for(let i=0;i<20;i++)expect((await request(1,{op:'join',type:'room',code:'AAAAAAAAAAAA'})).status).toBe(404);expect((await request(1,{op:'join',type:'room',code:e.code})).status).toBe(429);clock+=86400001;expect((await request(0,{op:'list'})).body.entities).toEqual([]);expect((await request(1,{op:'join',type:'room',code:e.code})).status).toBe(404);});
});
describe('server-authoritative multiplayer',()=>{
  it('rejects a join between the final member leaving and the group being removed',async()=>{
    await connect(0);await connect(1);
    for(const type of ['room','clan']){
      const e=await create(0,type,type==='clan'?{name:'Blueprint Guild'}:{}),cas=store.cas.bind(store);
      let joinStatus=0;
      store.cas=async(row,expected)=>{
        const changed=await cas(row,expected);
        if(changed&&row.id===e.id&&Array.isArray(row.data.members)&&row.data.members.length===0){
          joinStatus=(await request(1,{op:'join',type,code:e.code})).status;
        }
        return changed;
      };
      try{
        expect((await action(0,e.id,'leave')).status).toBe(200);
        expect(joinStatus).toBe(400);
        expect((await request(1,{op:'list'})).body.entities).toEqual([]);
      }finally{store.cas=cas;}
    }
  });
  it('requires two ready players, locks a started roster, and prevents stale concurrent updates',async()=>{await connect(0);await connect(1);await connect(2);const e=await create(0);expect((await action(0,e.id,'start')).status).toBe(400);await request(1,{op:'join',type:'room',code:e.code});const snap=await current(0,e.id);const concurrent=await Promise.all([0,1].map(actor=>request(actor,{op:'ready',id:e.id,version:snap.version})));expect(concurrent.map(r=>r.status).sort()).toEqual([200,409]);const after=await current(0,e.id);expect(after.members.filter(m=>m.ready)).toHaveLength(1);for(let actor=0;actor<2;actor++){const s=await current(actor,e.id);if(!s.members.find(m=>m.id===after.members[actor].id)!.ready)await action(actor,e.id,'ready');}expect((await action(0,e.id,'start')).status).toBe(200);expect((await request(2,{op:'join',type:'room',code:e.code})).status).toBe(400);});
  it('rotates real player turns and completes all three cooperative tasks',async()=>{const e=await readyEvent();expect((await action(1,e.id,'dispatch',{action:'observe'})).status).toBe(409);expect((await action(0,e.id,'dispatch',{action:'dispatch'})).status).toBe(200);expect((await current(0,e.id)).phase).toBe(0);for(let step=0;step<9;step++)expect((await action(step%2,e.id,'dispatch',{action:['observe','protect','dispatch'][step%3]})).status).toBe(200);const result=await current(0,e.id);expect(result.status).toBe('complete');expect(result.task).toBe(3);expect(result.risks).toBe(1);expect(result.log.filter(l=>l.accepted)).toHaveLength(9);expect((await action(0,e.id,'dispatch',{action:'observe'})).status).toBe(400);});
  it('evaluates shared seeded rounds on the server and conceals opponents until completion',async()=>{const e=await readyEvent('tournament',{arena:'outpost'});expect(e.seeds).toHaveLength(3);expect((await action(0,e.id,'submit',{rules:workedPolicy('outpost'),score:999})).status).toBe(400);expect((await action(0,e.id,'submit',{rules:workedPolicy('outpost')})).status).toBe(200);const before=await current(1,e.id);expect(Object.keys(before.results)).toEqual([]);expect(before.submitted).toHaveLength(1);expect((await action(0,e.id,'submit',{rules:workedPolicy('outpost')})).status).toBe(400);expect((await action(1,e.id,'submit',{rules:[{when:'always',action:'coast'}]})).status).toBe(200);const result=await current(0,e.id);expect(result.status).toBe('complete');const standings=competitionStandings(result);expect(standings[0].total).toBe(300);expect(standings[0].points).toBe(9);expect(standings[1].total).toBe(0);expect(Object.values(result.results).every(r=>!('rules'in r))).toBe(true);});
  it('rejects code, invalid conditions, unbounded rules, and forged policy fields',async()=>{const e=await readyEvent('room',{mode:'duel',arena:'space'});for(const rules of [[{when:'always',action:'eval'}],[{when:'always',action:'approach',code:'alert(1)'}],Array(9).fill({when:'always',action:'approach'}),[]])expect((await action(0,e.id,'submit',{rules})).status).toBe(400);expect((await current(0,e.id)).submitted).toEqual([]);});
  it('coordinates preset signals, transfers clan hosts, and deletes a device without changing local rewards',async()=>{const a=await connect(0),b=await connect(1);const e=await create(0,'clan',{name:'Blueprint Guild'});await request(1,{op:'join',type:'clan',code:e.code});expect((await action(1,e.id,'signal',{signal:'hello free chat'})).status).toBe(400);expect((await action(1,e.id,'signal',{signal:'good-round'})).status).toBe(200);expect((await action(0,e.id,'transfer',{member:b.actor.id})).status).toBe(200);expect((await current(1,e.id)).owner).toBe(b.actor.id);expect((await request(0,{op:'delete-device'})).status).toBe(200);expect((await request(0,{op:'list'})).status).toBe(401);const remaining=await current(1,e.id);expect(remaining.members.map(m=>m.id)).toEqual([b.actor.id]);expect(JSON.stringify(remaining)).not.toContain(a.actor.id);expect('xp'in remaining).toBe(false);});
  it('closes an active event when a participant leaves and removes their submitted data',async()=>{const e=await readyEvent('room',{mode:'duel'});await action(1,e.id,'submit',{rules:workedPolicy('sports')});expect((await action(1,e.id,'leave')).status).toBe(200);const closed=await current(0,e.id);expect(closed.status).toBe('closed');expect(closed.members).toHaveLength(1);expect(closed.submitted).toEqual([]);});
  it('runs all arena kinds on shared seeds with bounded deterministic evaluation',()=>{for(const arena of ['sports','outpost','scenario','space'] as const){const a=evaluateController(arena,[4,53,9999],workedPolicy(arena));expect(evaluateController(arena,[4,53,9999],workedPolicy(arena))).toEqual(a);expect(a.rounds.every(r=>r.complete&&r.ticks<=120)).toBe(true);}});
});
describe('PostgREST store adapter',()=>{
  it('uses service credentials only at the adapter and a version filter for atomic updates',async()=>{const requests:{url:string;options:RequestInit}[]=[];const row:StoredRow={id:crypto.randomUUID(),bucket:'room',lookup:'room:TEST',data:{members:[]},version:2,expiresAt:new Date().toISOString()};const fetcher=(async(url:URL|RequestInfo,options?:RequestInit)=>{requests.push({url:String(url),options:options!});return Response.json([]);}) as typeof fetch;const remote=new RestOnlineStore('https://project.supabase.co','sb_secret_test-only',fetcher);expect(await remote.cas({...row,version:3},2)).toBe(false);expect(requests[0].url).toContain('&version=eq.2');expect(requests[0].options.method).toBe('PATCH');expect((requests[0].options.headers as Record<string,string>).Authorization).toBeUndefined();expect((requests[0].options.headers as Record<string,string>).apikey).toBe('sb_secret_test-only');expect(JSON.parse(String(requests[0].options.body)).version).toBe(3);await remote.list('actor');expect(requests[1].url).toContain('data->members=cs.');});
});
