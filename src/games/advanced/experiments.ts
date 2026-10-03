import { engineRun, kitchenHeat, projectile, round, streamBudget } from './models';
import { rungFourExperiment } from '../rung4/experiments';
export function experiment(kind:string,value:number):{formula:string;rows:[string,number,string][]}{
 const rung=rungFourExperiment(kind,value);if(rung)return rung;
 switch(kind){
 case'linear':return{formula:'y = 2x + 3',rows:[['Input',value,''],['Output',2*value+3,'']]};
 case'growth':return{formula:'amount = 100 × 1.1ⁿ',rows:[['Periods',value,''],['Amount',round(100*1.1**value),'units']]};
 case'area':return{formula:'square: A = s²; perimeter = 4s',rows:[['Area',value**2,'square units'],['Perimeter',value*4,'units']]};
 case'volume':return{formula:'cube: V = s³; surface = 6s²',rows:[['Volume',value**3,'cubic units'],['Surface area',value**2*6,'square units']]};
 case'derivative':return{formula:'f(x)=x²; f′(x)=2x',rows:[['Function value',value**2,''],['Tangent slope',value*2,''],['Tangent estimate at x+0.1',round(value**2+value*2*0.1),'']]};
 case'integral':return{formula:'∫₀ᵇ x² dx = b³/3',rows:[['Upper bound',value,''],['Signed accumulation',round(value**3/3),'']]};
 case'projectile':{const p=projectile(10,value);return{formula:'R = v² sin(2θ) / g; v=10 m/s, g=9.81 m/s²',rows:[['Range',round(p.range),'m'],['Flight time',round(p.time),'s'],['Maximum height',round(p.height),'m']]};}
 case'energy':return{formula:'mass=2 kg; E=½mv²; p=mv',rows:[['Kinetic energy',value**2,'J'],['Momentum',value*2,'kg·m/s']]};
 case'gear':return{formula:'input: 10 N·m, 3000 RPM; efficiency 0.9',rows:[['Output torque',round(10*value*0.9),'N·m'],['Output speed',round(3000/value),'RPM'],['Output power',round(10*3000*2*Math.PI/60*0.9),'W']]};
 case'cooling':{const r=engineRun({type:'piston',cylinders:4,throttle:70,load:20,gear:3,cooling:value});return{formula:'T = 20 + 70×0.8 + 20×0.4 − cooling×8',rows:[['Modeled temperature',round(r.heat),'°C'],['Output power',round(r.power),'W']]};}
 case'robot-energy':return{formula:'move cost = 1.4 + motor×0.3; motor=2',rows:[['Energy consumed',value*2,'units'],['Battery remaining from 60',Math.max(0,60-value*2),'units']]};
 case'robot-sensor':return{formula:'sense-forward uses an additional sensor×0.15 energy',rows:[['Sensor enabled',value>0?1:0,''],['Extra cost for 10 sensed moves',round(value*0.15*10),'units']]};
 case'memory':return{formula:'addresses start at 0; last address = words−1',rows:[['Installed RAM',value,'words'],['Last valid address',value-1,'']]};
 case'clock':return{formula:'elapsed = cycles / clock; 24 instruction cycles',rows:[['Elapsed time',round(24/value),'ms'],['Instruction cycles',24,'']]};
 case'reserves':return{formula:'six legs: transit=26 km, community=8 km',rows:[['Distance',26*value+8*(6-value),'km'],['Net fare expense',8*value-8*(6-value),'dollars']]};
 case'community':return{formula:'one stop: +2 water, +18 battery, 8 km',rows:[['Water replenished',2*value,'units'],['Battery replenished',Math.min(100,18*value),'points'],['Distance during stops',8*value,'km']]};
 case'water-loss':return{formula:'available=60; remaining=60×(1−leak/100)',rows:[['Water lost',round(60*value/100),'units'],['After loss',round(60*(1-value/100)),'units']]};
 case'safe-storage':return{formula:'five days; unprotected days are excluded from safe supply',rows:[['Protected days',value,''],['Safe-supply share in model',value/5*100,'%']]};
 case'heat':{let s={temperature:20,minutes:0,stirred:0,burned:false};for(let i=0;i<10;i++)s=kitchenHeat(s,value,true);return{formula:'Tnext=T+(heat−T)×0.115; 10 virtual minutes',rows:[['Model temperature',s.temperature,'°C'],['Above 74°C endpoint',s.temperature>=74?1:0,'']]};}
 case'portions':return{formula:'2 cups / 4 portions = 0.5 cup per portion',rows:[['Required ingredient',value/2,'cups'],['Planned portions',value,'']]};
 case'timeline':return{formula:'each segment = 5 seconds',rows:[['Rundown duration',value*5,'s'],['Segments',value,'']]};
 default:{const b=streamBudget(value,25,30);return{formula:'size=bitrate×25/8; frame time=1000/30',rows:[['Estimated video size',round(b.megabytes),'MB'],['Time per frame',round(b.frameMs),'ms']]};}
 }
}
