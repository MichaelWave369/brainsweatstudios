import assert from 'node:assert/strict';
import { agentModule } from './agent-module.mjs';
const { circuitCommand } = await agentModule('src/circuit/cli.ts');
const { replayCommand } = await agentModule('src/replay/cli.ts');
const started = Date.now(), runs = [];
for (const controller of ['baseline', 'mock']) {
  const save = await circuitCommand('run', ['--controller', controller]);
  assert.equal(save.events.length, 6); assert(save.events.every(e => e.ending === 'COMPLETE' && e.parts.every(p => p.native.result.success)));
  assert.equal(save.events[3].parts[0].shifts.length, 24);
  assert.deepEqual((await circuitCommand('verify', [], JSON.stringify(save))).events, save.events.map(e => e.digest));
  assert(replayCommand(JSON.stringify(save)).verified);
  runs.push({ controller, events: save.events.length, nativeParts: save.events.reduce((n, e) => n + e.parts.length, 0), bytes: Buffer.byteLength(JSON.stringify(save)), finalDigest: save.events.at(-1).digest });
}
const template = await circuitCommand('template', ['--mode', 'GAUNTLET']);
template.teams = template.teams.slice(0, 1); template.agents = template.agents.filter(a => template.teams[0].members.includes(a.id)); template.seasons = [];
const { addCircuitSeason } = await agentModule('src/circuit/operations.ts'), { makeSeason } = await agentModule('src/circuit/specs.ts');
const frozen = addCircuitSeason(template, makeSeason(['comet'], 6, 'GAUNTLET'));
const batch = await circuitCommand('batch', [], JSON.stringify(frozen)); assert.equal(batch.trials.length, 18); assert(replayCommand(JSON.stringify(batch)).verified);
console.log(JSON.stringify({ passed: true, milliseconds: Date.now() - started, runs, frozenTrials: batch.trials.length, batchDigest: batch.digest }, null, 2));
