import { clone, hash } from '../runtime/data.ts';
import type { FamilyConfig, FamilyMachine, FamilyOutput, TrackNotes } from './types.ts';
export function raceMachine(config:FamilyConfig):FamilyMachine {
    const race=config.race!,track=race.track,length=track.segments.reduce((a,s)=>a+s.length,0),circuit=config.schema==='family-config@3';
    const cars=race.vehicles.map(v=>({id:v.id,position:0,speed:0,energy:v.capacity,grip:100,temperature:0,damage:0,lane:0,pit:0,pits:0,incidents:0,recoveries:0,finished:false,finishTick:0,lapTicks:[] as number[],sectorTicks:[] as {sector:number;ticks:number}[],lastLapTick:0,lastSectorTick:0,spent:0,...(circuit?{gridSlot:race.grid!.indexOf(v.id),coordination:0}:{})}));
    const roles=cars.flatMap((_,i)=>circuit?[`driver-${i}`,`crew-${i}`,`strategist-${i}`,`pit-${i}`]:[`driver-${i}`,`crew-${i}`]);let tick=0,yellow=0;
    const pitOpen=()=>!circuit||tick>=race.pitWindow![0]&&tick<=race.pitWindow![1];
    function segment(position:number){let within=position%length;let index=0;while(index<track.segments.length-1&&within>=track.segments[index].length){within-=track.segments[index].length;index++;}return {index,...track.segments[index]};}
    const limit=(i:number)=>{const s=segment(cars[i].position),v=race.vehicles[i];return yellow?24:Math.max(20,Math.min(85,66-s.curvature*7+v.grip*2+v.setup.wing-3-Math.floor((100-cars[i].grip)/15)-(track.weather==='rain'?12:0)-s.risk*3));};
    const index=(role:string)=>Number(role.split('-')[1]);
    return {roles,observe(role){const i=index(role),c=cars[i];return {units:'fictional normalized units',vehicle:race.vehicles[i],trackHash:hash(track),segment:segment(c.position),safeSpeed:limit(i),weather:track.weather,yellow,laps:race.laps,telemetry:clone(c),traffic:cars.map(n=>({id:n.id,position:n.position,lane:n.lane,finished:n.finished})),...(circuit?{authority:'race-authority@3',grid:race.grid,pitWindow:race.pitWindow,pitWindowOpen:pitOpen()}: {})};},legal(role){const c=cars[index(role)];if(c.finished||circuit&&tick<(c.gridSlot??0))return ['wait'];if(circuit&&role.startsWith('pit'))return c.pit?['wait','refuel','replace-grip','cool']:['wait'];if(circuit&&role.startsWith('strategist'))return ['wait','strategy-conserve'];if(circuit&&role.startsWith('crew'))return c.pit?['wait','call-service']:['wait','strategy-conserve'];return role.startsWith('crew')?(c.pit?['wait','refuel','replace-grip','cool']:['wait','strategy-conserve']):c.pit?['wait']:['accelerate','coast','brake','turn-left','turn-right','hold-line','conserve','attack','recover',...(segment(c.position).pit&&pitOpen()?['pit']:[])];},advance(intents){
        const events:string[]=[],before=clone(cars),safeLimits=cars.map((_,i)=>limit(i));tick++;let nextYellow=Math.max(0,yellow-1);
        for(let i=0;i<cars.length;i++) {const c=cars[i],v=race.vehicles[i],old=before[i],a=intents[`driver-${i}`],crew=intents[`crew-${i}`],s=segment(old.position);if(old.finished)continue;
            if(circuit&&tick<=(c.gridSlot??0)){events.push(`${c.id}: qualifying grid delay`);continue;}
            const service=circuit?intents[`pit-${i}`]:crew,strategy=circuit?intents[`strategist-${i}`]:crew;
            if(circuit&&(crew==='call-service'||strategy==='strategy-conserve'||old.pit&&service!=='wait')){c.coordination=(c.coordination??0)+1;events.push(`${c.id}: structured crew handoff`);}
            if(old.pit){if(service==='refuel'){c.energy=v.capacity;events.push(`${c.id}: refuel`);}if(service==='replace-grip')c.grip=100;if(service==='cool')c.temperature=Math.max(0,c.temperature-40);c.pit--;c.speed=0;continue;}
            if(a==='pit'){c.pit=4;c.pits++;c.speed=0;events.push(`${c.id}: pit entry`);continue;}
            let speed=old.speed;
            if(a==='accelerate')speed+=v.power+6+v.setup.gearing;if(a==='attack')speed+=v.power+13+v.setup.gearing;if(a==='brake')speed-=v.braking+15;if(a==='coast'||a==='conserve'||crew==='strategy-conserve'||circuit&&strategy==='strategy-conserve')speed-=4;
            if(a==='turn-left')c.lane=Math.max(-1,c.lane-1);if(a==='turn-right')c.lane=Math.min(1,c.lane+1);
            if(a==='recover'&&old.damage){c.damage=Math.max(0,c.damage-12);c.recoveries++;speed=16;}
            const safe=safeLimits[i],risk=Math.max(0,speed-safe)+(a==='attack'?s.curvature*4:0);
            if(risk>14){c.incidents++;c.damage+=Math.ceil(risk/(3+v.reliability/2));c.grip=Math.max(0,c.grip-10);speed=Math.max(8,safe-15);nextYellow=2;events.push(`${c.id}: simulated envelope incident`);}
            c.temperature=Math.max(0,old.temperature+Math.ceil(speed/10)-v.cooling);if(c.temperature>70){speed-=10;c.damage+=2;}
            const cost=Math.max(1,Math.ceil((Math.max(0,speed)+v.setup.gearing-3)/16)-(v.aero>=8?1:0));c.energy=Math.max(0,c.energy-cost);c.spent+=Math.min(old.energy,cost);c.grip=Math.max(0,c.grip-(s.surface==='rough'?2:1));
            if(c.energy===0)speed=4;speed=Math.max(4,Math.min(90,speed,Math.max(10,90-c.damage)));c.speed=speed;
            c.position=Math.min(length*race.laps,old.position+Math.max(4,Math.floor(speed*(8-v.mass/10)/10)-Math.abs(s.elevation)));
            const oldSector=segment(old.position).sector,newSector=segment(c.position).sector,lap=Math.floor(c.position/length),oldLap=Math.floor(old.position/length);
            if(oldSector!==newSector||lap>oldLap){c.sectorTicks.push({sector:oldSector,ticks:tick-c.lastSectorTick});c.lastSectorTick=tick;}
            if(lap>oldLap){c.lapTicks.push(tick-c.lastLapTick);c.lastLapTick=tick;events.push(`${c.id}: lap ${lap}`);}
            if(c.position>=length*race.laps){c.finished=true;c.finishTick=tick;c.speed=0;}
        }
        // Collision pairs use the same pre-turn traffic snapshot. Provider order
        // never changes which pair receives the symmetric incident.
        for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){if(!before[i].finished&&!before[j].finished&&!before[i].pit&&!before[j].pit&&before[i].lane===before[j].lane&&Math.abs(before[i].position-before[j].position)<18&&(intents[`driver-${i}`]==='attack'||intents[`driver-${j}`]==='attack')){for(const k of [i,j]){cars[k].damage+=Math.max(1,10-race.vehicles[k].reliability);cars[k].incidents++;}nextYellow=2;events.push('Traffic pair: symmetric incident');}}
        yellow=nextYellow;return events;
    },result(){const finished=cars.filter(c=>c.finished).length;return {terminal:finished===cars.length,success:finished===cars.length,measures:{finishRate:finished/cars.length,incidents:cars.reduce((s,c)=>s+c.incidents,0),recovery:cars.reduce((s,c)=>s+c.recoveries,0),pits:cars.reduce((s,c)=>s+c.pits,0),energyUsed:cars.reduce((s,c)=>s+c.spent,0),lapVariation:cars.reduce((s,c)=>s+(c.lapTicks.length>1?Math.max(...c.lapTicks)-Math.min(...c.lapTicks):0),0)},public:{track:clone(track),cars:clone(cars),standings:[...cars].sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.finishTick-b.finishTick:b.position-a.position)||a.id.localeCompare(b.id)).map(c=>c.id)}};},stateHash(){return hash({tick,cars,yellow});},outputs(actor){if(!tick)return [];const i=index(actor),c=cars[i],content:TrackNotes={schema:'track-notes@1',trackHash:hash(track),sectors:c.sectorTicks,incidents:c.incidents,pits:c.pits};const outputs:FamilyOutput[]=[{actor,type:'track-notes',content:clone(content),contentHash:hash(content)}];if(actor.startsWith('driver'))outputs.push({actor,type:'vehicle-setup',content:clone(race.vehicles[i]),contentHash:hash(race.vehicles[i])});return outputs;}};
}
