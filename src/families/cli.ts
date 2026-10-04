import { addAgent, enableCircuitWorlds, evaluationInput, rememberRun, updatePassport } from '../career/operations.ts';
import { createCareerSession } from '../career/session.ts';
import { freshCareer, validateCareer } from '../career/validation.ts';
import { parseJSON, plain } from '../runtime/data.ts';
import { baselineController } from '../worlds/receipts.ts';
import type { Partition } from '../career/types.ts';
import { FAMILY_IDS, FAMILY_TITLES, type FamilyId, type FamilyConfig } from './types.ts';
import { familyConfig, requireData, validateFamilyConfig } from './specs.ts';
import { verifyFamilyReceipt } from './receipts.ts';
export async function familyCommand(command:string,args:string[],file:string|null=null) {
    if(command==='list')return FAMILY_IDS.map(id=>({id,title:FAMILY_TITLES[id],schema:'family-config@1'}));
    if(command==='verify'){const r=verifyFamilyReceipt(parseJSON(file!,1200000));return {verified:true,digest:r.digest,result:r.result};}
    requireData(command==='run','Use list, run FAMILY or verify RECEIPT.');const family=args[0] as FamilyId;requireData(FAMILY_IDS.includes(family),'Choose a known family.');
    const value=file?parseJSON(file,1350000):null,option=(name:string)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
    let save=plain(value)&&value.schema==='agent-locker@1'?validateCareer(value):addAgent(freshCareer(),'studio-agent','Studio agent');save=enableCircuitWorlds(save,save.agents[0].id);
    if(option('--controller')==='mock'){const a=save.agents[0];save=updatePassport(save,{...a,controller:{...a.controller,world:{...a.controller.world,family:'model',provider:'mock',model:'mock-policy'}}});}else {requireData(!option('--controller')||option('--controller')==='baseline','This CLI supports public baseline and offline mock only.');if(option('--controller')==='baseline'){const a=save.agents[0];save=updatePassport(save,{...a,controller:{...a.controller,world:baselineController('career-controller')}});}}
    const partition=(option('--partition')||'CAREER') as Partition;requireData(['CAREER','TRAIN','HOLDOUT','TRANSFER'].includes(partition),'Declare a known partition.');
    const seed=Number(option('--seed')??({CAREER:17,TRAIN:1001,HOLDOUT:2001,TRANSFER:3001}[partition])),mode=(option('--mode')||'solo') as NonNullable<FamilyConfig['race']>['mode'];
    const config=plain(value)&&['family-config@1','family-config@2','family-config@3'].includes(String(value.schema))?validateFamilyConfig(value):familyConfig(family,seed,mode);requireData(config.family===family,'Configuration belongs to another family.');
    const agent=save.agents[0],input=evaluationInput(save,agent.id,family,`family-cli-${save.runs.length+1}`,partition,'FRESH'),session=createCareerSession(agent,family,input,save,{config});
    while(!session.result().terminal)requireData(await session.step(),'Controller halted before a valid transition.');
    return rememberRun(save,session.receipt());
}
