import { describe, expect, it } from 'vitest';
import { AGENT_IDS, workedPolicy } from '../src/runtime/arenaRules';
import { CURRICULUM, episodeConfig, seedGroups } from '../src/runtime/curriculum';
import { createEnvironment } from '../src/runtime/environment';
import { clone, hash } from '../src/runtime/data';
import { createExperiment, runExperiment, validateExperiment, verifyExperiment } from '../src/runtime/experiments';
import { packageRules, packageRover } from '../src/runtime/packages';
import { verifyReceipt } from '../src/runtime/receipts';
import { roverFresh } from '../src/training/models';

describe('reproducible local experiments', () => {
  it('keeps all three seed groups disjoint across the entire supported seed range', () => {
    for (let i = 0; i <= 99; i++) { const g = seedGroups(i), all = [...g.TRAIN, ...g.VALIDATION, ...g.HOLDOUT]; expect(new Set(all).size).toBe(24); expect(g.TRAIN.every(n => n < 20000)).toBe(true); expect(g.HOLDOUT.every(n => n >= 20000 && n < 40000)).toBe(true); expect(g.VALIDATION.every(n => n >= 40000)).toBe(true); }
    expect(() => seedGroups(100)).toThrow();
  });
  it.each(AGENT_IDS)('%s freezes the policy through validation/holdout/transfer and records meaningful variant changes', kind => {
    const pkg = packageRules(kind, workedPolicy(kind)), before = hash(pkg), spec = createExperiment(kind, pkg, 'builder');
    const a = runExperiment(spec), b = verifyExperiment(a.manifest);
    expect(b.manifest).toEqual(a.manifest); expect(hash(pkg)).toBe(before); expect(a.manifest.result!.groups[2].successes).toBe(8);
    expect(a.manifest.result!.groups.map(g => [g.split, g.transfer])).toEqual([['TRAIN', false], ['VALIDATION', false], ['HOLDOUT', false], ['HOLDOUT', true]]);
    const normal = createEnvironment(episodeConfig(kind, 20000, 'builder', 'courier')), transfer = createEnvironment(episodeConfig(kind, 20000, 'builder', 'courier', true));
    expect(transfer.observe()).not.toEqual(normal.observe()); expect(a.receipts.every(r => verifyReceipt(r).digest === r.digest)).toBe(true);
  });
  it('search uses only TRAIN seeds and reproduces its selected controller and all trace hashes', () => {
    const initial = packageRules('sports', [{ when: 'always', action: 'approach' }]), spec = createExperiment('sports', initial, 'builder', 3, 'rule-search', 3), a = runExperiment(spec), b = verifyExperiment(a.manifest);
    expect(a.champion).toEqual(b.champion); expect(a.manifest.traceHashes).toEqual(b.manifest.traceHashes); expect(a.manifest.result!.groups[2].successes).toBe(8); expect(initial.controller.hash).not.toBe(a.champion.controller.hash);
  });
  it('Q-learning has bounded TRAIN updates; all evaluation and transfer runs leave its values unchanged', () => {
    const initial = packageRover(roverFresh('storm').q, 'storm', 0), before = hash(initial), a = runExperiment(createExperiment('rover', initial, 'explorer', 1, 'q-learning', 100));
    expect(hash(initial)).toBe(before); expect('q' in a.champion.parameters && a.champion.parameters.trainingEpisodes).toBe(100); expect(a.manifest.result!.controllerHash).toBe(a.champion.controller.hash); expect(verifyExperiment(a.manifest).manifest).toEqual(a.manifest);
    const normal = createEnvironment(episodeConfig('rover', 20000, 'builder', 'storm')), transfer = createEnvironment(episodeConfig('rover', 20000, 'builder', 'storm', true)); expect(normal.observe().map).not.toEqual(transfer.observe().map); expect(normal.observe().target).not.toEqual(transfer.observe().target);
  });
  it('curricula reuse difficulty modes and deterministically add constraints', () => {
    expect(CURRICULUM.slice(0, 3).map(s => s.difficulty)).toEqual([0, 1, 2]);
    const arena = createEnvironment(episodeConfig('sports', 1, 'reserves', 'courier')), view = arena.observe().state; expect('energy' in view && view.energy).toBe(24);
    const rover = createEnvironment(episodeConfig('rover', 1, 'reserves', 'courier')); for (let i = 0; i < 64; i++) rover.step('south'); expect(rover.isTerminal()).toBe(true); expect(rover.result().ticks).toBe(64);
  });
  it('rejects malformed manifests, split overlap, incompatible versions and tampered results before accepting imports', () => {
    const spec = createExperiment('sports', packageRules('sports', workedPolicy('sports')));
    const mutations = [{ ...spec, extra: true }, { ...spec, environmentVersion: '2' }, { ...spec, parameters: { ...spec.parameters, episodes: 10000000 } }, { ...spec, method: 'q-learning' }, { ...spec, seeds: { ...spec.seeds, HOLDOUT: spec.seeds.TRAIN } }, { ...spec, curriculum: 'fake' }];
    mutations.forEach(m => expect(() => validateExperiment(m)).toThrow());
    const complete = clone(runExperiment(spec).manifest); complete.result!.groups[2].score = 0; const { digest: _d, ...payload } = complete; void _d; complete.digest = hash(payload); expect(() => verifyExperiment(complete)).toThrow();
  });
});
