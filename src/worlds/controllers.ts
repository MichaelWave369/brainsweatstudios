import type { WorldController } from './receipts.ts';
import type { WorldObservation } from './types.ts';
export interface PublicControllerView { role:string; resources:WorldObservation['resources']; entities:WorldObservation['entities']; flags:WorldObservation['flags']; legal:string[] }
// Baselines use only public observations. No snapshots, scheduler, RNG or specs.
export function choosePublicAction(o:PublicControllerView,mode:WorldController['baseline']='maintenance-first'):string {
  const can=(id:string)=>o.legal.includes(id),pick=(id:string)=>can(id)?id:'wait',n=(id:string)=>typeof o.resources[id]==='number'?Number(o.resources[id]):0;
  if(o.legal.length===1)return o.legal[0];
  if(can('inspect-store')&&o.resources.water==='UNKNOWN')return 'inspect-store';
  if(can('refill')&&n('water')<10)return 'refill';
  if(o.role==='planner'){
    if(mode==='reserve-first'&&can('ration')&&!o.flags.ration)return 'ration';
    if(can('fund-services')&&n('budget')<(mode==='reserve-first'?240:160))return 'fund-services';
    if(can('reserve-supplies')&&n('parts')<5)return 'reserve-supplies';
    if(can('ration')&&!o.flags.ration&&mode!=='greedy')return 'ration';
  }
  if(o.role==='infrastructure'){
    for(const id of ['generator','pump'])if(o.entities[id]?.status==='UNKNOWN'&&can(`inspect-${id}`))return `inspect-${id}`;
    for(const id of ['pump','generator']){const s=o.entities[id]?.status;if(typeof s==='number'&&s<(mode==='greedy'||mode==='reactive'?1:mode==='reserve-first'?50:100)&&can(`maintain-${id}`))return `maintain-${id}`;}
  }
  if(o.role==='logistics'){
    if(o.entities.road?.status===0)return pick('clear-road');
    if(n('food')<(mode==='reserve-first'?120:60))return pick('buy-food');
    if(n('fuel')<40)return pick('buy-fuel');
    if(typeof o.resources.water!=='number'&&mode!=='greedy'&&can('measure-water'))return 'measure-water';
  }
  if(o.role==='communications'&&o.entities.tower?.status===0)return pick('restore-comms');
  return pick('wait');
}
export const chooseWorldAction=(o:WorldObservation,mode:WorldController['baseline']='maintenance-first')=>choosePublicAction({role:o.actor.role,resources:o.resources,entities:o.entities,flags:o.flags,legal:o.legalActions.map(a=>a.type)},mode);
