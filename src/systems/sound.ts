import type { Settings } from '../data/types';

let context: AudioContext | undefined, master: GainNode | undefined, musicGain: GainNode | undefined, effectsGain: GainNode | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined, currentSettings: Settings | undefined, beat = 0, scene = 'studio';
const voices = new Set<OscillatorNode>();
const notes = [0, 7, 12, 16, 12, 7, 2, 9];
const roots: Record<string, number> = { space: 110, sports: 146.83, outpost: 130.81, scenario: 123.47, academy: 110, learner: 130.81 };
function createAudio() {
  if (context) return;
  context = new AudioContext(); master = context.createGain(); musicGain = context.createGain(); effectsGain = context.createGain();
  const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 5; compressor.attack.value = 0.004; compressor.release.value = 0.2;
  musicGain.connect(master); effectsGain.connect(master); master.connect(compressor); compressor.connect(context.destination);
  master.gain.value = 0; musicGain.gain.value = 0; effectsGain.gain.value = 0;
}
function gains() {
  if (!context || !master || !musicGain || !effectsGain || !currentSettings) return;
  const t = context.currentTime;
  master.gain.setTargetAtTime(currentSettings.muted || document.hidden ? 0 : 0.65, t, 0.01);
  musicGain.gain.setTargetAtTime(currentSettings.music, t, 0.02); effectsGain.gain.setTargetAtTime(currentSettings.effects, t, 0.01);
}
function tone(hz: number, duration: number, volume: number, type: OscillatorType, bus: 'music' | 'effect', pan = 0, delay = 0, endHz?: number) {
  if (!context || !musicGain || !effectsGain || voices.size >= 32 || document.hidden || currentSettings?.muted) return;
  const osc = context.createOscillator(), envelope = context.createGain(), filter = context.createBiquadFilter(), stereo = context.createStereoPanner(), t = context.currentTime + delay;
  osc.type = type; osc.frequency.setValueAtTime(Math.max(40, Math.min(2200, hz)), t); if (endHz) osc.frequency.exponentialRampToValueAtTime(endHz, t + duration * 0.75);
  filter.type = 'lowpass'; filter.frequency.value = type === 'sawtooth' ? 1200 : 3600; filter.Q.value = 0.6;
  stereo.pan.value = Math.max(-1, Math.min(1, pan));
  envelope.gain.setValueAtTime(0.0001, t); envelope.gain.linearRampToValueAtTime(volume, t + Math.min(0.03, duration * 0.15)); envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(filter); filter.connect(envelope); envelope.connect(stereo); stereo.connect(bus === 'music' ? musicGain : effectsGain); voices.add(osc);
  osc.onended = () => { voices.delete(osc); osc.disconnect(); filter.disconnect(); envelope.disconnect(); stereo.disconnect(); };
  osc.start(t); osc.stop(t + duration + 0.01);
}
export function setSoundScene(kind: string) { scene = kind; }
export function playTone(settings: Settings, kind: 'click' | 'success' | 'step' = 'click') {
  currentSettings = settings; gains(); if (!context || settings.muted || settings.effects <= 0) return;
  try {
    if (kind === 'success') { for (const [i, hz] of [523.25, 659.25, 783.99, 1046.5].entries()) tone(hz, 0.28, 0.08, 'triangle', 'effect', (i - 1.5) * 0.15, i * 0.055); }
    else tone(kind === 'step' ? 220 : 420, 0.12, 0.06, 'triangle', 'effect', 0, 0, 180);
  } catch { /* Sound is optional. */ }
}
export function playAgentCue(kind: 'move' | 'blocked' | 'interact' | 'complete' | 'thruster', pan = 0) {
  if (!context || !currentSettings || currentSettings.muted || currentSettings.effects <= 0 || document.hidden) return;
  try {
    if (kind === 'complete') { for (const [i, hz] of [392, 493.88, 587.33, 783.99].entries()) tone(hz, 0.35, 0.07, 'triangle', 'effect', pan, i * 0.07); }
    else if (kind === 'blocked') tone(120, 0.13, 0.05, 'sawtooth', 'effect', pan, 0, 65);
    else if (kind === 'interact') { tone(660, 0.18, 0.06, 'sine', 'effect', pan); tone(990, 0.22, 0.025, 'sine', 'effect', pan, 0.035); }
    else if (kind === 'thruster') tone(90, 0.15, 0.035, 'sawtooth', 'effect', pan, 0, 55);
    else tone(270, 0.045, 0.022, 'triangle', 'effect', pan, 0, 170);
  } catch { /* Text and telemetry keep every outcome available without sound. */ }
}
export function setSoundSettings(settings: Settings) {
  currentSettings = settings; gains(); stopSound();
  if (!context || settings.muted || settings.music <= 0) return;
  musicTimer = setInterval(() => {
    if (!context || !currentSettings || currentSettings.muted || document.hidden) return;
    try {
      const root = roots[scene] || 130.81, space = scene === 'space' || scene === 'academy', n = beat++;
      tone(root * 2 ** (notes[n % 8] / 12), space ? 0.8 : 0.3, 0.055, 'triangle', 'music', Math.sin(n * 0.7) * 0.45);
      if (n % 8 === 0) for (const [i, interval] of [0, 7, 14].entries()) tone(root * 2 ** (interval / 12), 1.7, 0.027, 'sine', 'music', (i - 1) * 0.6);
      if (n % 4 === 0) tone(root / 2, 0.4, 0.09, 'sine', 'music', 0, 0, root / 3);
      if (!space && n % 2 === 1) tone(1500, 0.045, 0.016, 'triangle', 'music', n % 4 === 1 ? -0.3 : 0.3, 0, 800);
    } catch { stopSound(); }
  }, 280);
}
export function unlockAudio(settings: Settings) {
  try { currentSettings = settings; createAudio(); void context?.resume(); gains(); setSoundSettings(settings); } catch { /* Browsers without Web Audio keep the full studio usable. */ }
}
export function stopSound() { if (musicTimer) clearInterval(musicTimer); musicTimer = undefined; }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', gains);
