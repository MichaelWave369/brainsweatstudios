import type { FamilyReceipt } from '../families/types.ts';

export const PERFORMANCE_MODES = ['choir', 'band', 'call-response', 'composition'] as const;
export type PerformanceMode = typeof PERFORMANCE_MODES[number];
export interface VoiceProfile {
  schema: 'synthetic-voice@1';
  id: string;
  range: [number, number];
  timbre: 'round' | 'bright' | 'airy';
  formants: [number, number, number];
  brightness: number;
  breathiness: number;
  vibratoDepth: number;
  vibratoHz: number;
  attack: number;
  release: number;
  pan: number;
}
export interface RenderSettings {
  schema: 'performance-render@1';
  engine: 'original-formant-synth@1';
  sampleRate: 22050 | 44100;
  gain: number;
}
export interface PerformanceBundle {
  schema: 'performance-bundle@1';
  performance: FamilyReceipt;
  voices: VoiceProfile[];
  settings: RenderSettings;
}
export interface AudioReceipt {
  schema: 'audio-performance@1';
  bundleHash: string;
  familyDigest: string;
  scoreHash: string;
  voices: { id: string; hash: string }[];
  settings: RenderSettings;
  wavHash: string;
  midiHash: string;
  frames: number;
  bytes: number;
  digest: string;
}
