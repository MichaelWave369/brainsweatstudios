import { useMissionState } from '../systems/MissionSession';
import { useStudio } from '../systems/StudioContext';
import { noteFrequency, useLabAudio } from '../systems/labAudio';
import { difficultyIndex, clamp, type GameProps } from '../data/types';
import { Action, Counter, GameLayout, Notice, Stat, Stats } from './shared';
const briefs = [
  ['The first groove', 'Build a steady kick, a backbeat, and a melody with at least three pitches.'],
  ['Call and response', 'Let one bar ask a musical question and the next bar answer it. Leave room between phrases.'],
  ['The offbeat experiment', 'Move at least two drum hits off the main beats. Compare how the groove changes.'],
  ['A reusable phrase', 'Create a short phrase, copy it to the second bar, then change its ending.'],
  ['The melody arc', 'Build a rising and falling melody. Repetition and contrast can work together.'],
  ['The community stage', 'Compose a clear rhythm for a shared space. Try a quieter arrangement with musical rests.'],
  ['Less can be more', 'Make a sparse groove. Keep some steps silent and let each sound have space.'],
  ['Garden notebook soundtrack', 'Compose a soundtrack for observation. Music changes the mood of your project, not the plant-growth model.'],
];
const scale = [60, 62, 64, 65, 67, 69, 71]; const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export function compositionScore(beats: number[], notes: number[], mission: number, mode: number, listened: number) {
  const kick = beats.filter(v => v & 1).length; const snare = beats.filter(v => v & 2).length;
  const pitches = new Set(notes.filter(v => v >= 0)).size; const rests = notes.filter(v => v < 0).length;
  const offbeats = beats.filter((v, i) => v > 0 && i % 4 !== 0).length;
  const specificity = mission === 2 ? Math.min(1, offbeats / 2) : mission === 6 ? Math.min(1, rests / 8) : Math.min(1, rests / 4);
  return Math.round(clamp(Math.min(1, kick / 4) * 20 + Math.min(1, snare / 2) * 15 + Math.min(1, pitches / (3 + mode)) * 30 + specificity * 20 + Math.min(1, listened / 2) * 15));
}
export default function MusicMaker({ difficulty, mission, paused, onFinish }: GameProps) {
  const { save } = useStudio(); const d = difficultyIndex(difficulty);
  const [beats, setBeats] = useMissionState('beats', Array<number>(16).fill(0)); const [notes, setNotes] = useMissionState('notes', Array<number>(16).fill(-1));
  const [tempo, setTempo] = useMissionState('tempo', 100); const [listened, setListened] = useMissionState('listened', 0); const [edits, setEdits] = useMissionState('edits', 0); const [notice, setNotice] = useMissionState('notice', 'Create two bars of music. Listening is optional: the performance meter also works silently.');
  const audio = useLabAudio(paused, save.settings);
  function perform() {
    const unit = 60 / tempo / 2; const events = beats.flatMap((beat, i) => [ ...(beat & 1 ? [{ hz: 100, at: i * unit, duration: 0.12, wave: 'sine' as const }] : []), ...(beat & 2 ? [{ hz: 180, at: i * unit, duration: 0.06, wave: 'triangle' as const }] : []), ...(notes[i] >= 0 ? [{ hz: noteFrequency(scale[notes[i]]), at: i * unit, duration: unit * 0.75 }] : []) ]);
    const audible = audio.play(events); setListened(listened + 1); setNotice(audible ? 'Your phrase is playing. Listen for space, repetition, and the melody’s shape.' : 'Silent performance checked. You can see every beat and pitch without needing sound.');
  }
  const score = compositionScore(beats, notes, mission, d, listened);
  return <GameLayout kind="music" title={briefs[mission][0]} description={briefs[mission][1]} paused={paused} data={{ notes, beats, tempo }}>
    <Stats><Stat label="Unique pitches" value={new Set(notes.filter(v => v >= 0)).size} accent /><Stat label="Performances" value={listened} /><Stat label="Creative edits" value={edits} /></Stats>
    <Notice>Two bars, sixteen steps. Tap drum pads; choose a pitch or a rest. Start with a pattern, then make it your own.</Notice>
    <div className="music-steps" aria-label="Music sequencer">{beats.map((beat, i) => <div className="music-step" key={i}><span>{i + 1}</span><button aria-label={`Kick step ${i + 1}`} aria-pressed={!!(beat & 1)} onClick={() => { setBeats(beats.map((v, n) => n === i ? v ^ 1 : v)); setEdits(edits + 1); }}>Kick</button><button aria-label={`Snare step ${i + 1}`} aria-pressed={!!(beat & 2)} onClick={() => { setBeats(beats.map((v, n) => n === i ? v ^ 2 : v)); setEdits(edits + 1); }}>Snare</button><select aria-label={`Pitch step ${i + 1}`} value={notes[i]} onChange={e => { setNotes(notes.map((v, n) => n === i ? Number(e.target.value) : v)); setEdits(edits + 1); }}><option value={-1}>Rest</option>{names.map((n, pitch) => <option key={n} value={pitch}>{n}</option>)}</select></div>)}</div>
    <Counter label="Tempo BPM" value={tempo} min={80} max={160} step={10} onChange={setTempo} />
    <div className="game-actions"><Action secondary onClick={() => { setBeats(Array.from({ length: 16 }, (_, i) => i % 4 === 0 ? 1 : i % 4 === 2 ? 2 : 0)); setNotes([0, -1, 2, -1, 4, -1, 3, -1, 0, -1, 1, -1, 5, -1, 4, -1]); setEdits(edits + 1); }}>Load a starting pattern</Action><Action secondary onClick={() => { setBeats([...beats.slice(0, 8), ...beats.slice(0, 8)]); setNotes([...notes.slice(0, 8), ...notes.slice(0, 8)]); setEdits(edits + 1); }}>Copy first bar</Action><Action onClick={perform}>Perform my phrase</Action><Action secondary onClick={audio.stop}>Stop sound</Action></div>
    <Notice>{notice}</Notice><p className="small muted">Perform twice and make at least one change to the starting pattern before saving.</p><p className="small muted">Keep device volume comfortable. Sound is never required. This score measures the mission’s musical constraints, not whether your taste is right or wrong.</p>
    <Action disabled={listened < 2 || edits < 2} onClick={() => { audio.stop(); onFinish({ score, summary: `You composed a two-bar phrase at ${tempo} BPM and tested it ${listened} times.`, lesson: 'Rhythm organizes time. Pitch describes how high or low a note sounds. Repetition, silence, and variation all shape a composition. A soundtrack is a creative choice, not a treatment or a plant-growth tool.', metrics: { 'Unique pitches': new Set(notes.filter(v => v >= 0)).size, 'Performances': listened, 'Creative edits': edits } }); }}>Save my composition</Action>
  </GameLayout>;
}
