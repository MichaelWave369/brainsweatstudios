import { parseJSON, plain } from '../runtime/data.ts';
import { verifyWorldReceipt } from '../worlds/receipts.ts';
import { verifyAgentReceipt } from '../agents/receipts.ts';
import { verifyFamilyReceipt } from '../families/receipts.ts';
import { validateCareer, verifyCareerRun } from '../career/validation.ts';
export function replayCommand(file:string){const v=parseJSON(file,8000000);if(!plain(v))throw new Error('Provide a native receipt or Locker.');
    if(v.schema==='agent-locker@1'){const s=validateCareer(v);return {verified:true,runs:s.runs.map(r=>r.digest)};}
    if(v.schema==='career-run@1'){const r=verifyCareerRun(v);return {verified:true,digest:r.digest,result:r.receipt.result};}
    if(v.schema==='family-episode@1'){const r=verifyFamilyReceipt(v);return {verified:true,digest:r.digest,result:r.result};}
    if(v.schema==='world-episode@1'){const r=verifyWorldReceipt(v);return {verified:true,worldHash:r.worldHash,finalHash:r.finalHash,result:r.result};}
    const r=verifyAgentReceipt(v);return {verified:true,result:r.result};
}
