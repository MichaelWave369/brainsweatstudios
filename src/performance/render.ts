import { beatTime } from '../families/ensemble.ts';
import { requireData } from '../families/specs.ts';
import type { PerformanceEvent, ScoreSpec } from '../families/types.ts';
import { hash } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { scoreFromReceipt, validateBundle } from './specs.ts';
import type { AudioReceipt, PerformanceBundle, VoiceProfile } from './types.ts';

const TAU = Math.PI * 2;
const frequency = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);
const wavHeader = (frames: number, sampleRate: number) => {
  const data = new Uint8Array(44 + frames * 4), view = new DataView(data.buffer);
  const text = (at: number, value: string) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, data.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 4, true);
  return data;
};
const variable = (value: number): number[] => { const bytes = [value & 127]; for (value >>>= 7; value; value >>>= 7) bytes.unshift((value & 127) | 128); return bytes; };
const u32 = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];

/** MIDI captures the performed notes, including errors, and the authored tempo map. */
export function performanceMidi(score: ScoreSpec, events: PerformanceEvent[]): Uint8Array {
  const rows: { tick: number; order: number; bytes: number[] }[] = score.tempo.map(t => {
    const micros = Math.round(60000000 / t.bpm);
    return { tick: t.beat * 480, order: -2, bytes: [255, 81, 3, micros >>> 16 & 255, micros >>> 8 & 255, micros & 255] };
  });
  rows.push({ tick: 0, order: -3, bytes: [255, 88, 4, score.meter, 2, 24, 8] });
  for (const note of events.filter(e => e.kind === 'note')) {
    const index = score.parts.findIndex(p => p.id === note.role), drum = score.parts[index].instrument.kind === 'drum', channel = drum ? 9 : index;
    rows.push({ tick: note.beat * 480, order: 1, bytes: [144 | channel, note.pitch, Math.round(note.velocity * 1.27)] });
    rows.push({ tick: Math.min(score.bars * score.meter, note.beat + note.duration) * 480, order: 0, bytes: [128 | channel, note.pitch, 0] });
  }
  rows.sort((a, b) => a.tick - b.tick || a.order - b.order);
  let previous = 0; const body: number[] = [];
  rows.forEach(row => { body.push(...variable(row.tick - previous), ...row.bytes); previous = row.tick; });
  body.push(...variable(score.bars * score.meter * 480 - previous), 255, 47, 0);
  return new Uint8Array([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 1, 224, 77, 84, 114, 107, ...u32(body.length), ...body]);
}

function voiceWeights(base: number, profile: VoiceProfile, syllable: string): number[] {
  const vowels: Record<string, number[]> = { la: [700, 1200, 2600], mi: [300, 2300, 3000], nu: [350, 900, 2200], oh: [450, 850, 2500] };
  const vowel = vowels[syllable] ?? profile.formants;
  const weights: number[] = [];
  for (let harmonic = 1; harmonic <= 8; harmonic++) {
    const hz = harmonic * base;
    const formant = vowel.reduce((n, target, i) => n + Math.exp(-(((hz - (target + profile.formants[i]) / 2) / 400) ** 2)), 0);
    const timbre = profile.timbre === 'bright' ? 0.25 : profile.timbre === 'round' ? -0.2 : 0;
    weights.push((0.15 + formant) / harmonic ** (1.6 - profile.brightness * 0.6 - timbre));
  }
  const total = weights.reduce((n, v) => n + v, 0);
  return weights.map(v => v / total);
}
async function byteHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

/** Bounded, offline PCM render. Browser/device playback never affects the receipt. */
export async function renderPerformance(value: PerformanceBundle) {
  const bundle = validateBundle(value), score = scoreFromReceipt(bundle.performance), { sampleRate, gain } = bundle.settings;
  const events = bundle.performance.result.public.events as PerformanceEvent[];
  const duration = beatTime(score, score.bars * score.meter) / 1000 + 0.5;
  const frames = Math.ceil(duration * sampleRate);
  requireData(frames <= 1500000, 'Render exceeds the local sample budget.');
  const left = new Float32Array(frames), right = new Float32Array(frames), profiles = new Map(bundle.voices.map(v => [v.id, v]));
  for (const [index, note] of events.entries()) {
    if (note.kind !== 'note') continue;
    const part = score.parts.find(p => p.id === note.role)!;
    const profile = part.voice ? profiles.get(part.voice.id)! : null;
    const at = Math.round(note.timeMs / 1000 * sampleRate), length = (beatTime(score, Math.min(score.bars * score.meter, note.beat + note.duration)) - note.timeMs) / 1000;
    const attack = profile?.attack ?? 0.01, release = profile?.release ?? 0.08, pan = profile?.pan ?? (score.parts.indexOf(part) / Math.max(1, score.parts.length - 1) - 0.5) * 0.8;
    const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2), base = frequency(note.pitch), count = Math.min(frames - at, Math.ceil((length + release) * sampleRate));
    const weights = profile ? voiceWeights(base, profile, note.syllable) : [];
    let phase = 0, noise = index + 12345;
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate, envelope = Math.min(1, time / attack) * (time < length ? 1 : Math.max(0, 1 - (time - length) / release));
      phase += TAU * base * (profile ? 2 ** (profile.vibratoDepth * Math.sin(TAU * profile.vibratoHz * time) / 12) : 1) / sampleRate;
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      const breath = noise / 2147483648 - 1;
      let sample: number;
      if (profile) sample = weights.reduce((n, weight, harmonic) => n + Math.sin(phase * (harmonic + 1)) * weight, 0) * (1 - profile.breathiness) + breath * profile.breathiness;
      else if (part.instrument.kind === 'drum') sample = (Math.sin(phase) * 0.7 + breath * 0.3) * Math.exp(-time * 14);
      else if (part.instrument.kind === 'bass') sample = Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.2;
      else sample = (Math.sin(phase) + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3) * 0.15) / 1.45 * (part.instrument.kind === 'pad' ? 1 : Math.exp(-time * 0.8));
      sample *= envelope * note.velocity / 100 * gain / Math.sqrt(score.parts.length);
      left[at + i] += sample * l; right[at + i] += sample * r;
    }
  }
  const wav = wavHeader(frames, sampleRate), view = new DataView(wav.buffer), peaks = new Array<number>(96).fill(0);
  for (let i = 0; i < frames; i++) {
    const a = Math.tanh(left[i]), b = Math.tanh(right[i]);
    view.setInt16(44 + i * 4, Math.round(a * 32767), true); view.setInt16(46 + i * 4, Math.round(b * 32767), true);
    const bin = Math.min(95, Math.floor(i * 96 / frames)); peaks[bin] = Math.max(peaks[bin], Math.abs(a), Math.abs(b));
  }
  const midi = performanceMidi(score, events), [wavHash, midiHash] = await Promise.all([byteHash(wav), byteHash(midi)]);
  const body: Omit<AudioReceipt, 'digest'> = { schema: 'audio-performance@1', bundleHash: hash(bundle), familyDigest: bundle.performance.digest, scoreHash: hash(score), voices: bundle.voices.map(v => ({ id: v.id, hash: hash(v) })), settings: bundle.settings, wavHash, midiHash, frames, bytes: wav.length };
  return { wav, midi, peaks, receipt: { ...body, digest: hash(body) }, duration };
}

export async function verifyAudioReceipt(bundle: PerformanceBundle, receipt: AudioReceipt) {
  assertData(receipt, 6000, 200, 6);
  const result = await renderPerformance(bundle);
  requireData(hash(result.receipt) === hash(receipt), 'Audio bytes or settings differ from the local receipt. Score replay can still be verified independently.');
  return result;
}
