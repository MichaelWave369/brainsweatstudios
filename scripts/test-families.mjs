import assert from 'node:assert/strict';
import { agentModule } from './agent-module.mjs';
const {familyCommand}=await agentModule('src/families/cli.ts');
const summary=[];let save=null;
for(const family of ['auto-circuit','stunt-show','cache-quest','web-scout','stream-studio','ensemble-lab']){
    const start=performance.now();save=await familyCommand('run',[family,'--controller',summary.length%2?'mock':'baseline'],save?JSON.stringify(save):null);const run=save.runs.at(-1);assert.equal(run.agentId,'studio-agent');assert.equal(run.receipt.result.success,true);
    const replay=await familyCommand('verify',[],JSON.stringify(run.receipt));assert.equal(replay.verified,true);summary.push({family,agent:run.agentId,controller:run.controller.family,ticks:run.receipt.result.ticks,measures:run.receipt.result.measures,replayed:true,milliseconds:Math.round(performance.now()-start)});
}
console.log(JSON.stringify({schema:'family-sweep@1',summary,claim:'Mechanical simulation evidence across distinct families; no universal intelligence ranking.'},null,2));
