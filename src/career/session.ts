import { createProvider } from '../agents/registry.ts';
import { createAgentSession } from '../agents/session.ts';
import { hash } from '../runtime/data.ts';
import { worldConfig } from '../runtime/garageWorlds.ts';
import type { WorldController } from '../worlds/receipts.ts';
import { WorldSession } from '../worlds/session.ts';
import { townPack } from '../worlds/townZero.ts';
import { type AgentPassport, type CareerRun, type CareerSave, type EvaluationInput } from './types.ts';
import { demand, publicWorldMemory, validateCareer, validateEvaluation, validatePassport } from './validation.ts';
import { sealRun } from './operations.ts';
import { FAMILY_IDS, type FamilyId, type FamilyArtifactInput, type FamilyConfig, type ScoreSpec } from '../families/types.ts';
import { familyConfig, acceptsArtifact, seedAllowed, validateFamilyConfig } from '../families/specs.ts';
import { FamilySession } from '../families/session.ts';
import { createFamilyEnvironment } from '../families/runtime.ts';
// All controller proposals pass the existing native validators. This layer
// binds operational identity and admits public inputs; it owns no world state.
export function createCareerSession(passport: AgentPassport, worldId: string, input: EvaluationInput, source?: CareerSave,options:{seed?:number;raceMode?:NonNullable<FamilyConfig['race']>['mode'];score?:ScoreSpec;config?:FamilyConfig;sharedController?:boolean}={}) {
    const agent = validatePassport(passport), evaluation = validateEvaluation(input);
    demand(agent.compatibleWorlds.includes(worldId), 'Agent/world compatibility is absent.');
    demand(evaluation.notes.every(n => n.scope === 'CAREER' || n.worldId === worldId && (n.scope !== 'EPISODE' || n.episode === evaluation.episode)), 'Public memory crossed its declared scope before execution.');
    demand(evaluation.artifacts.every(a => a.creator === agent.id && a.compatibleWorlds.includes(worldId)), 'Artifact admission is incompatible before execution.');
    if (evaluation.artifacts.length || evaluation.notes.some(n => n.sourceRun)) {
        demand(source, 'Provide the verified Locker to admit source-backed inputs.');
        const provenance = validateCareer(source);
        evaluation.artifacts.forEach(a => demand(provenance.artifacts.some(p => hash(p) === hash(a)), 'Artifact provenance is absent before execution.'));
        evaluation.notes.forEach(n => { if (n.sourceRun)
            demand(provenance.runs.some(r => r.digest === n.sourceRun && r.agentId === agent.id && r.evaluation.partition === n.partition), 'Memory provenance differs before execution.'); });
    }
    let busy=false;
    const exclusive=async(fn:()=>Promise<boolean>)=>{demand(!busy,'Wait for the current intent to settle.');busy=true;try{return await fn();}finally{busy=false;}};
    if(FAMILY_IDS.includes(worldId as FamilyId)){
        demand(evaluation.artifacts.every(a=>a.type!=='world-plan'&&acceptsArtifact(worldId,a.type)),'Destination rejects this artifact family.');
        const config=options.config?validateFamilyConfig(options.config):familyConfig(worldId as FamilyId,options.seed??({CAREER:17,TRAIN:1001,HOLDOUT:2001,TRANSFER:3001}[evaluation.partition]),options.raceMode);demand(config.family===worldId,'Configuration belongs to another family.');
        demand(seedAllowed(evaluation.partition,config.seed),'Use disjoint seeds: TRAIN 1000–1999, HOLDOUT 2000–2999, TRANSFER 3000–3999; CAREER uses the remaining seeds.');
        const actor=({'auto-circuit':'driver-0','stunt-show':'performer','cache-quest':'explorer','web-scout':'researcher','stream-studio':'producer','ensemble-lab':'conductor'} as const)[worldId as FamilyId];
        const controller=agent.controller.world,family=({'auto-circuit':'racing','stunt-show':'performance','cache-quest':'navigation','web-scout':'research','stream-studio':'media','ensemble-lab':'music'} as const)[worldId as FamilyId];
        const effective=options.score?validateFamilyConfig({...config,score:options.score}):config,inputs={[actor]:{snapshotHash:evaluation.snapshotHash,notes:evaluation.notes.map(n=>n.text),artifacts:evaluation.artifacts.map(a=>({type:a.type,contentHash:a.contentHash,content:a.content})) as FamilyArtifactInput[]}};
        demand(!options.sharedController||controller.family!=='human','Use one human role or provide role intents through the native team host.');
        const bindings=options.sharedController?Object.fromEntries(createFamilyEnvironment(effective,inputs).roles.map(role=>[role,controller])):{[actor]:controller};
        const session=new FamilySession(effective,bindings,inputs);
        return {actor,kind:'family' as const,controllers:()=>session.controllers,status:()=>session.status,observation:()=>session.env.observe(actor),result:()=>session.env.result(),actions:()=>session.env.observe(actor).legal,step:async(action?:string)=>exclusive(async()=>{session.resume();return session.step(action?{[actor]:action}:{});}),pause:()=>session.pause(),stop:()=>session.stop(),recordPlan:()=>{throw new Error('Retain the native family output after its recorded actions.');},receipt:():CareerRun=>{session.pause();return sealRun({agentId:agent.id,actor,worldId,family,controller,evaluation,receipt:session.receipt()});}};
    }
    if (['town-zero', 'reserve-lesson'].includes(worldId)) {
        const pack = townPack(), spec = pack.worlds.find(w => w.id === worldId)!;
        const actor = spec.roles[0].id;
        const controller: WorldController = { ...agent.controller.world, context: evaluation.notes.length || evaluation.artifacts.length ? 'BOUNDED_NOTEBOOK' : agent.controller.world.context };
        demand(controller.provider !== 'ollama', 'Connect a local model explicitly in the Agent Garage; the Locker does not auto-connect providers.');
        const session = new WorldSession(pack, worldId, 369, { [actor]: controller });
        if (evaluation.notes.length || evaluation.artifacts.length)
            session.setMemory(actor, publicWorldMemory(evaluation));
        evaluation.artifacts.forEach(a => {demand(a.type==='world-plan','This WorldSpec adapter accepts world plans only.');session.setPlan(actor, a.content);});
        return {
            actor, kind: 'world' as const,
            status: () => session.status, observation: () => session.env.observe(actor), result: () => session.env.result(),
            actions: () => session.env.observe(actor).legalActions.map(a => a.type),
            step: async (action?: string) => exclusive(async()=>{ session.resume(); const ok = await session.step(action ? { [actor]: action } : undefined); return !!ok; }),
            pause: () => session.pause(), stop: () => session.stop(),
            recordPlan: () => { demand(session.env.result().tick > 0, 'Advance before creating a portable plan.'); session.setPlan(actor, { schema: 'world-plan@1', goal: 'Preserve public reserves.', steps: ['Inspect visible conditions.', 'Choose a legal refill or repair.'], risks: ['Delayed demand can consume reserves.'], fallbacks: ['Wait when no legal operation is useful.'] }); },
            receipt: (): CareerRun => { session.stop(); return sealRun({ agentId: agent.id, actor, worldId, family: 'infrastructure', controller, evaluation, receipt: session.receipt() }); },
        };
    }
    demand(['survey', 'community', 'signal-maze'].includes(worldId), 'This destination has no career adapter.');
    demand(evaluation.condition === 'FRESH', 'V7 career adapters currently require fresh inputs.');
    const config = worldConfig(worldId as 'survey' | 'community' | 'signal-maze');
    const actor = worldId === 'community' ? 'engineer' : 'pilot';
    const controller = agent.controller.garage;
    demand(controller.provider !== 'ollama', 'Connect a local model explicitly in the Agent Garage; the Locker does not auto-connect providers.');
    const session = createAgentSession({ config, controllers: worldId === 'community' ? { engineer: controller, logistics: controller } : { pilot: controller }, providers: controller.provider === 'mock' ? [createProvider('mock')] : [] });
    return {
        actor, kind: 'garage' as const, status: () => ['IDLE', 'WAITING'].includes(session.status) ? 'READY' : session.status, observation: () => session.observation(), result: () => session.result(),
        actions: () => session.observation().legalActions.map(a => a.type),
        step: async (action?: string) => exclusive(async()=>{ session.resume(); await session.step(action ? { type: action } : undefined); return !session.lastError; }),
        pause: () => session.pause(), stop: () => session.stop(), recordPlan: () => { throw new Error('This destination does not admit world plans.'); },
        receipt: (): CareerRun => { session.pause(); return sealRun({ agentId: agent.id, actor, worldId, family: worldId === 'community' ? 'cooperation' : 'navigation', controller, evaluation, receipt: session.receipt() }); },
    };
}
export type CareerSession = ReturnType<typeof createCareerSession>;
