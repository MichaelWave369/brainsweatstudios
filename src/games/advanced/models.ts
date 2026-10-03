import { clamp } from '../../data/types';
export const ADVANCED_IDS = ['math','geometry','calculus','physics','engine','robot','vm','trail','water','kitchen','creator'] as const;
export type AdvancedId = typeof ADVANCED_IDS[number];
export const isAdvanced = (id: string): id is AdvancedId => (ADVANCED_IDS as readonly string[]).includes(id);
export const round = (v: number, places = 2) => Number(v.toFixed(places));
export function evaluatePolynomial(coefficients: number[], x: number) { return coefficients.reduceRight((value, coefficient) => value * x + coefficient, 0); }
export function derivative(coefficients: number[], x: number) { return coefficients.slice(1).reduce((sum, coefficient, i) => sum + coefficient * (i + 1) * x ** i, 0); }
export function integral(coefficients: number[], a: number, b: number) { return coefficients.reduce((sum, c, i) => sum + c / (i + 1) * (b ** (i + 1) - a ** (i + 1)), 0); }
export function projectile(speed: number, angle: number, gravity = 9.81) { const radians = angle * Math.PI / 180; const vx = speed * Math.cos(radians); const vy = speed * Math.sin(radians); const time = 2 * vy / gravity; return { vx, vy, time, range: vx * time, height: vy * vy / (2 * gravity) }; }
export interface EngineConfig { type: 'electric'|'piston'; cylinders: number; throttle: number; gear: number; cooling: number; load: number; }
export function engineRun(c: EngineConfig) {
  const baseRPM = c.type === 'electric' ? 4800 : 3600;
  const rawTorque = (c.type === 'electric' ? 12 : c.cylinders * 5) * c.throttle / 100;
  const rpm = baseRPM * c.throttle / 100 * clamp(1 - c.load / Math.max(1, rawTorque * c.gear * 3), 0, 1);
  const torque = rawTorque * c.gear * 0.9;
  const outputRPM = rpm / c.gear;
  const power = torque * outputRPM * 2 * Math.PI / 60;
  const heat = 20 + c.throttle * (c.type === 'electric' ? 0.45 : 0.8) + c.load * 0.4 - c.cooling * 8;
  return { rpm, outputRPM, torque, power, heat, stalled: rpm < 80, efficiency: 0.9 };
}
export interface RobotConfig { motor: number; battery: number; sensor: number; wheels: 'grip'|'speed'; }
export interface RobotState { x: number; y: number; direction: number; energy: number; pc: number; collisions: number; delivered: boolean; }
export const robotStart = (battery: number): RobotState => ({ x:0,y:0,direction:0,energy:battery,pc:0,collisions:0,delivered:false });
export function robotObstacles(mission: number) { return [[2,1],[2,2],[2,3],[4,4],[1,4 + mission % 2]]; }
export const robotGoal = (mission: number) => ({x:6,y: 4 + mission % 3});
export function robotStep(state: RobotState, config: RobotConfig, program: string[], mission: number): RobotState {
  if (state.pc >= program.length || state.energy <= 0 || state.delivered) return state;
  const next = {...state, pc:state.pc+1}; const instruction = program[state.pc];
  if (instruction === 'L') next.direction = (next.direction+3)%4;
  if (instruction === 'R') next.direction = (next.direction+1)%4;
  if (instruction === 'F' || instruction === 'S') {
    const vector = [[1,0],[0,1],[-1,0],[0,-1]][next.direction]; const x = next.x+vector[0]; const y = next.y+vector[1];
    const blocked = x<0 || y<0 || x>6 || y>6 || robotObstacles(mission).some(p=>p[0]===x&&p[1]===y);
    if (blocked && instruction==='S' && config.sensor>0) next.direction=(next.direction+1)%4;
    else if (blocked) next.collisions++;
    else { next.x=x; next.y=y; }
  }
  next.energy = Math.max(0,next.energy - (instruction==='F'||instruction==='S' ? 1.4 + config.motor*0.3 + (config.wheels==='speed'?0.6:0) : 0.5) - (instruction==='S'?config.sensor*0.15:0));
  const goal=robotGoal(mission); next.delivered=next.x===goal.x&&next.y===goal.y; return next;
}
export interface MachineConfig { ram: number; disk: number; clock: number; }
export interface MachineState { accumulator:number; pc:number; ram:number[]; disk:number[]; cycles:number; halted:boolean; error:string; output:number[]; }
export const machineStart=(c:MachineConfig):MachineState=>({accumulator:0,pc:0,ram:Array(c.ram).fill(0),disk:Array(c.disk).fill(0),cycles:0,halted:false,error:'',output:[]});
export function machineStep(s:MachineState, program:string, config:MachineConfig):MachineState {
  if(s.halted||s.error) return s;
  const next={...s,ram:[...s.ram],disk:[...s.disk],output:[...s.output],cycles:s.cycles+1};
  if(s.cycles>=120) return {...next,error:'Cycle limit reached. Inspect the loop.'};
  const lines=program.split('\n').map(line=>line.replace(/#.*/,'').trim()).filter(Boolean);
  if(lines.length>80||s.pc>=lines.length) return {...next,error:'Program ended without HALT, or exceeds 80 instructions.'};
  const parts=lines[s.pc].toUpperCase().split(/\s+/); const op=parts[0]; const arg=Number(parts[1]); next.pc++;
  const unary=['SET','ADD','MUL','LOAD','STORE','JNZ','READ','WRITE']; const zero=['DEC','OUT','HALT'];
  if(![...unary,...zero].includes(op)||parts.length!==(unary.includes(op)?2:1)||unary.includes(op)&&(!Number.isInteger(arg)||Math.abs(arg)>10000)) return {...next,error:'Unknown instruction or invalid integer operand.'};
  if(['LOAD','STORE'].includes(op)&&(arg<0||arg>=config.ram)) return {...next,error:'RAM address is outside installed memory.'};
  if(['READ','WRITE'].includes(op)&&(arg<0||arg>=config.disk)) return {...next,error:'Disk address is outside installed storage.'};
  if(op==='JNZ'&&(arg<0||arg>=lines.length)) return {...next,error:'Jump target is outside the program.'};
  switch(op){case'SET':next.accumulator=arg;break;case'ADD':next.accumulator+=arg;break;case'MUL':next.accumulator*=arg;break;case'DEC':next.accumulator--;break;case'LOAD':next.accumulator=next.ram[arg];break;case'STORE':next.ram[arg]=next.accumulator;break;case'READ':next.accumulator=next.disk[arg];break;case'WRITE':next.disk[arg]=next.accumulator;break;case'JNZ':if(next.accumulator!==0)next.pc=arg;break;case'OUT':next.output.push(next.accumulator);break;case'HALT':next.halted=true;}
  if(Math.abs(next.accumulator)>1000000) { next.error='Accumulator overflow. Keep values within ±1,000,000.'; next.accumulator=clamp(next.accumulator,-1000000,1000000); }
  return next;
}
export function machineRun(s:MachineState,program:string,config:MachineConfig) { let next=s; for(let i=0;i<121&&!next.halted&&!next.error;i++) next=machineStep(next,program,config); return next; }
export const machinePrograms = [
  'SET 6\nADD 4\nSTORE 0\nLOAD 0\nOUT\nHALT',
  'SET 7\nMUL 3\nOUT\nHALT',
  'SET 9\nSTORE 3\nLOAD 3\nADD 3\nOUT\nHALT',
  'SET 4\nDEC\nJNZ 1\nOUT\nHALT',
  'SET 25\nWRITE 2\nSET 0\nREAD 2\nOUT\nHALT',
  'SET 8\nMUL 8\nSTORE 5\nLOAD 5\nOUT\nHALT',
  'SET 3\nSTORE 0\nSET 5\nMUL 4\nOUT\nHALT',
  'SET 12\nWRITE 4\nREAD 4\nADD 6\nSTORE 7\nLOAD 7\nOUT\nHALT',
];
export const machineTargets=[10,21,12,0,25,64,20,18];
export const machineTarget=(mission:number,difficulty:number)=>machineTargets[mission]+difficulty*10;
export const workedMachineProgram=(mission:number,difficulty:number)=>difficulty?machinePrograms[mission].replace('OUT',`ADD ${difficulty*10}\nOUT`):machinePrograms[mission];
export interface TrailState { step:number; food:number; water:number; cash:number; energy:number; battery:number; distance:number; trust:number; log:string[]; }
export const trailStart=(difficulty:number):TrailState=>({step:0,food:14-difficulty,water:14-difficulty,cash:60-difficulty*5,energy:90,battery:80,distance:0,trust:0,log:[]});
export function trailTurn(s:TrailState,choice:'transit'|'cycle'|'walk'|'community',mission:number):TrailState {
  const heat=(s.step+mission)%3===1; const rain=(s.step+mission)%4===2;
  const costs={transit:{cash:8,energy:6,distance:26,water:1},cycle:{cash:0,energy:17+(rain?7:0),distance:22,water:heat?3:2},walk:{cash:0,energy:13,distance:15,water:heat?3:2},community:{cash:-8,energy:-13,distance:8,water:-2}}[choice];
  return {...s,step:s.step+1,food:Math.max(0,s.food-(choice==='community'?0:2)),water:clamp(s.water-costs.water,0,30),cash:clamp(s.cash-costs.cash,0,200),energy:clamp(s.energy-costs.energy,0,100),battery:clamp(s.battery-(choice==='community'?-18:9),0,100),distance:s.distance+costs.distance,trust:s.trust+(choice==='community'?1:0),log:[...s.log,choice].slice(-6)};
}
export interface WaterConfig { filter:boolean; treatment:boolean; sealed:boolean; chemical:boolean; leak:number; inflow:number; }
export interface WaterState { day:number; stored:number; cash:number; supplied:number; demand:number; safeDays:number; waste:number; }
export const waterStart=():WaterState=>({day:0,stored:40,cash:80,supplied:0,demand:0,safeDays:0,waste:0});
export function waterTurn(s:WaterState,c:WaterConfig,demand:number):WaterState {
  const usable=c.chemical?0:s.stored+c.inflow;
  const lost=usable*c.leak/100;
  const supplied=Math.min(demand,usable-lost); const stored=clamp(usable-lost-supplied,0,100);
  const safe=!c.chemical&&c.treatment&&c.sealed;
  const cost=(c.filter?2:0)+(c.treatment?4:0)+(c.sealed?1:0)+c.inflow*0.1;
  return {day:s.day+1,stored,cash:round(s.cash-cost),supplied:s.supplied+(safe?supplied:0),demand:s.demand+demand,safeDays:s.safeDays+(safe&&supplied>=demand?1:0),waste:s.waste+lost};
}
export interface KitchenState { temperature:number; minutes:number; stirred:number; burned:boolean; }
export function kitchenHeat(s:KitchenState,heat:number,stir:boolean):KitchenState {
  const rate=0.08+(stir?0.035:0); const temperature=s.temperature+(heat-s.temperature)*rate;
  return {temperature:round(temperature),minutes:s.minutes+1,stirred:s.stirred+(stir?1:0),burned:s.burned||temperature>115};
}
export function streamBudget(bitrate:number,duration:number,fps:number) { return {megabytes:bitrate*duration/8,frameMs:1000/fps}; }
export function mixingPeak(voice:number,music:number) { return 20*Math.log10(10**(voice/20)+10**(music/20)); }
export interface STEMTask { title:string; question:string; equation:string; answer:number; unit:string; explanation:string; }
export function stemTask(id:'math'|'geometry'|'calculus'|'physics',mission:number,d:number):STEMTask {
  const k=2+d; const x=3+mission%3; const a=k+mission%2; const b=4+d;
  if(id==='math') {
    const tasks=[
      ['Solve an equation',`${a}x + ${b} = ${a*x+b}. Find x.`,`${a}x + ${b} = ${a*x+b}`,x,'','Subtract the constant, then divide by the coefficient.'],
      ['Scale a recipe',`A recipe uses ${a} cups for ${b} servings. How many cups for ${b*3} servings?`,'quantity / servings = constant',a*3,'cups','Multiply every ingredient by the same scale factor.'],
      ['Function machine',`Evaluate f(${x}) when f(x) = ${a}x² − ${b}.`,`f(x) = ${a}x² − ${b}`,a*x*x-b,'','Evaluate the exponent before multiplication and subtraction.'],
      ['Intersect two lines',`At what x do y = ${a}x + ${b} and y = ${(a+1)}x − ${x-b} meet?`,'Set both expressions for y equal.',x,'','Equal outputs let you solve one equation for x.'],
      ['Quadratic roots',`Find the positive solution of x² = ${x*x}.`,'x² = target',x,'','A square equation can have two roots. This brief requests the positive one.'],
      ['Compound growth',`Start with ${100*k} units. Grow by 10% twice. What is the final amount?`,'final = start × 1.1²',100*k*1.21,'units','Each period grows the current amount, including previous growth.'],
      ['Two-variable system',`x + y = ${x+b} and x − y = ${x-b}. Find x.`,'Add the equations to eliminate y.',x,'','Adding produces 2x. Divide by two.'],
      ['Model a break-even',`Fixed costs are ${a*20}. Each item earns ${b} after variable costs. How many items cover fixed costs?`,'items = fixed cost / contribution',a*20/b,'items','Separate fixed cost from the contribution each sale provides.'],
    ]; const t=tasks[mission]; return {title:String(t[0]),question:String(t[1]),equation:String(t[2]),answer:Number(t[3]),unit:String(t[4]),explanation:String(t[5])};
  }
  if(id==='geometry') {
    const tasks=[['Rectangle area',a*x,'square units',`width ${a}, length ${x}`,'A = width × length'],['Triangle area',a*x/2,'square units',`base ${a}, perpendicular height ${x}`,'A = ½bh'],['Circle area',Math.PI*a*a,'square units',`radius ${a}`,'A = πr²'],['Box volume',a*x*b,'cubic units',`width ${a}, length ${x}, height ${b}`,'V = wlh'],['Right triangle',Math.sqrt(a*a+x*x),'units',`legs ${a} and ${x}`,'c² = a² + b²'],['Cylinder volume',Math.PI*a*a*x,'cubic units',`radius ${a}, height ${x}`,'V = πr²h'],['Polygon angles',(x+3-2)*180,'degrees',`${x+3} sides; sum of interior angles`,'sum = (n − 2) × 180°'],['Scale a solid',k**3,'times',`every length grows by a factor of ${k}; volume multiplier`,'volume scale = length scale³']]; const t=tasks[mission]; return{title:String(t[0]),question:`Calculate: ${t[3]}. Round to two decimals.`,equation:String(t[4]),answer:Number(t[1]),unit:String(t[2]),explanation:'Match the dimensions to the formula. Length, area, and volume use different units.'};
  }
  if(id==='calculus') {
    const coeff=[b,a,k]; const f=`${k}x² + ${a}x + ${b}`; const tasks=[
      ['Polynomial value',evaluatePolynomial(coeff,x),`Find f(${x}) for f(x) = ${f}.`,'Evaluate each power.'],
      ['A tangent slope',derivative(coeff,x),`Find f′(${x}) for f(x) = ${f}.`,'f′(x) = 2kx + a.'],
      ['An instantaneous speed',2*k*x,`Position s(t) = ${k}t². Find speed at t = ${x} seconds.`,'v(t) = ds/dt = 2kt.'],
      ['Accumulate an area',integral([0,a],0,x),`Integrate ${a}x from 0 to ${x}.`,'Antiderivative: ax²/2. Evaluate at both bounds.'],
      ['A continuous limit',evaluatePolynomial(coeff,x),`Find lim f(t) as t → ${x}, where f(t) = ${f}.`,'Polynomials are continuous. Substitute the limit point.'],
      ['Optimize a curve',a/(2*k),`Where is the maximum of f(x) = −${k}x² + ${a}x + ${b}? Find x.`,'Set f′(x) = −2kx + a = 0. Negative curvature gives a maximum.'],
      ['Signed accumulation',integral([0,a],-x,x),`Integrate ${a}x from −${x} to ${x}.`,'Negative and positive signed areas cancel.'],
      ['A tangent prediction',evaluatePolynomial(coeff,x)+derivative(coeff,x)*0.1,`Use the tangent at x=${x} to estimate f(${round(x+0.1)}) for f(x)=${f}.`,'Linear approximation: f(x+h) ≈ f(x) + f′(x)h.'],
    ];const t=tasks[mission];return{title:String(t[0]),question:String(t[2]),equation:f,answer:Number(t[1]),unit:mission===2?'m/s':'',explanation:String(t[3])};
  }
  const mass=k*2; const speed=x*4; const tasks=[
    ['Projectile range',projectile(speed,45).range,'m',`Launch at ${speed} m/s and 45°. Find range on level ground; g=9.81 m/s².`,`R = v² sin(2θ) / g`],
    ['Force and acceleration',a*10/mass,'m/s²',`Force is ${a*10} N and mass is ${mass} kg. Find acceleration.`,'a = F / m'],
    ['Kinetic energy',0.5*mass*speed*speed,'J',`Mass is ${mass} kg and speed is ${speed} m/s. Find kinetic energy.`,'E = ½mv²'],
    ['A spring stores energy',0.5*(100*k)*0.2**2,'J',`Spring constant ${100*k} N/m; extension 0.2 m. Find stored energy.`,'E = ½kx²'],
    ['Braking distance',speed*speed/(2*a),'m',`Speed ${speed} m/s; constant braking acceleration magnitude ${a} m/s². Find stopping distance.`,'d = v² / (2a)'],
    ['A pendulum period',2*Math.PI*Math.sqrt(k/9.81),'s',`Length ${k} m, small oscillations, g=9.81. Find the period.`,'T = 2π√(L/g)'],
    ['Momentum',mass*speed,'kg·m/s',`Mass ${mass} kg and velocity ${speed} m/s. Find momentum.`,'p = mv'],
    ['Gravitational energy',mass*9.81*x,'J',`Lift ${mass} kg by ${x} m. Find the increase in energy; g=9.81.`,'ΔE = mgh'],
  ];const t=tasks[mission];return{title:String(t[0]),question:String(t[3]),equation:String(t[4]),answer:Number(t[1]),unit:String(t[2]),explanation:'This idealized model states its assumptions. Round the result to two decimals and keep units.'};
}
