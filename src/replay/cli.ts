import { parseJSON, plain } from '../runtime/data.ts';
import { verifyWorldReceipt } from '../worlds/receipts.ts';
import { verifyAgentReceipt } from '../agents/receipts.ts';
import { verifyFamilyReceipt } from '../families/receipts.ts';
import { validateCareer, verifyCareerRun } from '../career/validation.ts';
import { validateCircuit } from '../circuit/evidence.ts';
import { validateCircuitBatch } from '../circuit/cli.ts';
export function replayCommand(file:string){const v=parseJSON(file,16000000);if(!plain(v))throw new Error('Provide a native receipt or Locker.');
    if(v.schema==='circuit-save@1'){const s=validateCircuit(v);return {verified:true,events:s.events.map(e=>e.digest)};}
    if(v.schema==='circuit-batch@1'){const b=validateCircuitBatch(v);return {verified:true,digest:b.digest,trials:b.trials.length};}
    if(v.schema==='agent-locker@1'){const s=validateCareer(v);return {verified:true,runs:s.runs.map(r=>r.digest)};}
    if(v.schema==='career-run@1'){const r=verifyCareerRun(v);return {verified:true,digest:r.digest,result:r.receipt.result};}
    if(v.schema==='family-episode@1'){const r=verifyFamilyReceipt(v);return {verified:true,digest:r.digest,result:r.result};}
    if(v.schema==='world-episode@1'){const r=verifyWorldReceipt(v);return {verified:true,worldHash:r.worldHash,finalHash:r.finalHash,result:r.result};}
    const r=verifyAgentReceipt(v);return {verified:true,result:r.result};
}
