import { circuit, rounded, stoppingDistance } from './models';
type Experiment={formula:string;rows:[string,number,string][]};
export function rungFourExperiment(kind:string,v:number):Experiment|null {
  const result=(formula:string,rows:Experiment['rows']):Experiment=>({formula,rows});
  switch(kind){
    case 'road-stop':{const s=stoppingDistance(v,1.5,false);return result('v = mph × 0.44704; distance = 1.5v + v²/10',[['Reaction distance',rounded(s.reaction),'m'],['Braking distance',rounded(s.braking),'m'],['Total stopping distance',rounded(s.total),'m']]);}
    case 'road-reaction':{const s=stoppingDistance(30,v/10,false);return result('30 mph = 13.4112 m/s; reaction travel = speed × time',[['Reaction time',v/10,'s'],['Reaction distance',rounded(s.reaction),'m'],['Total stopping distance',rounded(s.total),'m']]);}
    case 'cargo':return result('rear = 12; total = front + rear; imbalance = |front − rear|',[['Total cargo',v+12,'model units'],['Cargo imbalance',Math.abs(v-12),'model units']]);
    case 'training-plan':return result('four classroom planning items, not credential requirements',[['Items reviewed',v,''],['Items left',4-v,'']]);
    case 'kerf':return result('height = 80 mm; used = 2w + 2h + 4×2',[['Piece material',2*v+160,'mm'],['Kerf material',8,'mm'],['Total stock used',2*v+168,'mm']]);
    case 'tolerance':return result('target = 120 mm; tolerance = ±1 mm',[['Absolute error',Math.abs(v-120),'mm'],['Within tolerance',Math.abs(v-120)<=1?1:0,'yes = 1']]);
    case 'line-stages':return result('each branch needs seven model milestones',[['Required records',7*v,''],['Damaged branches',v,'']]);
    case 'clearance':return result('seven model milestones; restoration is the last',[['Milestones left',7-v,''],['Sequence complete',v===7?1:0,'yes = 1']]);
    case 'ohm':return result('virtual supply = 12 V; I = V/R; P = VI',[['Current',rounded(12/v),'A'],['Electrical power',rounded(144/v),'W']]);
    case 'arrangement':{const c={voltage:12,r1:v,r2:v,fuse:2};return result('series R = 2r; parallel R = r/2',[['Series current',rounded(circuit({...c,mode:'series'}).current),'A'],['Parallel current',rounded(circuit({...c,mode:'parallel'}).current),'A']]);}
    case 'exit-plan':return result('two candidate routes per room in the planning sketch',[['Routes to review',2*v,''],['Rooms in sketch',v,'']]);
    case 'fire-layers':return result('four preparation items; completion does not guarantee safety',[['Items reviewed',v,''],['Items left',4-v,'']]);
    case 'water-layers':return result('four outing checks; these are not risk probabilities',[['Checks reviewed',v,''],['Checks left',4-v,'']]);
    case 'shore-stages':return result('three decisions in the shore scenario',[['Decisions completed',v,''],['Decisions left',3-v,'']]);
    case 'sport-energy':return result('energy = 35 − actions; rest restores 12 to a maximum of 35',[['Before rest',35-v,'units'],['After one rest',Math.min(35,47-v),'units']]);
    case 'policy-priority':return result('first match selects the action; always matches every tick',[['Rules reachable before always',v-1,''],['Later rules hidden',3-v,'']]);
    case 'agent-water':return result('Explorer consumption = 0.18 water units per tick',[['Water consumed',rounded(v*0.18),'model units'],['Water remaining',rounded(12-v*0.18),'model units']]);
    case 'return-route':return result('return = 12 ticks; recovery = 3 ticks',[['Movement ticks',v+12,''],['With recovery',v+15,'']]);
    case 'scenario-stages':return result('three interactions per site, excluding travel',[['Required interactions',v*3,''],['Task sites',v,'']]);
    case 'trace-limit':return result('episode tick bound = 120',[['Ticks remaining',120-v,''],['Ticks elapsed',v,'']]);
    case 'space-brake':return result('continuous ideal: a = 0.3; t = v/a; d = v²/(2a)',[['Stopping time',rounded(v/10/0.3),'ticks'],['Stopping distance',rounded((v/10)**2/0.6),'model units']]);
    case 'space-energy':return result('Explorer: 100 energy − 1 per powered tick',[['Energy consumed',v,'units'],['Energy left',100-v,'units']]);
    default:return null;
  }
}
