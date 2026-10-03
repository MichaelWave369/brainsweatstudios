import { useEffect, useRef } from 'react';
import type { Settings } from '../data/types';
export const noteFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export interface ToneEvent { hz: number; at: number; duration: number; wave?: OscillatorType }
export function useLabAudio(paused: boolean, settings: Settings) {
  const context = useRef<AudioContext | null>(null);
  const nodes = useRef<OscillatorNode[]>([]);
  const stop = () => { for (const node of nodes.current) { try { node.stop(); } catch { /* Already stopped. */ } node.disconnect(); } nodes.current = []; navigator.vibrate?.(0); };
  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); stop(); void context.current?.close(); context.current = null; };
  }, []);
  useEffect(() => { if (paused || settings.muted) stop(); }, [paused, settings.muted]);
  return {
    stop,
    play(events: ToneEvent[]) {
      stop(); if (paused || settings.muted || settings.effects <= 0) return false;
      try {
        context.current ||= new AudioContext(); const audio = context.current; void audio.resume();
        const start = audio.currentTime + 0.025;
        for (const event of events.slice(0, 64)) {
          const oscillator = audio.createOscillator(); const gain = audio.createGain();
          const at = start + Math.min(8, Math.max(0, event.at)); const duration = Math.min(0.8, Math.max(0.04, event.duration));
          oscillator.type = event.wave || 'sine'; oscillator.frequency.value = Math.min(2000, Math.max(80, event.hz));
          gain.gain.setValueAtTime(0.0001, at); gain.gain.linearRampToValueAtTime(settings.effects * 0.055, at + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
          oscillator.connect(gain); gain.connect(audio.destination); nodes.current.push(oscillator);
          oscillator.start(at); oscillator.stop(at + duration + 0.01);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); nodes.current = nodes.current.filter(n => n !== oscillator); };
        }
        return true;
      } catch { return false; }
    },
  };
}
