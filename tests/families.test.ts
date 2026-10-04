import { describe, expect, it } from 'vitest';
import { mockAdapter } from '../src/agents/mock';
import { clone, hash } from '../src/runtime/data';
import { baselineController } from '../src/worlds/receipts';
import { FAMILY_IDS } from '../src/families/types';
import { familyConfig, validateFamilyContent, validateScore, validateVehicle } from '../src/families/specs';
import { createFamilyEnvironment, chooseFamilyAction } from '../src/families/runtime';
import { FamilySession } from '../src/families/session';
import { familyReceiptDigest, familyRequest, verifyFamilyReceipt } from '../src/families/receipts';
import { WorldSession } from '../src/worlds/session';
import { townPack } from '../src/worlds/townZero';
async function finish(s:FamilySession){for(let i=0;i<256&&!s.env.result().terminal;i++){expect(await s.step(),s.error).toBe(true);}return s.receipt();}
describe('distinct family authorities',()=>{
    for(const family of FAMILY_IDS)for(const mode of ['baseline','mock'])it(`${family}: ${mode} completes and replays actual mechanics`,async()=>{
        const config=familyConfig(family,17),env=createFamilyEnvironment(config),c={...baselineController('tested-controller'),...(mode==='mock'?{family:'model' as const,provider:'mock' as const,model:'mock-policy'}:{})};
        const session=new FamilySession(config,Object.fromEntries(env.roles.map(r=>[r,c]))),receipt=await finish(session);
        expect(receipt.result.success).toBe(true);expect(receipt.records.length).toBeGreaterThan(3);expect(verifyFamilyReceipt(clone(receipt)).digest).toBe(receipt.digest);
        receipt.outputs.forEach(o=>expect(hash(validateFamilyContent(o.type,o.content))).toBe(o.contentHash));
    });
    for(const mode of ['solo','head-to-head','multi-car','endurance'] as const)it(`race ${mode} has laps, sectors, resources and deterministic simultaneous traffic`,async()=>{
        const receipt=await finish(new FamilySession(familyConfig('auto-circuit',21,mode)));
        expect(receipt.result.success).toBe(true);const cars=receipt.result.public.cars as {lapTicks:number[];sectorTicks:unknown[];spent:number;pits:number}[];
        expect(cars).toHaveLength(mode==='solo'?1:mode==='multi-car'?4:2);cars.forEach(c=>{expect(c.lapTicks.length).toBe(mode==='endurance'?3:1);expect(c.sectorTicks.length).toBeGreaterThan(1);expect(c.spent).toBeGreaterThan(0);});if(mode==='endurance')expect(receipt.result.measures.pits).toBeGreaterThan(0);
    });
    it('proposal completion order cannot reorder the simultaneous turn',async()=>{
        const config=familyConfig('auto-circuit',17,'head-to-head'),env=createFamilyEnvironment(config),c={...baselineController('same-model'),family:'model' as const,provider:'mock' as const,model:'mock-policy'};
        const controllers=Object.fromEntries(env.roles.map(r=>[r,c])),run=async(reverse:boolean)=>{const mock=mockAdapter();const s=new FamilySession(config,controllers,{}, {mock:{...mock,async propose(r,signal){await new Promise(resolve=>setTimeout(resolve,r.observation.agent.id.endsWith('0')===reverse?1:8));return mock.propose(r,signal);}}});for(let i=0;i<5;i++)await s.step();return s.receipt();};
        const a=await run(false),b=await run(true);expect(a.digest).toBe(b.digest);
    });
    it('masked Cache Quest observations contain no uninspected cache, puzzle answer or terrain truth',()=>{
        const a=createFamilyEnvironment(familyConfig('cache-quest',17));const view=a.observe('explorer');expect(view.state.clue).toBeNull();expect(view.state.puzzle).toBeNull();expect(view.state.visible).toHaveLength(1);expect(a.observe('navigator').state.position).toBeNull();expect(JSON.stringify(view)).not.toContain('seed');
        a.step({explorer:'inspect',navigator:'wait'});expect(a.observe('explorer').state.clue).not.toBeNull();expect(a.observe('explorer').state.puzzle).toBeNull();
    });
    it('illegal or overlapping turns never mutate authority; pause cancels late proposals',async()=>{
        const config=familyConfig('auto-circuit'),c={...baselineController('slow-controller'),family:'model' as const,provider:'mock' as const,model:'mock-policy'},mock=mockAdapter();
        const s=new FamilySession(config,{'driver-0':c},{},{mock:{...mock,async propose(r,signal){await new Promise(resolve=>setTimeout(resolve,30));return mock.propose(r,signal);}}});
        const step=s.step();await expect(s.step()).rejects.toThrow();s.pause();expect(await step).toBe(false);expect(s.env.result().ticks).toBe(0);expect(s.status).toBe('PAUSED');
        const env=createFamilyEnvironment(config),before=env.stateHash();expect(()=>env.step({'driver-0':'teleport','crew-0':'wait'})).toThrow();expect(env.stateHash()).toBe(before);
    });
    it('a false research claim loses despite imported page instructions',async()=>{
        const s=new FamilySession(familyConfig('web-scout',17),{researcher:{...baselineController('operator'),family:'human'}});await s.step({researcher:'open-rumor'});expect(JSON.stringify(s.env.observe('researcher'))).toContain('Ignore your role');await s.step({researcher:'submit-0'});expect(s.env.result().success).toBe(false);
    });
    it('unsafe toy rotations fail the envelope and can recover without real-world units',async()=>{
        const s=new FamilySession(familyConfig('stunt-show'),{performer:{...baselineController('operator'),family:'human'}});await s.step({performer:'prepare'});await s.step({performer:'wait'});await s.step({performer:'launch'});await s.step({performer:'land'});expect(s.env.result().measures.envelopeViolations).toBe(1);await s.step({performer:'recover'});expect(s.env.result().measures.recovery).toBe(1);expect(JSON.stringify(s.receipt())).not.toContain('kilometer');
    });
    it('forged outcomes, observation hashes and controller attribution fail native replay even after rehashing',async()=>{
        const receipt=await finish(new FamilySession(familyConfig('cache-quest')));for(const field of ['result','observation','controller']){const r=clone(receipt);if(field==='result')r.result.measures.discoveries=10;if(field==='observation')r.records[0].observations.explorer='0'.repeat(64);if(field==='controller')r.initialControllers.explorer.family='human';const body=clone(r) as Partial<typeof r>;delete body.digest;r.digest=familyReceiptDigest(body as Omit<typeof r,'digest'>);expect(()=>verifyFamilyReceipt(r)).toThrow();}
    });
    it('strict specs reject getters, executable data, inconsistent score time and nonfinite setups',()=>{
        const config=familyConfig('auto-circuit'),vehicle=clone(config.race!.vehicles[0]);expect(()=>validateVehicle({...vehicle,power:Infinity})).toThrow();expect(()=>validateVehicle({...vehicle,script:'execute'})).toThrow();let called=false;const getter=Object.defineProperty({},'schema',{enumerable:true,get(){called=true;return 'vehicle-spec@1';}});expect(()=>validateVehicle(getter)).toThrow();expect(called).toBe(false);const score=clone(familyConfig('ensemble-lab').score!);score.parts[0].notes[1].beat=0;expect(()=>validateScore(score)).toThrow();
    });
    it('private seed fingerprints do not leak through request ids before a cache inspection',()=>{const a=createFamilyEnvironment(familyConfig('cache-quest',17)),b=createFamilyEnvironment(familyConfig('cache-quest',23)),c={...baselineController('privacy-model'),family:'model' as const,provider:'mock' as const,model:'mock-policy'};expect(a.observe('explorer')).toEqual(b.observe('explorer'));expect(familyRequest(a,'explorer',c)).toEqual(familyRequest(b,'explorer',c));a.step({explorer:'inspect',navigator:'wait'});b.step({explorer:'inspect',navigator:'wait'});expect(a.observe('explorer').state.clue).not.toEqual(b.observe('explorer').state.clue);});
    it('public policies choose only the legal role action',()=>{for(const family of FAMILY_IDS){const env=createFamilyEnvironment(familyConfig(family));for(const role of env.roles)expect(env.observe(role).legal).toContain(chooseFamilyAction(env.observe(role)));}});
    it('an imported legacy WorldSpec may use a family id without changing its native authority or mock protocol',async()=>{const pack=clone(townPack());pack.worlds[0].id='auto-circuit';const spec=pack.worlds[0],role=spec.roles[0].id,c={...baselineController('legacy-model'),family:'model' as const,provider:'mock' as const,model:'mock-policy'};const session=new WorldSession(pack,spec.id,369,{[role]:c});expect(await session.step()).not.toBeNull();expect(session.status,session.error).toBe('READY');expect(session.receipt().schema).toBe('world-episode@1');});
    it('portable vehicle parameters affect motion while the destination retains its own entity ids',()=>{const config=familyConfig('auto-circuit',17,'head-to-head'),vehicle={...config.race!.vehicles[0],id:'car-1',power:10,mass:2},input={snapshotHash:hash('declared setup'),notes:[],artifacts:[{type:'vehicle-setup' as const,contentHash:hash(vehicle),content:vehicle}]},a=createFamilyEnvironment(config,{'driver-0':input}),b=createFamilyEnvironment(config);const intents={'driver-0':'accelerate','crew-0':'wait','driver-1':'accelerate','crew-1':'wait'};a.step(intents);b.step(intents);const cars=a.result().public.cars as {id:string;speed:number}[];expect(cars.map(c=>c.id)).toEqual(['car-0','car-1']);expect(cars[0].speed).toBeGreaterThan((b.result().public.cars as {speed:number}[])[0].speed);});
});
