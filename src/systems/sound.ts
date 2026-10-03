import type { Settings } from '../data/types';

let context: AudioContext | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let lastNote = 0;
let currentSettings: Settings | undefined;
const notes = [130.81, 164.81, 196, 261.63, 220, 196, 164.81, 146.83];
export function playTone(settings: Settings, kind: 'click' | 'success' | 'step' = 'click') {
  currentSettings = settings;
  if (settings.muted || settings.effects <= 0) return;
  try {
    context ||= new AudioContext();
    void context.resume();
    const osc = context.createOscillator(); const gain = context.createGain(); const t = context.currentTime;
    osc.type = 'sine'; osc.frequency.setValueAtTime(kind === 'success' ? 523.25 : kind === 'step' ? 260 : 380, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'success' ? 1046.5 : 180, t + 0.12);
    gain.gain.setValueAtTime(settings.effects * 0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain); gain.connect(context.destination); osc.start(t); osc.stop(t + 0.2);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch { /* Audio is optional on browsers without Web Audio support. */ }
}
export function setSoundSettings(settings: Settings) {
  currentSettings = settings;
  if (musicTimer) clearInterval(musicTimer); musicTimer = undefined;
  if (!context || settings.muted || settings.music <= 0) return;
  musicTimer = setInterval(() => {
    if (document.hidden || !context || !currentSettings || currentSettings.muted) return;
    const osc = context.createOscillator(); const gain = context.createGain(); const t = context.currentTime;
    osc.frequency.value = notes[lastNote++ % notes.length]; osc.type = 'sine'; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(currentSettings.music * 0.04, t + 0.15); gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(gain); gain.connect(context.destination); osc.start(t); osc.stop(t + 1.5); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }, 800);
}
export function unlockAudio(settings: Settings) { try { context ||= new AudioContext(); void context.resume(); setSoundSettings(settings); } catch { /* Optional sound. */ } }
export function stopSound() { if (musicTimer) clearInterval(musicTimer); musicTimer = undefined; }
