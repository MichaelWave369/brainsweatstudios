import { AgentError, parseProposal, validateProviderResponse, type ProviderAdapter } from '../agents/contracts.ts';
import { createProvider } from '../agents/registry.ts';
import { clone, hash } from '../runtime/data.ts';
import { baselineController, validateWorldController, type WorldController } from '../worlds/receipts.ts';
import { chooseFamilyAction, createFamilyEnvironment } from './runtime.ts';
import { familyReceiptDigest, familyRequest, verifyFamilyReceipt } from './receipts.ts';
import { requireData } from './specs.ts';
import type { FamilyDecision, FamilyFrame, FamilyPublicInput, FamilyReceipt } from './types.ts';
export class FamilySession {
    readonly env;readonly controllers:Record<string,WorldController>;readonly records:FamilyFrame[]=[];
    status:'READY'|'REQUESTING'|'PAUSED'|'STOPPED'|'ERROR'|'COMPLETE'='READY';error='';private generation=0;private busy=false;private pending=new Set<AbortController>();
    constructor(config:unknown,controllers:Record<string,WorldController>={},inputs:Record<string,FamilyPublicInput>={},private adapters:Record<string,ProviderAdapter>={}){this.env=createFamilyEnvironment(config,inputs);requireData(Object.keys(controllers).every(r=>this.env.roles.includes(r)),'Controller actor is absent.');this.controllers=Object.fromEntries(this.env.roles.map(r=>[r,validateWorldController(controllers[r]||baselineController(`baseline-${r}`))]));Object.values(this.controllers).forEach(c=>requireData(c.provider!=='ollama'||adapters.ollama,'Connect a local provider explicitly before this episode.'));}
    pause(){this.generation++;this.pending.forEach(c=>c.abort());this.pending.clear();this.status='PAUSED';}
    stop(){this.pause();this.status=this.env.result().terminal?'COMPLETE':'STOPPED';}
    resume(){requireData(!this.busy,'Wait for the previous turn to settle.');this.status=this.env.result().terminal?'COMPLETE':'READY';this.error='';}
    async step(human:Record<string,string>={}) {
        requireData(!this.busy&&this.status==='READY','Resume and wait before advancing a turn.');if(this.env.result().terminal){this.status='COMPLETE';return false;}
        requireData(Object.keys(human).every(r=>this.controllers[r]?.family==='human'),'Human intents must bind an actual human role.');this.env.roles.forEach(r=>{if(this.controllers[r].family==='human')requireData(this.env.observe(r).legal.includes(human[r]),'Supply a legal intent for every human role.');});
        this.busy=true;this.status='REQUESTING';const generation=this.generation;
        try {
            const proposals=await Promise.all(this.env.roles.map(async role=>{const c=this.controllers[role],view=this.env.observe(role);let intent:string,decision:FamilyDecision;
                if(c.family==='human'){intent=human[role];decision={source:'human',requestHash:null,response:null};}
                else if(c.family==='baseline'){intent=chooseFamilyAction(view);decision={source:'baseline',requestHash:null,response:null};}
                else {requireData(view.tick<c.requestBudget,'Model request budget reached.');const request=familyRequest(this.env,role,c),adapter=this.adapters[c.provider]||(c.provider==='mock'?createProvider('mock'):undefined);requireData(adapter&&adapter.id===c.provider,'Connected provider differs.');const abort=new AbortController();this.pending.add(abort);let timer:ReturnType<typeof setTimeout>|undefined;
                    try {const response=await Promise.race([adapter.propose(request,abort.signal),new Promise<never>((_,reject)=>{const cancel=()=>reject(new AgentError('CANCELLED','Turn cancelled.'));abort.signal.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>{reject(new AgentError('TIMEOUT','Proposal exceeded the turn deadline.'));abort.abort();},c.timeoutMs);})]);const checked=validateProviderResponse(response,request.budgets.responseBytes);requireData(checked.model===c.model,'Provider model differs from the selected descriptor.');intent=parseProposal(checked.text,request.observation.legalActions,request.budgets).action.type;decision={source:'model',requestHash:hash(request),response:checked.text};}finally{clearTimeout(timer);this.pending.delete(abort);}
                }return {role,intent,decision,observationHash:hash(view)};
            }));
            if(generation!==this.generation)return false;
            const intents=Object.fromEntries(proposals.map(p=>[p.role,p.intent])),transition=this.env.step(intents);
            this.records.push({...transition,intents,observations:Object.fromEntries(proposals.map(p=>[p.role,p.observationHash])),decisions:Object.fromEntries(proposals.map(p=>[p.role,p.decision]))});this.status=this.env.result().terminal?'COMPLETE':'READY';return true;
        }catch(e){this.pending.forEach(c=>c.abort());if(generation===this.generation){this.status='ERROR';this.error=e instanceof Error?e.message:'Proposal rejected.';}return false;}finally{this.busy=false;}
    }
    receipt():FamilyReceipt {const r:Omit<FamilyReceipt,'digest'>={schema:'family-episode@1',config:this.env.config,initialControllers:clone(this.controllers),inputs:this.env.inputs,records:clone(this.records),result:this.env.result(),outputs:this.env.outputs(),ending:this.env.result().terminal?'COMPLETE':this.status==='ERROR'?'ERROR':'STOPPED'};return verifyFamilyReceipt({...r,digest:familyReceiptDigest(r)});}
    static restore(input:unknown,adapters:Record<string,ProviderAdapter>={}) {const r=verifyFamilyReceipt(input),s=new FamilySession(r.config,r.initialControllers,r.inputs,adapters);for(const row of r.records){s.env.step(row.intents);s.records.push(clone(row));}s.status='STOPPED';return s;}
}
