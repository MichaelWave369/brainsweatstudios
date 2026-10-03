import { AGENT_IDS, electricParts, fireExit, fireLayers, isArena, isRungFour, policyActions, policyConditions, roadChecks, truckChecks, waterLayers, type ArenaKind, type PolicyRule, type RungFourId } from './models';
import { importController } from '../../runtime/packages.ts';
type Test=(value:unknown)=>boolean;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const number=(min:number,max:number):Test=>v=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(min:number,max:number):Test=>v=>number(min,max)(v)&&Number.isInteger(v);
const boolean:Test=v=>typeof v==='boolean';
const text=(max:number):Test=>v=>typeof v==='string'&&v.length<=max;
const one=(values:readonly unknown[]):Test=>v=>values.includes(v);
const array=(test:Test,max:number,length?:number):Test=>v=>Array.isArray(v)&&v.length<=max&&(length===undefined||v.length===length)&&Array.from(v).every(test);
const shape=(rules:Record<string,Test>):Test=>v=>object(v)&&Object.keys(v).length===Object.keys(rules).length&&Object.entries(rules).every(([key,test])=>Object.hasOwn(v,key)&&test(v[key]));
const parts=(names:string[]):Test=>v=>array(one(names),names.length)(v)&&new Set(v as string[]).size===(v as string[]).length;
export const validRules:Test=v=>array(shape({when:one(policyConditions),action:one(policyActions)}),8)(v)&&(v as unknown[]).length>0;
export function parsePolicy(value:unknown,kind:ArenaKind):PolicyRule[] {
  try{const pkg=importController(value,kind);if('rules'in pkg.parameters)return pkg.parameters.rules.map(rule=>({...rule}));}catch{ /* Preserve the approachable legacy error. */ }
  throw new Error('Choose a version 1 policy or compatible controller package for this arena, with 1–8 valid condition/action rules.');
}
const road=shape({checks:parts(roadChecks),speed:integer(10,60),reaction:number(1,3),gap:integer(10,150),wet:boolean,phase:integer(0,4),started:boolean,risks:integer(0,100000),feedback:text(600)});
const truck=shape({checks:parts(truckChecks),faultReported:boolean,cleared:boolean,front:integer(0,30),rear:integer(0,30),secured:boolean,phase:integer(0,4),started:boolean,risks:integer(0,100000),feedback:text(600)});
const trade=shape({length:number(40,240),measured:boolean,pieces:array(number(40,240),4),used:number(0,1000),joined:boolean,inspected:boolean,feedback:text(600)});
const lines=shape({stages:array(integer(0,7),6,6),selected:integer(0,5),risks:integer(0,100000),feedback:text(600)});
const electric=shape({parts:parts(electricParts),config:shape({voltage:integer(1,24),r1:integer(1,30),r2:integer(1,30),mode:one(['series','parallel']),fuse:number(0.5,3)}),powered:boolean,measured:boolean,tests:integer(0,100000)});
const fire=shape({x:integer(0,7),y:integer(0,5),layers:parts(fireLayers),moves:integer(0,100000),risks:integer(0,100000),outside:boolean,meeting:boolean,help:boolean,feedback:text(600)});
const swim=shape({layers:parts(waterLayers),stage:integer(0,3),risks:integer(0,100000),feedback:text(600)});
const trace=shape({tick:integer(1,120),action:one(policyActions),reason:text(500),x:number(-104,104),y:number(-104,104),energy:number(0,100),water:number(0,12),progress:integer(0,6)});
export const validEpisode:Test=shape({kind:one(AGENT_IDS),seed:integer(0,999999),difficulty:integer(0,2),tick:integer(0,120),x:number(-104,104),y:number(-104,104),vx:number(-3,3),vy:number(-3,3),energy:number(0,100),water:number(0,12),progress:integer(0,6),phase:integer(0,2),hasBall:boolean,collisions:integer(0,120),collected:array(integer(0,4),5),status:one(['ready','complete','timeout','depleted']),trace:array(trace,120)});
const training=shape({seed:integer(0,99),rules:validRules,episode:validEpisode,tests:integer(0,100000)});
const schemas:Record<RungFourId,Test>={driving:road,cdl:truck,trade,lines,electric,fire,swim,sports:training,outpost:training,scenario:training,space:training};
export function validateRungFour(id:string,value:unknown,mission=0,difficulty=0):boolean {
  if(!isRungFour(id)||!schemas[id](value))return false;
  const v=value as Record<string,unknown>;
  if(id==='trade')return Math.abs(Number(v.used)-(v.pieces as number[]).reduce((sum,n)=>sum+n+2,0))<0.001&&(!v.inspected||!!v.joined);
  if(id==='fire'){const exit=fireExit(mission);return (!v.outside||v.x===exit.x&&v.y===exit.y)&&(!v.meeting||!!v.outside)&&(!v.help||!!v.meeting);}
  if(id==='cdl')return (!v.cleared||!!v.faultReported)&&(!v.started||!!v.cleared);
  if(isArena(id)){
    const e=v.episode as {kind:string;seed:number;difficulty:number;tick:number;x:number;y:number;trace:{tick:number}[];collected:number[]};
    return e.kind===id&&e.seed===v.seed&&e.difficulty===difficulty&&e.trace.length===e.tick&&e.trace.every((row,i)=>row.tick===i+1)&&new Set(e.collected).size===e.collected.length&&(id==='space'||Number.isInteger(e.x)&&Number.isInteger(e.y)&&e.x>=0&&e.x<=8&&e.y>=0&&e.y<=6);
  }
  return true;
}
