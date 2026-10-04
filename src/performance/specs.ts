import { beatTime } from '../families/ensemble.ts';
import { verifyFamilyReceipt } from '../families/receipts.ts';
import { familyConfig, requireData, validateFamilyConfig, validateScore } from '../families/specs.ts';
import type { FamilyConfig, FamilyReceipt, ScoreSpec } from '../families/types.ts';
import { clone, exact, finite, freeze, integer, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { PERFORMANCE_MODES, type PerformanceBundle, type PerformanceMode, type RenderSettings, type VoiceProfile } from './types.ts';

export function validateVoice(value: unknown): VoiceProfile {
  assertData(value, 2000, 80, 4);
  requireData(plain(value) && exact(value, ['schema', 'id', 'range', 'timbre', 'formants', 'brightness', 'breathiness', 'vibratoDepth', 'vibratoHz', 'attack', 'release', 'pan'])
    && value.schema === 'synthetic-voice@1' && typeof value.id === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(value.id)
    && Array.isArray(value.range) && value.range.length === 2 && value.range.every(n => integer(n, 24, 96)) && value.range[0] <= value.range[1]
    && ['round', 'bright', 'airy'].includes(String(value.timbre))
    && Array.isArray(value.formants) && value.formants.length === 3 && value.formants.every(n => finite(n, 200, 4000)) && value.formants.every((n, i) => i === 0 || n > (value.formants as number[])[i - 1])
    && finite(value.brightness, 0, 1) && finite(value.breathiness, 0, 0.3)
    && finite(value.vibratoDepth, 0, 0.5) && finite(value.vibratoHz, 0, 8)
    && finite(value.attack, 0.005, 0.2) && finite(value.release, 0.02, 0.5) && finite(value.pan, -1, 1), 'Invalid synthetic voice profile.');
  return freeze(clone(value)) as unknown as VoiceProfile;
}

export const defaultRenderSettings = (): RenderSettings => ({ schema: 'performance-render@1', engine: 'original-formant-synth@1', sampleRate: 22050, gain: 0.65 });
export function validateRenderSettings(value: unknown): RenderSettings {
  assertData(value, 1000, 20, 2);
  requireData(plain(value) && exact(value, ['schema', 'engine', 'sampleRate', 'gain']) && value.schema === 'performance-render@1'
    && value.engine === 'original-formant-synth@1' && [22050, 44100].includes(Number(value.sampleRate)) && typeof value.sampleRate === 'number'
    && finite(value.gain, 0, 0.8), 'Invalid local render settings.');
  return freeze(clone(value)) as unknown as RenderSettings;
}

// V10 score validation and kernel stay unchanged. V11 opts into stricter musical
// relationships and conductor semantics through family-config@2.
export function validatePerformanceScore(value: unknown): ScoreSpec {
  const score = validateScore(value), end = score.bars * score.meter;
  requireData(score.chords.length > 0 && score.chords[0].beat === 0
    && score.chords.every((c, i) => i === 0 || c.beat > score.chords[i - 1].beat), 'Chord changes must be ordered and start at beat zero.');
  requireData(new Set(score.parts.filter(p => p.voice).map(p => p.voice!.id)).size === score.parts.filter(p => p.voice).length, 'Voice identities must be unique within a score.');
  requireData(score.cues.every(c => score.cues.filter(other => other.beat === c.beat).every(other => other.type === c.type)), 'One conductor cue type is allowed per beat.');
  for (const part of score.parts) {
    requireData((part.instrument.kind === 'voice') === !!part.voice, 'Voice parts require matching synthetic instruments.');
    if (part.voice) requireData(part.notes.every(n => n.pitch >= part.voice!.range[0] && n.pitch <= part.voice!.range[1] && part.voice!.syllables.includes(n.syllable)), 'Voice notes must match the declared range and syllables.');
    const cues = score.cues.filter(c => c.part === part.id);
    requireData(cues.some(c => c.type === 'entry' && c.beat === 0) && cues.some(c => c.type === 'cutoff' && c.beat === end), 'Every part needs entry and final cutoff cues.');
    requireData(new Set(cues.map(c => `${c.beat}:${c.type}`)).size === cues.length, 'Duplicate part cues are ambiguous.');
    requireData(cues.filter(c => c.type === 'cutoff').every(c => !part.notes.some(n => n.beat < c.beat && n.beat + n.duration > c.beat)), 'Cutoffs cannot split authored notes.');
  }
  requireData(beatTime(score, end) <= 32000, 'The local performance exceeds its time budget.');
  return score;
}

export function composeScore(mode: PerformanceMode, seed = 17, key = 0, bpm = 108, meter = 4): ScoreSpec {
  requireData(PERFORMANCE_MODES.includes(mode) && integer(seed, 0, 2147483647) && integer(key, 0, 11) && integer(bpm, 60, 160) && integer(meter, 3, 4), 'Choose bounded composition settings.');
  const roles = mode === 'choir' ? ['soprano', 'alto', 'tenor', 'bass', 'rhythm', 'accompaniment']
    : mode === 'call-response' ? ['call', 'response', 'rhythm', 'accompaniment'] : ['drums', 'bass', 'keys', 'lead', 'texture', 'voice'];
  const roots = [0, 5, 7, 0, 9, 5, 7, 0].map(n => (n + key) % 12), end = 8 * meter;
  const parts: ScoreSpec['parts'] = roles.map((id, index) => {
    const vocal = mode === 'choir' ? index < 4 : mode === 'call-response' ? index < 2 : id === 'voice';
    const kind = vocal ? 'voice' : ['drums', 'rhythm'].includes(id) ? 'drum' : id === 'bass' ? 'bass' : id === 'texture' ? 'pad' : 'keys';
    const low = id === 'bass' ? 36 : id === 'soprano' ? 60 : 48;
    const notes: ScoreSpec['parts'][number]['notes'] = [];
    for (let bar = 0; bar < 8; bar++) {
      if (mode === 'call-response' && vocal && bar % 2 !== index) continue;
      const intervals = bar === 4 ? [0, 3, 7] : [0, 4, 7];
      for (let step = 0; step < meter; step += kind === 'drum' || mode === 'composition' ? 1 : 2) {
        const duration = Math.min(kind === 'drum' || mode === 'composition' ? 1 : 2, meter - step);
        notes.push({ beat: bar * meter + step, duration, pitch: low + roots[bar] + intervals[(index + step + seed % 3) % 3], velocity: bar < 4 ? 76 : 64, syllable: vocal ? ['la', 'mi', 'nu', 'oh'][(bar + step + index) % 4] : '' });
      }
    }
    return { id, instrument: { id: `synth-${id}`, kind, range: [low, 84] }, voice: vocal ? { id: `synthetic-${id}`, range: [low, 84], syllables: ['la', 'mi', 'nu', 'oh'] } : null, notes };
  });
  return validatePerformanceScore({ schema: 'score-spec@1', title: ({ choir: 'Signal Garden Choir', band: 'Circuit Lights Band', 'call-response': 'Garden Call and Response', composition: 'Eight-bar Chord Workshop' })[mode], bars: 8, meter, key,
    tempo: [{ beat: 0, bpm }], chords: roots.map((root, i) => ({ beat: i * meter, root, quality: i === 4 ? 'minor' : 'major' })),
    cues: parts.flatMap(p => [{ beat: 0, part: p.id, type: 'entry', level: 76 }, { beat: meter * 4, part: p.id, type: 'dynamics', level: 64 }, { beat: end, part: p.id, type: 'cutoff', level: 0 }]), parts });
}

export function performanceConfig(score: ScoreSpec, seed = 17): FamilyConfig {
  return validateFamilyConfig({ ...familyConfig('ensemble-lab', seed), schema: 'family-config@2', score: validatePerformanceScore(score) });
}
export function voicesForScore(value: ScoreSpec): VoiceProfile[] {
  const score = validateScore(value), parts = [...new Map(score.parts.filter(p => p.voice).map(p => [p.voice!.id, p])).values()];
  return parts.map((part, i) => validateVoice({ schema: 'synthetic-voice@1', id: part.voice!.id, range: [Math.min(...score.parts.filter(p=>p.voice?.id===part.voice!.id).map(p=>p.voice!.range[0])),Math.max(...score.parts.filter(p=>p.voice?.id===part.voice!.id).map(p=>p.voice!.range[1]))],
    timbre: ['round', 'bright', 'airy'][i % 3], formants: [520 + i * 40, 1300 + i * 80, 2500 + i * 100], brightness: 0.45, breathiness: 0.04,
    vibratoDepth: 0.12, vibratoHz: 4.5, attack: 0.025, release: 0.1, pan: parts.length === 1 ? 0 : -0.6 + i * 1.2 / (parts.length - 1) }));
}
export function scoreFromReceipt(receipt: FamilyReceipt): ScoreSpec {
  requireData(receipt.config.family === 'ensemble-lab' && receipt.result.reason === 'complete', 'Complete an ensemble episode before rendering.');
  return validateScore(receipt.result.public.score);
}
export function validateBundle(value: unknown): PerformanceBundle {
  assertData(value, 1250000, 225000, 30);
  requireData(plain(value) && exact(value, ['schema', 'performance', 'voices', 'settings']) && value.schema === 'performance-bundle@1' && Array.isArray(value.voices) && value.voices.length <= 7, 'Invalid performance bundle.');
  const performance = verifyFamilyReceipt(value.performance), score = scoreFromReceipt(performance), voices = value.voices.map(validateVoice), settings = validateRenderSettings(value.settings);
  const ids = [...new Set(score.parts.filter(p => p.voice).map(p => p.voice!.id))];
  requireData(voices.length === ids.length && new Set(voices.map(v => v.id)).size === voices.length && ids.every(id => voices.some(v => v.id === id)), 'Voice profiles differ from the performed score.');
  score.parts.filter(p => p.voice).forEach(p => requireData(voices.find(v => v.id === p.voice!.id)!.range[0] <= p.voice!.range[0] && voices.find(v => v.id === p.voice!.id)!.range[1] >= p.voice!.range[1], 'Voice range cannot narrow a performed part.'));
  return freeze({ schema: 'performance-bundle@1', performance, voices, settings });
}
