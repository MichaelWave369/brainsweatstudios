import { difficultyIndex, type Difficulty } from '../../data/types';
import type { BotStep } from '../../systems/bots';
import { damagedLines, electricParts, fireExit, fireLayers, fireObstacles, isArena, lineActions, roadChecks, roadEvent, routeMoves, tradeBrief, truckChecks, waterLayers, waterSafetyEvent, type RungFourId } from './models';
const click=(match:string):BotStep=>({kind:'click',match,label:match.replace(/^\^|\$$/g,'')});
const input=(label:string,value:number):BotStep=>({kind:'input',selector:`input[aria-label="${label}"], input[data-source-label="${label}"]`,value:String(value),label:`Set ${label} to ${value}`});
const select=(label:string,value:string):BotStep=>({kind:'select',selector:`select[aria-label="${label}"], select[data-source-label="${label}"]`,value,label:`Choose ${label}`});
const check=(match:string):BotStep=>({kind:'check',match,label:match});
const exact=(value:string)=>'^'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$';
export function rungFourBotPlan(id:RungFourId,difficulty:Difficulty,mission:number):BotStep[] {
  const d=difficultyIndex(difficulty);
  if(isArena(id))return [click('Load a worked controller'),click('Run full episode'),click('Submit my trained agent')];
  if(id==='driving')return [...roadChecks.map(c=>click('^'+c)),input('Model speed',30),input('Available stopping space',100),click('Start the road scenario'),...Array.from({length:4},(_,i)=>{const e=roadEvent(mission,i);return click(exact(e.choices[e.correct]));}),click('Submit my road plan')];
  if(id==='cdl')return [...truckChecks.map(c=>click('^'+c)),click('Report the warning and hold'),click('Receive virtual service clearance'),input('Rear cargo',12),check('Cargo secured in the model'),click('Begin the freight route'),...Array.from({length:4},(_,i)=>{const e=roadEvent(mission,i);return click(exact(e.choices[e.correct]));}),click('Submit my freight plan')];
  if(id==='trade'){const b=tradeBrief(mission,d);return [...[b.width,b.height,b.width,b.height].flatMap(n=>[input('Virtual piece length',n),click('Measure against blueprint'),click('Cut virtual piece')]),click('Join virtual frame'),click('Inspect the assembly'),click('Submit my trade project')];}
  if(id==='lines')return [...damagedLines(mission,d).flatMap(n=>[select('District branch',String(n)),...lineActions.map(action=>click(action))]),click('Submit the district recovery')];
  if(id==='electric')return [...electricParts.map(p=>click('^'+p)),select('Circuit arrangement',mission%2?'series':'parallel'),input('Load A resistance',mission%2?4:12),input('Load B resistance',mission%2?4:12),click('Energize virtual board'),click('Read virtual meter'),click('Submit my circuit')];
  if(id==='fire'){const exit=fireExit(mission);return [...fireLayers.map(l=>click('^'+l)),...routeMoves([1,4],[exit.x,exit.y],fireObstacles(mission),8,6).map(move=>click('Move '+move)),click('Meet at the outside point'),click('Request help in the simulation'),click('Submit my escape plan')];}
  return [...waterLayers.map(l=>click('^'+l)),...Array.from({length:3},(_,i)=>{const e=waterSafetyEvent(mission,i);return click(exact(e.choices[e.correct]));}),click('Submit my water safety plan')];
}
