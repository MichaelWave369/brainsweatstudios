import { ADVANCED_IDS, robotGoal, type AdvancedId } from './models';
type Test=(v:unknown)=>boolean;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const n=(min:number,max:number):Test=>v=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const i=(min:number,max:number):Test=>v=>n(min,max)(v)&&Number.isInteger(v);
const b:Test=v=>typeof v==='boolean';const str=(max:number):Test=>v=>typeof v==='string'&&v.length<=max;
const one=(items:readonly unknown[]):Test=>v=>items.includes(v);
const arr=(test:Test,max:number,length?:number):Test=>v=>Array.isArray(v)&&v.length<=max&&(length===undefined||v.length===length)&&Array.from(v).every(test);
const shape=(rules:Record<string,Test>):Test=>v=>object(v)&&Object.keys(v).length===Object.keys(rules).length&&Object.entries(rules).every(([key,test])=>Object.hasOwn(v,key)&&test(v[key]));
const parts=(names:string[]):Test=>v=>arr(one(names),names.length)(v)&&new Set(v as string[]).size===(v as string[]).length;
const engine=shape({config:shape({type:one(['electric','piston']),cylinders:i(1,8),throttle:i(10,100),gear:i(1,6),cooling:i(0,8),load:i(10,40)}),parts:parts(['Power source','Drive shaft','Transmission','Cooling system','Load bench']),runs:i(0,100000),tested:b,history:arr(n(0,100000),8)});
const robot=shape({config:shape({motor:i(1,4),battery:i(20,80),sensor:i(0,3),wheels:one(['grip','speed'])}),parts:parts(['Chassis','Motors','Battery','Controller','Sensor']),program:arr(one(['F','R','L','S']),80),robot:shape({x:i(0,6),y:i(0,6),direction:i(0,3),energy:n(0,80),pc:i(0,80),collisions:i(0,80),delivered:b}),tests:i(0,100000)});
const vm=shape({config:shape({ram:one([4,8,12,16]),disk:one([4,8,12,16]),clock:i(1,4)}),parts:parts(['CPU','RAM','Storage','Clock']),program:str(2000),machine:shape({accumulator:i(-10000000000,10000000000),pc:i(0,80),ram:arr(i(-1000000,1000000),16),disk:arr(i(-1000000,1000000),16),cycles:i(0,121),halted:b,error:str(300),output:arr(i(-1000000,1000000),120)}),boots:i(0,100000)});
const trail=shape({step:i(0,6),food:i(0,30),water:i(0,30),cash:i(0,200),energy:n(0,100),battery:n(0,100),distance:i(0,156),trust:i(0,6),log:arr(one(['walk','cycle','transit','community']),6)});
const water=shape({config:shape({filter:b,treatment:b,sealed:b,chemical:b,leak:i(0,40),inflow:i(5,40)}),network:shape({day:i(0,5),stored:n(0,100),cash:n(-50,80),supplied:n(0,1000),demand:i(0,1000),safeDays:i(0,5),waste:n(0,1000)}),notice:str(500)});
const kitchen=shape({ingredients:parts(['Egg mixture','Poultry portion','Grain or beans','Vegetables','Clean pan']),servings:i(1,8),heat:i(60,160),stir:b,fridge:i(1,10),pot:shape({temperature:n(0,160),minutes:i(0,40),stirred:i(0,40),burned:b}),measured:b});
const creator=shape({scenes:arr(one(['Opening title','Wide camera','Demonstration','Close-up detail','Recap card']),5),captions:b,privacy:b,moderation:b,voice:i(-30,-3),music:i(-40,-3),bitrate:i(1,12),fps:one([15,30,45,60]),rehearsals:i(0,100000)});
const stem=shape({answer:str(100),parameter:n(0,8),tested:i(0,100000),correct:b,feedback:str(500)});
const schemas:Record<AdvancedId,Test>={math:stem,geometry:stem,calculus:stem,physics:stem,engine,robot,vm,trail,water,kitchen,creator};
export function validateAdvanced(id:string,value:unknown,mission=0):boolean{
 if(!(ADVANCED_IDS as readonly string[]).includes(id)||!schemas[id as AdvancedId](value))return false;
 const v=value as Record<string,unknown>;
 if(id==='robot'){const c=v.config as {battery:number},s=v.robot as {pc:number;energy:number;x:number;y:number;delivered:boolean};const goal=robotGoal(mission);return s.pc<=(v.program as string[]).length&&s.energy<=c.battery&&(!s.delivered||s.x===goal.x&&s.y===goal.y);}
 if(id==='vm'){const c=v.config as {ram:number;disk:number},s=v.machine as {ram:number[];disk:number[]};return s.ram.length===c.ram&&s.disk.length===c.disk;}
 if(id==='trail')return (v.log as string[]).length===v.step;
 if(id==='water'){const s=v.network as {safeDays:number;day:number;supplied:number;demand:number};return s.safeDays<=s.day&&s.supplied<=s.demand;}
 if(id==='kitchen'){const s=v.pot as {stirred:number;minutes:number};return s.stirred<=s.minutes;}
 return true;
}
