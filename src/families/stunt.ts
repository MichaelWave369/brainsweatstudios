import { clone, hash } from '../runtime/data.ts';
import type { FamilyConfig, FamilyMachine, PerformancePlan } from './types.ts';
export function stuntMachine(config:FamilyConfig):FamilyMachine {
    let tick=0,act=0,phase='ready',prepared=false,rotation=0,air=0,music=false,camera=false,energy=40,landings=0,violations=0,precision=0,smoothness=0,recovery=0;
    const history:PerformancePlan['sequence']=[],roles=['performer','producer'];const target=()=>1+(config.seed+act)%3;
    return {roles,observe(role){return {fiction:'Toy motion tokens; no real apparatus or driving units.',role,act,phase,prepared,rotation,air,targetRotation:target(),landingWindow:[target(),target()+1],music,camera,energy};},legal(role){return role==='producer'?['wait','music-cue','camera-cue']:phase==='air'?['rotate','pose','land','abort']:phase==='recovery'?['recover','wait']:['prepare','launch','wait'];},advance(intents){tick++;const events:string[]=[],a=intents.performer,wasMusic=music,wasCamera=camera;
        if(intents.producer==='music-cue')music=true;if(intents.producer==='camera-cue')camera=true;
        if(a==='prepare'){prepared=true;energy=Math.min(40,energy+2);}
        if(a==='launch'&&prepared&&wasMusic&&wasCamera&&energy>=3){phase='air';air=0;rotation=0;energy-=3;events.push('Fictional act launched.');}
        else if(phase==='air'){air++;if(a==='rotate'){rotation++;energy=Math.max(0,energy-1);}if(a==='pose')smoothness++;
            if(a==='land'){const safe=rotation===target()&&air>=target()&&air<=target()+1;if(safe){landings++;precision+=100;smoothness+=2;act++;phase='ready';prepared=false;music=false;camera=false;air=0;rotation=0;events.push('Precision landing inside toy envelope.');}else{violations++;phase='recovery';events.push('Toy envelope rejected the landing.');}}
            else if(a==='abort'||air>target()+2||energy===0){phase='recovery';violations++;events.push('Act stopped inside the simulator.');}
        }else if(phase==='recovery'&&a==='recover'){phase='ready';prepared=false;rotation=0;air=0;energy=Math.min(40,energy+5);recovery++;}
        history.push({at:tick,action:a,music:intents.producer==='music-cue'?'original-beat':'quiet',camera:intents.producer==='camera-cue'?'wide':'hold'});
        return events;
    },result(){return {terminal:act>=3,success:act>=3&&violations===0,measures:{precision:landings?precision/landings:0,timing:landings,smoothness,resources:energy,envelopeViolations:violations,recovery,coordination:history.filter(h=>h.music!=='quiet'||h.camera!=='hold').length},public:{act,phase,plan:clone(history)}};},stateHash(){return hash({tick,act,phase,prepared,rotation,air,music,camera,energy,landings,violations,precision,smoothness,recovery,history});},outputs(actor){if(!tick)return [];const content:PerformancePlan={schema:'performance-plan@1',participants:roles,sequence:history.slice(-64),fallbacks:['Abort the virtual act and recover when outside its toy envelope.']};return [{actor,type:'performance-plan',content:clone(content),contentHash:hash(content)}];}};
}
