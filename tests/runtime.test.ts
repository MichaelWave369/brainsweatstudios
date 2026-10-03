import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import golden from './v5-arena-golden.json';
import { AGENT_IDS, arenaStart, workedPolicy, type ArenaKind } from '../src/runtime/arenaRules';
import { authoredController, humanController, qController, replayController, ruleController } from '../src/runtime/controllers';
import { hash, sha256, clone } from '../src/runtime/data';
import { configuration, createEnvironment } from '../src/runtime/environment';
import { runArenaEpisode, stepArenaEpisode } from '../src/runtime/legacy';
import { createDispatchTeam } from '../src/runtime/multiAgent';
import { packageRules, packageRover, importController, validatePackage } from '../src/runtime/packages';
import { inspectTick, recordEpisode, runHeadless, verifyReceipt } from '../src/runtime/receipts';
import { roverFresh } from '../src/training/models';
import { ENVIRONMENTS } from '../src/runtime/types';

describe('common simulation authority', () => {
  it('matches SHA-256 and canonicalizes equivalent object order', () => {
    for (const s of ['', 'abc', 'ñ'.repeat(83), 'a'.repeat(2000)]) expect(sha256(s)).toBe(createHash('sha256').update(s).digest('hex'));
    expect(hash({ b: 2, a: 1 })).toBe(hash({ a: 1, b: 2 })); expect(() => hash({ a: NaN })).toThrow();
  });
  it('preserves all 48 V5 arena golden outcomes', () => {
    for (const c of golden) { const e = runArenaEpisode(arenaStart(c.kind as ArenaKind, c.seed, c.difficulty), workedPolicy(c.kind as ArenaKind)); const { trace: _trace, ...state } = e; void _trace;
      expect(createHash('sha256').update(JSON.stringify(state)).digest('hex'), JSON.stringify(c)).toBe(c.hash);
    }
  });
  it.each(ENVIRONMENTS)('%s resets, snapshots and restores; controllers cannot mutate the authoritative state', id => {
    const env = createEnvironment(configuration(id, 7)), original = env.stateHash(), observation = env.observe();
    expect(() => { observation.state.x = 100; }).toThrow(); const snap = env.snapshot(); snap.state.x = 100;
    expect(env.stateHash()).toBe(original); const checkpoint = env.snapshot(); env.step('east'); expect(env.stateHash()).not.toBe(original);
    env.restore(checkpoint); expect(env.stateHash()).toBe(original); env.step('west'); env.reset(); expect(env.stateHash()).toBe(original);
    expect(() => env.step({ action: 'east' })).toThrow(); expect(() => env.step('teleport')).toThrow(); expect(env.stateHash()).toBe(original);
    expect(() => env.restore({ ...checkpoint, state: { ...checkpoint.state, x: Infinity } })).toThrow();
    expect(() => env.restore({ ...checkpoint, config: { ...checkpoint.config, seed: 8 } })).toThrow();
  });
  it.each(AGENT_IDS)('%s authored/rule/replay controllers share the same rules and terminal state', kind => {
    const config = configuration(kind, 42, 2), a = recordEpisode(config, authoredController(kind)), b = recordEpisode(config, ruleController(workedPolicy(kind)));
    expect(a.finalHash).toBe(b.finalHash); expect(a.result.success).toBe(true);
    const replay = recordEpisode(config, replayController(a.steps.map(r => r.decision.action))); expect(replay.finalHash).toBe(a.finalHash);
    expect(recordEpisode(config, authoredController(kind))).toEqual(a); expect(verifyReceipt(JSON.parse(JSON.stringify(a)))).toEqual(a);
    const oldHash = a.digest; expect(inspectTick(a, 0).tick).toBe(0); expect(inspectTick(a, a.steps.length).tick).toBe(a.result.ticks); expect(a.digest).toBe(oldHash);
  });
  it('rejects altered observations/actions/events/hashes/results even after an attacker recomputes the digest', () => {
    const base = recordEpisode(configuration('sports', 1), authoredController('sports'));
    const corruptions = [(r: typeof base) => { r.steps[0].observation.state.x = 8; }, (r: typeof base) => { r.steps[0].decision.action = 'rest'; }, (r: typeof base) => { r.steps[0].transition.events = []; }, (r: typeof base) => { r.steps[0].stateHash = '0'.repeat(64); }, (r: typeof base) => { r.result.score = 0; }];
    for (const corrupt of corruptions) { const receipt = clone(base); corrupt(receipt); const { digest: _d, ...payload } = receipt; void _d; receipt.digest = hash(payload); expect(() => verifyReceipt(receipt)).toThrow(); }
    expect(() => verifyReceipt({ ...base, runtime: '99.0.0' })).toThrow(); expect(() => verifyReceipt({ ...base, extra: true })).toThrow();
    expect(() => verifyReceipt({ ...base, steps: Array(121).fill(base.steps[0]) })).toThrow();
  });
  it('distinguishes rover intents from deterministic wind and verifies frozen Q evaluation', () => {
    const q = roverFresh('storm').q, original = hash(q), config = configuration('rover', 20001, 0, 'standard', 'storm');
    const receipt = recordEpisode(config, qController(q)); expect(receipt.steps.some(r => r.transition.executedAction !== r.decision.action)).toBe(true);
    expect(verifyReceipt(receipt).digest).toBe(receipt.digest); expect(hash(q)).toBe(original); expect(runHeadless(config, qController(q)).finalHash).toBe(receipt.finalHash);
    const terminal = createEnvironment(config); receipt.steps.forEach(r => terminal.step(r.decision.action)); const end = terminal.stateHash(); expect(terminal.availableActions().every(a => !a.enabled)).toBe(true); expect(() => terminal.step('north')).toThrow(); expect(terminal.stateHash()).toBe(end);
  });
  it('human input and the existing checkpoint adapter use the same validation boundary', () => {
    const env = createEnvironment(configuration('sports')), human = humanController(); expect(() => human.chooseAction(env.observe(), env.availableActions())).toThrow();
    human.propose('east'); env.step(human.chooseAction(env.observe(), env.availableActions()).action);
    expect(env.snapshot().state.x).toBe(stepArenaEpisode(arenaStart('sports', 0), 'east').x);
  });
  it('strict packages roundtrip legacy rules and rover values; incompatible or executable imports fail', () => {
    const pkg = packageRules('sports', workedPolicy('sports')); expect(validatePackage(JSON.parse(JSON.stringify(pkg)), 'sports')).toEqual(pkg);
    expect(importController({ version: 1, kind: 'sports', rules: workedPolicy('sports') }, 'sports')).toEqual(pkg);
    expect(() => validatePackage(pkg, 'space')).toThrow(); expect(() => validatePackage({ ...pkg, script: 'alert(1)' })).toThrow();
    expect(() => validatePackage({ ...pkg, compatible: [{ environment: 'sports', version: '9' }] })).toThrow();
    expect(() => validatePackage({ ...pkg, parameters: { rules: [{ when: 'always', action: 'teleport' }] } })).toThrow();
    const rover = packageRover(roverFresh().q, 'courier', 0); expect(validatePackage(rover)).toEqual(rover); const bad = clone(rover); if ('q' in bad.parameters) bad.parameters.q[0][0] = Infinity; expect(() => validatePackage(bad)).toThrow();
  });
  it('separates per-agent observations/actions and enforces shared ordered turns', () => {
    const a = createDispatchTeam(['agent-a', 'agent-b']), b = createDispatchTeam(['agent-a', 'agent-b']);
    expect(a.availableActions('agent-b')).toEqual([]); const initial = a.snapshot(); expect(() => a.step('agent-b', 'observe')).toThrow(); expect(a.snapshot()).toEqual(initial);
    for (let i = 0; i < 9; i++) { const actor = i % 2 ? 'agent-b' : 'agent-a', action = ['observe', 'protect', 'dispatch'][i % 3]; expect(a.step(actor, action)).toEqual(b.step(actor, action)); }
    expect(a.isTerminal()).toBe(true); expect(a.snapshot().task).toBe(3);
  });
});
