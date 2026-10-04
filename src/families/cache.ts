import { clone, hash } from '../runtime/data.ts';
import type { CacheRoute, FamilyConfig, FamilyMachine } from './types.ts';
export function cacheMachine(config:FamilyConfig):FamilyMachine {
    const size=4,cache={x:1+config.seed%3,y:1+Math.floor(config.seed/3)%3},grid=Array.from({length:16},(_,i)=>({x:i%size,y:Math.floor(i/size),terrain:(i*7+config.seed)%3,landmark:`marker-${i}`}));
    let tick=0,x=0,y=0,energy=40,clue=false,inspected=false,solved=false,found=false,returned=false,shared=false,signals=0,fumbles=0;const visited=[{x,y}],seen=new Set([0]);
    const left=1+config.seed%5,right=2+config.seed%4,choices=[left+right-1,left+right,left+right+1];const mapHash=hash(grid);
    return {roles:['explorer','navigator'],observe(role){return {units:'virtual cells; no geographic coordinates',position:role==='explorer'?{x,y}:shared?{x,y}:null,energy,weather:config.seed%2?'clear':'virtual-rain',camp:{x:0,y:0},size,clue:(role==='explorer'&&clue||shared)?{landmark:`marker-${cache.y*size+cache.x}`,virtualCell:cache}:null,puzzle:role==='explorer'&&inspected?{left,right,choices}:null,solved:role==='explorer'?solved:null,found,returned,visible:role==='explorer'||shared?grid.filter((_,i)=>seen.has(i)):[],routeHints:[]};},legal(role){if(role==='navigator')return ['wait','share-route'];return ['wait','rest','inspect',...(x>0?['west']:[]),...(x<size-1?['east']:[]),...(y>0?['north']:[]),...(y<size-1?['south']:[]),...(inspected&&!solved?['solve-0','solve-1','solve-2']:[]),...(solved&&!found&&x===cache.x&&y===cache.y?['collect']:[])];},advance(intents){tick++;const events:string[]=[],a=intents.explorer;
        if(intents.navigator==='share-route'){signals++;events.push('Navigator sent a bounded route signal.');}
        if(a==='inspect'){seen.add(y*size+x);if(x===0&&y===0)clue=true;if(x===cache.x&&y===cache.y)inspected=true;shared=clue;events.push('A visible landmark was inspected.');}
        if(['north','south','east','west'].includes(a)&&energy>0){if(a==='north')y--;if(a==='south')y++;if(a==='east')x++;if(a==='west')x--;energy=Math.max(0,energy-1-grid[y*size+x].terrain-(config.seed%2===0?1:0));seen.add(y*size+x);visited.push({x,y});}
        if(a==='rest')energy=Math.min(40,energy+(x===0&&y===0?8:3));
        if(a.startsWith('solve-')){solved=choices[Number(a.at(-1))]===left+right;if(!solved)fumbles++;events.push(solved?'Public arithmetic clue solved.':'Puzzle proposal rejected.');}
        if(a==='collect'&&solved){found=true;events.push('Virtual discovery recorded.');}
        if(found&&x===0&&y===0){returned=true;events.push('Discovery returned to camp.');}
        return events;
    },result(){return {terminal:returned,success:returned,measures:{discoveries:Number(found),returned:Number(returned),energy,information:seen.size,coordination:signals,puzzleErrors:fumbles},public:{position:{x,y},visible:grid.filter((_,i)=>seen.has(i)),visited:clone(visited),found,returned,mapHash}};},stateHash(){return hash({grid,cache,tick,x,y,energy,clue,inspected,solved,found,returned,shared,signals,fumbles,visited,seen:[...seen].sort((a,b)=>a-b)});},outputs(actor){if(!tick)return [];const content:CacheRoute={schema:'cache-route@1',mapHash,visited,discoveries:Number(found),returned};return [{actor,type:'cache-route',content:clone(content),contentHash:hash(content)}];}};
}
