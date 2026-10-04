import { clone, exact, freeze, hash, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { raceMachine } from './race.ts';
import { stuntMachine } from './stunt.ts';
import { cacheMachine } from './cache.ts';
import { streamMachine, webMachine } from './media.ts';
import { ensembleMachine } from './ensemble.ts';
import { performanceMachine } from '../performance/ensemble.ts';
import { scoredMediaMachine } from '../performance/media.ts';
import { emptyFamilyInput, requireData, validateFamilyConfig, validateFamilyInput } from './specs.ts';
import type { FamilyMachine, FamilyObservation, FamilyPublicInput, FamilyResult, ScoreSpec, VehicleSpec } from './types.ts';
export function createFamilyEnvironment(configInput:unknown,provided:Record<string,FamilyPublicInput>={}) {
    const config=validateFamilyConfig(configInput),effective=clone(config);
    assertData(provided,160000,18000,16);requireData(plain(provided),'Family inputs must be plain data.');
    const checked=Object.fromEntries(Object.entries(provided).map(([actor,value])=>[actor,validateFamilyInput(value,config.family)]));
    if(effective.race){const vehicle=checked['driver-0']?.artifacts.find(a=>a.type==='vehicle-setup');if(vehicle)effective.race.vehicles[0]={...clone(vehicle.content as VehicleSpec),id:effective.race.vehicles[0].id};}
    if(effective.family==='ensemble-lab'){const score=checked.conductor?.artifacts.find(a=>a.type==='music-score');if(score)effective.score=clone(score.content as ScoreSpec);}
    let machine:FamilyMachine;
    switch(config.family){case 'auto-circuit':machine=raceMachine(effective);break;case 'stunt-show':machine=stuntMachine(effective);break;case 'cache-quest':machine=cacheMachine(effective);break;case 'web-scout':machine=webMachine(effective);break;case 'stream-studio':machine=streamMachine(effective,checked);break;case 'ensemble-lab':machine=config.schema==='family-config@2'?performanceMachine(effective):ensembleMachine(effective);}
    if(config.schema==='family-config@2'&&['stunt-show','stream-studio'].includes(config.family))machine=scoredMediaMachine(machine,checked);
    requireData(Object.keys(checked).every(role=>machine.roles.includes(role)),'Input actor is absent from this world.');
    const inputs=freeze(Object.fromEntries(machine.roles.map(r=>[r,checked[r]||emptyFamilyInput()])));let tick=0;
    const result=():FamilyResult=>{const r=machine.result(),budget=tick>=config.maxTicks&&!r.terminal;return freeze({...clone(r),terminal:r.terminal||budget,success:r.success&&!budget,ticks:tick,reason:budget?'budget':r.terminal?'complete':'running'});};
    const observe=(role:string):FamilyObservation=>{requireData(machine.roles.includes(role),'Unknown simulation role.');return freeze({family:config.family,role,tick,state:clone(machine.observe(role)),legal:machine.legal(role),input:inputs[role]});};
    return {config,inputs,roles:freeze([...machine.roles]),observe,result,stateHash:()=>hash({tick,state:machine.stateHash(),inputs}),outputs:()=>freeze(machine.roles.flatMap(r=>machine.outputs(r))),step(intents:Record<string,string>){requireData(!result().terminal,'This episode is complete.');requireData(plain(intents)&&exact(intents,machine.roles)&&machine.roles.every(r=>observe(r).legal.includes(intents[r])),'Supply exactly one legal intent per role.');const events=machine.advance(clone(intents));tick++;return freeze({tick,events,stateHash:hash({tick,state:machine.stateHash(),inputs})});}};
}
export type FamilyEnvironment=ReturnType<typeof createFamilyEnvironment>;
export function chooseFamilyAction(view:Pick<FamilyObservation,'family'|'role'|'state'|'legal'>):string {
    const s=view.state,choose=(a:string)=>view.legal.includes(a)?a:view.legal.includes('wait')?'wait':view.legal[0];
    if(view.family==='auto-circuit'){
        const c=s.telemetry as {pit:number;energy:number;grip:number;damage:number;temperature:number;speed:number;finished:boolean},v=s.vehicle as VehicleSpec;
        if(c.finished)return choose('wait');if(view.role.startsWith('crew'))return choose(c.pit?(c.energy<v.capacity?'refuel':c.grip<90?'replace-grip':'cool'):'wait');
        if(c.pit)return choose('wait');if(c.damage>12)return choose('recover');if(view.legal.includes('pit')&&(c.energy<Math.min(40,v.capacity/2)||c.grip<30||c.temperature>65))return 'pit';
        const safe=Number(s.safeSpeed);return choose(c.speed>safe?'brake':c.speed<safe-12?'accelerate':'hold-line');
    }
    if(view.family==='stunt-show'){if(view.role==='producer')return choose(!s.music?'music-cue':!s.camera?'camera-cue':'wait');return choose(s.phase==='recovery'?'recover':s.phase==='air'?Number(s.rotation)<Number(s.targetRotation)?'rotate':'land':!s.prepared?'prepare':s.music&&s.camera?'launch':'wait');}
    if(view.family==='cache-quest'){
        if(view.role==='navigator')return choose(s.clue?'share-route':'wait');if(Number(s.energy)<8)return choose('rest');const p=s.position as {x:number;y:number};
        if(!s.clue)return choose('inspect');const target=s.found?{x:0,y:0}:(s.clue as {virtualCell:{x:number;y:number}}).virtualCell;
        if(p.x<target.x)return choose('east');if(p.x>target.x)return choose('west');if(p.y<target.y)return choose('south');if(p.y>target.y)return choose('north');
        if(!s.puzzle)return choose('inspect');if(!s.solved){const puzzle=s.puzzle as {left:number;right:number;choices:number[]};return choose(`solve-${puzzle.choices.indexOf(puzzle.left+puzzle.right)}`);}return choose('collect');
    }
    if(view.family==='web-scout'){
        const sources=s.sources as {url:string}[];if(view.role==='editor')return choose(sources.length>=2?'compare-source':'wait');const page=s.page as {id:string};
        if(page.id==='home')return choose(s.searches?'open-bulletin':'search-index');if(!sources.some(n=>n.url.endsWith(`/${page.id}`)))return choose('save-source');
        if(!sources.some(n=>n.url.endsWith('/bulletin')))return choose('open-bulletin');if(!sources.some(n=>n.url.endsWith('/manual')))return choose('open-manual');if(!s.compared)return choose('compare-source');
        const pages=s.opened as {authority:string;date:number;claim:number}[],official=pages.filter(p=>p.authority==='official').sort((a,b)=>b.date-a.date)[0];return choose(`submit-${official.claim}`);
    }
    if(view.family==='stream-studio'){const role=view.role;return choose(role==='producer'?Number(s.completed)>=3?'finish-show':'cue-segment':role==='host'?s.ready?'present':!s.caption?'caption':'wait':role==='director'?'wide-camera':role==='audio'?'original-music':role==='graphics'?'title-graphic':'check-sources');}
    if(view.role==='conductor')return choose(!s.started?'entry':Number(s.beat)>=Number(s.end)?'cutoff':s.authority==='ensemble-authority@2'?(s.cues as {type:string}[]).find(c=>['entry','cutoff','dynamics'].includes(c.type))?.type||'conduct':(s.cues as {type:string}[]).some(c=>c.type==='dynamics')?'dynamics':'conduct');
    return choose(s.started&&s.active&&s.target?'play-target':'rest');
}
