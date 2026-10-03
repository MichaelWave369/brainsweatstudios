import { useMissionState } from '../systems/MissionSession';
import { useStudio } from '../systems/StudioContext';
import { useLabAudio } from '../systems/labAudio';
import { clamp, difficultyIndex, type GameProps } from '../data/types';
import { Action, GameLayout, Notice, Stat, Stats, StepDots } from './shared';
export const frequencyTargets = [220, 330, 440, 250, 300, 360, 400, 500];
export const frequencyAccuracy = (actual: number, target: number) => Math.max(0, 1 - Math.abs(actual - target) / target);
export default function FrequencyLab({ difficulty, mission, paused, onFinish }: GameProps) {
  const { save } = useStudio(); const d = difficultyIndex(difficulty); const rounds = 3 + d;
  const [round, setRound] = useMissionState('round', 0); const [hz, setHz] = useMissionState('hz', 180); const [wave, setWave] = useMissionState<'sine' | 'triangle'>('wave', 'sine'); const [points, setPoints] = useMissionState('points', 0); const [experiments, setExperiments] = useMissionState('experiments', 0); const [notice, setNotice] = useMissionState('notice', 'Match the target with the frequency slider. Use the wave display, numbers, or optional sound.');
  const target = Math.round(frequencyTargets[mission] * (round % 2 === 0 ? 1 : 2)); const audio = useLabAudio(paused, save.settings);
  const paths = (freq: number, type: 'sine' | 'triangle' = 'sine') => Array.from({ length: 121 }, (_, i) => `${i === 0 ? 'M' : 'L'}${i * 2.5},${55 - (type === 'sine' ? Math.sin(i / 120 * Math.PI * 2 * freq / 100) : 2 / Math.PI * Math.asin(Math.sin(i / 120 * Math.PI * 2 * freq / 100))) * 35}`).join(' ');
  function test() {
    const accuracy = frequencyAccuracy(hz, target); setExperiments(experiments + 1);
    if (accuracy < [0.9, 0.95, 0.985][d]) { setNotice(hz < target ? 'The pitch is below the target. Increase the frequency and compare again.' : 'The pitch is above the target. Reduce the frequency and compare again.'); return; }
    const total = points + accuracy * 100;
    if (round + 1 === rounds) { audio.stop(); onFinish({ score: Math.round(clamp(total / rounds)), summary: `You matched ${rounds} wave targets through ${experiments + 1} experiments.`, lesson: 'Frequency is cycles per second, measured in hertz. Doubling a musical frequency gives an octave. A phone’s haptic pulses are a separate timed effect: this app does not set its motor frequency. These are sound experiments, with no healing claims.', metrics: { 'Targets matched': rounds, 'Experiments': experiments + 1, 'Final frequency': `${hz} Hz` } }); }
    else { setPoints(total); setRound(round + 1); setNotice('Target matched. The next target explores the same pitch family with a different frequency.'); }
  }
  return <GameLayout kind="frequency" title={['The wave workshop', 'Octave explorers', 'Pitch precision', 'The gentle pulse', 'Ratio experiment', 'Waveform contrast', 'Signal designer', 'The listening lab'][mission]} description="Tune a virtual signal, compare it with the target, and run repeated experiments. Every task also works silently." paused={paused} data={{ hz, target }}>
    <Stats><Stat label="Target frequency" value={`${target} Hz`} accent /><Stat label="Your signal" value={`${hz} Hz`} /><Stat label="Experiments" value={experiments} /></Stats><StepDots total={rounds} current={round} />
    <svg className="wave-display" viewBox="0 0 300 110" role="img" aria-label={`Wave comparison. Your signal ${hz} hertz, target ${target} hertz.`}><path d={paths(target)} stroke="#7bdeff" fill="none" strokeWidth="2" opacity="0.4" /><path d={paths(hz, wave)} stroke="#caff66" fill="none" strokeWidth="2" /></svg>
    <label className="range-label"><span>Frequency<strong>{hz} Hz</strong></span><input type="range" min="100" max="1200" step="1" value={hz} aria-label="Frequency hertz" onChange={e => setHz(Number(e.target.value))} /></label>
    <label className="counter"><span>Waveform</span><select aria-label="Waveform" value={wave} onChange={e => setWave(e.target.value as 'sine' | 'triangle')}><option value="sine">Sine</option><option value="triangle">Triangle</option></select></label>
    <div className="game-actions"><Action secondary onClick={() => { audio.play([{ hz: target, at: 0, duration: 0.5 }, { hz, at: 0.8, duration: 0.5, wave }]); setNotice(save.settings.muted ? 'Sound is muted. The numeric and visual comparison still works.' : 'First the target, then your signal. Compare quietly at a comfortable device volume.'); }}>Compare sounds</Action><Action secondary onClick={audio.stop}>Stop sound</Action><Action onClick={test}>Test my signal</Action></div><Notice>{notice}</Notice>
    <div className="lab-note"><h3>Vibration is a separate channel</h3><p>Haptics send short on/off pulses to a supported device. They do not reproduce the tone’s hertz or provide therapy.</p><Action secondary disabled={!save.settings.haptics || !navigator.vibrate} onClick={() => { const accepted = navigator.vibrate([60, 100, 60, 100, 60]); setNotice(accepted ? 'Three gentle pulses requested. Device behavior may vary.' : 'This device did not accept vibration. The visual experiment still works.'); }}>Try gentle pulses</Action><p className="small muted">Enable gentle haptics in Settings. Unsupported devices keep the visual controls.</p></div>
  </GameLayout>;
}
