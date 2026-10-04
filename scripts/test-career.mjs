import assert from 'node:assert/strict';
import { agentModule } from './agent-module.mjs';
const {careerCommand}=await agentModule('src/career/cli.ts');
let save=null;const summary=[];
for(const world of ['reserve-lesson','survey','community','signal-maze','town-zero']) {
  const start=performance.now();save=await careerCommand('run',[world],save?JSON.stringify(save):null);
  const run=save.runs.at(-1);assert.equal(run.agentId,'studio-agent');assert.equal(run.receipt.result.terminal,true);
  const replay=await careerCommand('verify',[],JSON.stringify(save));assert.equal(replay.length,save.runs.length);
  summary.push({world,identity:run.agentId,family:run.family,ticks:run.receipt.result.tick??run.receipt.result.ticks,success:run.receipt.result.success,replayed:true,milliseconds:Math.round(performance.now()-start)});
}
console.log(JSON.stringify({schema:'career-sweep@1',provider:'public-baseline',summary,claim:'Descriptive simulation evidence; no installed model or universal ability claim.'},null,2));
