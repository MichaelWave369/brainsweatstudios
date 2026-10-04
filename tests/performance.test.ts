import { describe, expect, it } from 'vitest';
import legacyReceipts from './fixtures/v10-family-receipts.json';
import { mockAdapter } from '../src/agents/mock';
import { familyConfig, validateFamilyConfig } from '../src/families/specs';
import { FamilySession } from '../src/families/session';
import { familyRequest, verifyFamilyReceipt } from '../src/families/receipts';
import { validateWorldRequest } from '../src/agents/worldContracts';
import { createFamilyEnvironment } from '../src/families/runtime';
import { clone, hash } from '../src/runtime/data';
import { baselineController } from '../src/worlds/receipts';
import { composeScore, defaultRenderSettings, performanceConfig, scoreFromReceipt, validateBundle, validatePerformanceScore, validateVoice, voicesForScore } from '../src/performance/specs';
import { PERFORMANCE_MODES, type PerformanceBundle } from '../src/performance/types';
import { renderPerformance, verifyAudioReceipt } from '../src/performance/render';
import { preparePerformance } from '../src/performance/bus';
import { addAgent, enableCircuitWorlds, evaluationInput, rememberRun, retainFamilyOutputs } from '../src/career/operations';
import { freshCareer, validateCareer } from '../src/career/validation';
import { createCareerSession } from '../src/career/session';

async function finish(s: FamilySession) { while (!s.env.result().terminal) expect(await s.step(), s.error).toBe(true); return s.receipt(); }
async function bundle(): Promise<PerformanceBundle> {
  const performance = await finish(new FamilySession(performanceConfig(composeScore('choir', 17))));
  return validateBundle({ schema: 'performance-bundle@1', performance, voices: voicesForScore(scoreFromReceipt(performance)), settings: defaultRenderSettings() });
}
describe('versioned synthetic performance', () => {
  for (const mode of PERFORMANCE_MODES) for (const kind of ['baseline', 'mock'] as const) it(`${mode} performs original parts through ${kind} and verifies logical notes`, async () => {
    const score = composeScore(mode, 17, 2, 120, 3), config = performanceConfig(score), env = createFamilyEnvironment(config);
    const c = { ...baselineController('performance-controller'), ...(kind === 'mock' ? { family: 'model' as const, provider: 'mock' as const, model: 'mock-policy' } : {}) };
    const receipt = await finish(new FamilySession(config, Object.fromEntries(env.roles.map(role => [role, c]))));
    expect(receipt.result.success).toBe(true); expect(receipt.result.measures.pitchAccuracy).toBe(1);
    expect(verifyFamilyReceipt(clone(receipt)).digest).toBe(receipt.digest);
    const events = receipt.result.public.events as { kind: string; timeMs: number; beat: number; velocity: number }[];
    expect(events.filter(e => e.kind === 'note')).toHaveLength(score.parts.reduce((n, p) => n + p.notes.length, 0));
    expect(events.filter(e => e.kind === 'note' && e.beat >= 12).every(e => e.velocity === 64)).toBe(true);
    expect(events.every(e => e.timeMs === e.beat * 500)).toBe(true);
  });
  it('retains immutable V10 receipt replay and output digests across the new authority', async () => {
    for (const original of legacyReceipts) {
      expect(verifyFamilyReceipt(clone(original)).digest).toBe(original.digest);
      const again = await finish(new FamilySession(original.config));
      expect(again.digest).toBe(original.digest);
    }
  });
  it('legacy shared voice ids retain one profile with the full declared range', async () => {
    const config = clone(familyConfig('ensemble-lab')); const score = config.score!;
    score.parts[0].voice = { ...score.parts[5].voice!, range: [36, 84] }; score.parts[0].instrument.kind = 'voice';
    const performance = await finish(new FamilySession(config));
    const b = validateBundle({ schema: 'performance-bundle@1', performance, voices: voicesForScore(score), settings: defaultRenderSettings() });
    expect(b.voices).toHaveLength(1); expect(b.voices[0].range).toEqual([36, 84]);
  });
  it('model observation version two is limited to the registered V11 authorities', () => {
    const env = createFamilyEnvironment(performanceConfig(composeScore('band'))), c = { ...baselineController('bounded-model'), family: 'model' as const, provider: 'mock' as const, model: 'mock-policy' };
    const request = familyRequest(env, 'conductor', c); expect(request.observation.environmentVersion).toBe('2.0.0');
    expect(() => validateWorldRequest({ ...request, observation: { ...request.observation, environmentVersion: '3.0.0' } })).toThrow();
    expect(() => validateWorldRequest({ ...request, observation: { ...request.observation, world: 'cache-quest' } })).toThrow();
  });
  it('an incorrect human note remains incorrect in the recorded audio rather than being replaced by the target score', async () => {
    const config = performanceConfig(composeScore('band')), session = new FamilySession(config, { lead: { ...baselineController('human-player'), family: 'human' } });
    while (!session.env.result().terminal) {
      const view = session.env.observe('lead'), sounding = view.state.started && view.state.active && view.state.target;
      const action = sounding ? view.state.beat === 0 ? 'play-high' : 'play-target' : 'rest';
      expect(await session.step({ lead: action })).toBe(true);
    }
    const receipt = session.receipt(); expect(receipt.result.success).toBe(false);
    const events = receipt.result.public.events as { role: string; beat: number; kind: string; pitch: number }[];
    expect(events.find(e => e.role === 'lead' && e.kind === 'note' && e.beat === 0)!.pitch).toBe(config.score!.parts.find(p=>p.id==='lead')!.notes[0].pitch + 2);
    const bad = await renderPerformance(validateBundle({ schema: 'performance-bundle@1', performance: receipt, voices: voicesForScore(config.score!), settings: defaultRenderSettings() }));
    const correct = await renderPerformance(validateBundle({ schema: 'performance-bundle@1', performance: await finish(new FamilySession(config)), voices: voicesForScore(config.score!), settings: defaultRenderSettings() }));
    expect(bad.receipt.wavHash).not.toBe(correct.receipt.wavHash); expect(bad.receipt.midiHash).not.toBe(correct.receipt.midiHash);
  });
  it('call and response uses alternating original phrase windows and chord tones', () => {
    const score = composeScore('call-response', 11, 7);
    for (const [index, part] of score.parts.slice(0, 2).entries()) for (const note of part.notes) {
      const bar = Math.floor(note.beat / score.meter), chord = score.chords[bar];
      expect(bar % 2).toBe(index); expect(chord.quality === 'minor' ? [0, 3, 7] : [0, 4, 7]).toContain((note.pitch - chord.root + 120) % 12);
    }
  });
  it('V11 cue and voice relationships fail atomically without weakening V10 validation', () => {
    const score = clone(composeScore('choir'));
    score.parts[0].notes[0].syllable = 'execute'; expect(() => validatePerformanceScore(score)).toThrow();
    const duplicate = clone(composeScore('choir')); duplicate.cues.push(duplicate.cues[0]); expect(() => performanceConfig(duplicate)).toThrow();
    expect(() => validateFamilyConfig({ ...familyConfig('auto-circuit'), schema: 'family-config@2' })).toThrow();
  });
  it('rejects voice getters, nonfinite settings, unknown executable fields and range mismatch', async () => {
    const b = await bundle(), voice = b.voices[0];
    expect(() => validateVoice({ ...voice, brightness: Infinity })).toThrow();
    expect(() => validateVoice({ ...voice, script: 'execute' })).toThrow();
    let accessed = false; const input = Object.defineProperty({}, 'schema', { enumerable: true, get() { accessed = true; return 'synthetic-voice@1'; } });
    expect(() => validateVoice(input)).toThrow(); expect(accessed).toBe(false);
    const broken = clone(b); broken.voices[0].range = [80, 84]; expect(() => validateBundle(broken)).toThrow();
    expect(() => validateBundle({ ...b, settings: { ...b.settings, sampleRate: 192000 } })).toThrow();
  });
  it('renders real stereo PCM and MIDI, with separate score, profile and byte evidence', async () => {
    const b = await bundle(), first = await renderPerformance(b), second = await renderPerformance(b), wav = new DataView(first.wav.buffer);
    expect(new TextDecoder().decode(first.wav.slice(0, 4))).toBe('RIFF'); expect(wav.getUint16(22, true)).toBe(2); expect(wav.getUint32(24, true)).toBe(22050);
    expect(first.wav.length).toBe(44 + first.receipt.frames * 4); expect(first.peaks.some(n => n > 0.01)).toBe(true); expect(first.peaks.every(n => n < 1)).toBe(true);
    expect(new TextDecoder().decode(first.midi.slice(0, 4))).toBe('MThd'); expect(new TextDecoder().decode(first.midi.slice(14, 18))).toBe('MTrk');
    expect(first.receipt.wavHash).toBe(second.receipt.wavHash); expect(first.receipt.scoreHash).toBe(hash(scoreFromReceipt(b.performance)));
    const changed = clone(b); changed.voices[0].brightness = 0.9; const different = await renderPerformance(changed);
    expect(different.receipt.wavHash).not.toBe(first.receipt.wavHash); expect(different.receipt.familyDigest).toBe(first.receipt.familyDigest); expect(different.receipt.midiHash).toBe(first.receipt.midiHash);
    const forged = clone(first.receipt); forged.wavHash = '0'.repeat(64); const body = { ...forged } as Partial<typeof forged>; delete body.digest; forged.digest = hash(body);
    await expect(verifyAudioReceipt(b, forged)).rejects.toThrow();
  });
  it('does not render an incomplete episode or trust rehashed forged family outcomes', async () => {
    const b = await bundle(), stopped = new FamilySession(performanceConfig(composeScore('band'))).receipt();
    expect(() => validateBundle({ ...b, performance: stopped })).toThrow();
    const bad = clone(b); bad.performance.result.success = false; expect(() => validateBundle(bad)).toThrow();
  });
  it('timing follows logical beat time even when model responses complete in a different order', async () => {
    const config = performanceConfig(composeScore('call-response')), env = createFamilyEnvironment(config), c = { ...baselineController('prepared-model'), family: 'model' as const, provider: 'mock' as const, model: 'mock-policy' };
    const mock = mockAdapter(), run = async (reverse: boolean) => {
      const s = new FamilySession(config, Object.fromEntries(env.roles.map(r => [r, c])), {}, { mock: { ...mock, async propose(request, signal) { await new Promise(resolve => setTimeout(resolve, (request.observation.agent.id === 'conductor') === reverse ? 2 : 1)); return mock.propose(request, signal); } } });
      return finish(s);
    };
    expect((await run(false)).digest).toBe((await run(true)).digest);
  });
  for (const destination of ['stunt-show', 'stream-studio'] as const) it(`an owned verified composition supplies native ${destination} score cues`, async () => {
    let save = enableCircuitWorlds(addAgent(freshCareer(), 'composer', 'Composer'), 'composer');
    const input = evaluationInput(save, 'composer', 'ensemble-lab', 'music-origin', 'CAREER', 'FRESH');
    const music = createCareerSession(save.agents[0], 'ensemble-lab', input, save, { config: performanceConfig(composeScore('composition')) });
    while (!music.result().terminal) expect(await music.step()).toBe(true);
    save = rememberRun(save, music.receipt()); save = retainFamilyOutputs(save, save.runs[0].digest, 'original-theme');
    const admitted = evaluationInput(save, 'composer', destination, 'scored-show', 'CAREER', 'PRIOR');
    const config = validateFamilyConfig({ ...familyConfig(destination), schema: 'family-config@2' });
    const show = createCareerSession(save.agents[0], destination, admitted, save, { config });
    if(show.kind!=='family')throw new Error('Missing native media host.');
    while (!show.result().terminal) expect(await show.step()).toBe(true);
    save = rememberRun(save, show.receipt()); validateCareer(save);
    expect(show.result().measures.scoreReferences).toBe(1); expect(show.result().measures.scoredCues).toBeGreaterThan(0);
    const cues = show.result().public.musicCues as { scoreHash: string }[]; expect(cues.every(c => c.scoreHash === save.artifacts[0].contentHash)).toBe(true);
  });
  it('a supplied synthetic bus must acknowledge the validated bundle and honor cancellation', async () => {
    const b = await bundle(), signal = new AbortController(), good = { id: 'local-test', syntheticOnly: true as const, stop() {}, async prepare(value: PerformanceBundle) { return { accepted: true as const, bundleHash: hash(value) }; } };
    expect((await preparePerformance(good, b, signal.signal)).bundleHash).toBe(hash(b));
    signal.abort(); await expect(preparePerformance(good, b, signal.signal)).rejects.toThrow();
    await expect(preparePerformance({ ...good, async prepare() { return { accepted: true, bundleHash: '0'.repeat(64) }; } }, b, new AbortController().signal)).rejects.toThrow();
  });
});
