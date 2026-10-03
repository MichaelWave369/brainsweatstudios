import type { Difficulty } from '../../data/types';
import { difficultyIndex } from '../../data/types';
import type { BotStep } from '../../systems/bots';
import { robotGoal, stemTask, type AdvancedId } from './models';
const click=(match:string,optional=false):BotStep=>({kind:'click',match,label:match.replace(/^\^|\$$/g,''),optional});
const input=(label:string,value:number):BotStep=>({kind:'input',selector:`input[aria-label="${label}"], input[data-source-label="${label}"]`,value:String(value),label:`Set ${label} to ${value}`});
const check=(match:string):BotStep=>({kind:'check',match,label:match});
export function advancedBotPlan(id:AdvancedId,difficulty:Difficulty,mission:number):BotStep[]{
 if(['math','geometry','calculus','physics'].includes(id)){const task=stemTask(id as 'math'|'geometry'|'calculus'|'physics',mission,difficultyIndex(difficulty));return[input('Your result',task.answer),click('Check my reasoning'),click('Complete the investigation')];}
 if(id==='engine')return[...['Power source','Drive shaft','Transmission','Cooling system','Load bench'].map(p=>click(`^${p}`)),input('Gear reduction',4),input('Cooling modules',4),input('Throttle',75),click('Run the engine'),click('Submit my engine design')];
 if(id==='robot')return[...['Chassis','Motors','Battery','Controller','Sensor'].map(p=>click(`^${p}`)),input('Battery capacity',60),click('Load a delivery route'),...Array.from({length:7+robotGoal(mission).y},()=>click('Step controller')),click('Submit my robot')];
 if(id==='vm')return[...['CPU','RAM','Storage','Clock'].map(p=>click(`^${p}`)),input('RAM words',8),input('Storage words',8),click('Load a worked program'),click('Boot and run'),click('Submit my virtual computer')];
 if(id==='trail')return[...['Public transit','Public transit','Help at the community hub','Public transit','Help at the community hub','Public transit'].map(p=>click(p)),click('Debrief my journey')];
 if(id==='water')return[...['Clarity filter','Verified treatment stage','Clean sealed storage'].map(p=>click(`^${p}`)),input('Daily inflow',30),input('Leak loss',0),click('Switch to a verified source',true),...Array.from({length:5},()=>click('Run one supply day')),click('Review my water network')];
 if(id==='kitchen')return[...([mission===1?'Egg mixture':mission===3?'Poultry portion':'Grain or beans','Vegetables','Clean pan']).map(p=>click(`^${p}`)),input('Planned portions',8),input('Fridge temperature',3),...Array.from({length:16},()=>click('Simulate one cooking minute')),click('Measure center temperature'),click('Serve the virtual meal')];
 return[click('Add Opening title'),click('Add Demonstration'),click('Add Recap card'),input('Music level',-24),check('Add readable captions'),check('Review personal details and permissions'),check('Prepare moderation and a stop plan'),click('Rehearse my show'),click('Submit my production')];
}
