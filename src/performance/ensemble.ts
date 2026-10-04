import { beatTime } from '../families/ensemble.ts';
import type { FamilyConfig, FamilyMachine, PerformanceEvent } from '../families/types.ts';
import { clone, hash } from '../runtime/data.ts';
import { validatePerformanceScore } from './specs.ts';

/** Versioned authority: no wall clock, audio device or provider completion order. */
export function performanceMachine(config: FamilyConfig): FamilyMachine {
  const score = validatePerformanceScore(config.score), end = score.bars * score.meter;
  const roles = ['conductor', ...score.parts.map(p => p.id)], active = new Set<string>();
  const levels = Object.fromEntries(score.parts.map(p => [p.id, 76]));
  let tick = 0, beat = 0, started = false, complete = false, correct = 0, missed = 0, cueErrors = 0;
  const events: PerformanceEvent[] = [];
  const partCompletion = Object.fromEntries(score.parts.map(p => [p.id, 0]));
  const cueEvent = (part: string, kind: 'entry' | 'cutoff' | 'dynamics', velocity: number): PerformanceEvent => ({ beat, timeMs: beatTime(score, beat), role: part, kind, pitch: 0, duration: 0, velocity, syllable: '' });
  return {
    roles,
    observe(role) {
      const part = score.parts.find(p => p.id === role);
      return { authority: 'ensemble-authority@2', role, title: score.title, beat, end, timeMs: beatTime(score, beat), tempo: score.tempo.filter(t => t.beat <= beat).at(-1)!.bpm,
        started, active: active.has(role), part: part ? clone(part) : null, target: clone(part?.notes.find(n => n.beat === beat) ?? null),
        cues: clone(score.cues.filter(c => c.beat === beat && !(started && beat === 0 && c.type === 'entry'))), chord: clone(score.chords.filter(c => c.beat <= beat).at(-1)!), dynamics: levels[role] ?? 76 };
    },
    legal(role) { return role === 'conductor' ? ['wait', 'entry', 'conduct', 'dynamics', 'cutoff'] : ['rest', 'play-target', 'play-low', 'play-high']; },
    advance(intents) {
      tick++;
      const log: string[] = [], cues = score.cues.filter(c => c.beat === beat && !(started && beat === 0 && c.type === 'entry')), expected = cues[0]?.type;
      const acceptedCue = expected && intents.conductor === expected;
      if (expected && !acceptedCue) cueErrors++;
      if (acceptedCue) for (const cue of cues) {
        if (cue.type === 'entry') { active.add(cue.part); levels[cue.part] = cue.level; }
        if (cue.type === 'cutoff') active.delete(cue.part);
        if (cue.type === 'dynamics') levels[cue.part] = cue.level;
        events.push(cueEvent(cue.part, cue.type, cue.level));
      }
      if (!started) {
        if (acceptedCue && expected === 'entry') { started = true; log.push('Conductor opened the score on the next logical turn.'); }
        return log;
      }
      if (beat === end) {
        if (acceptedCue && expected === 'cutoff') { complete = true; log.push('Final conductor cutoff completed the performance.'); }
        return log;
      }
      for (const part of score.parts) {
        const note = part.notes.find(n => n.beat === beat), action = intents[part.id], sounding = !!note && active.has(part.id);
        if (sounding && action === 'play-target') { correct++; partCompletion[part.id]++; }
        else if (sounding || action !== 'rest') missed++;
        if (action !== 'rest' && active.has(part.id)) {
          events.push({ beat, timeMs: beatTime(score, beat), role: part.id, kind: 'note', pitch: (note?.pitch ?? 60) + (action === 'play-low' ? -2 : action === 'play-high' ? 2 : 0), duration: note?.duration ?? 1, velocity: levels[part.id], syllable: note?.syllable ?? '' });
        } else events.push({ beat, timeMs: beatTime(score, beat), role: part.id, kind: 'rest', pitch: 0, duration: 1, velocity: 0, syllable: '' });
      }
      beat++;
      return log;
    },
    result() {
      const total = score.parts.reduce((n, p) => n + p.notes.length, 0);
      return { terminal: complete, success: complete && missed === 0 && cueErrors === 0,
        measures: { pitchAccuracy: total ? correct / total : 0, noteCompletion: correct, timingErrors: missed, cueErrors, synchrony: Number(complete && cueErrors === 0), parts: score.parts.length },
        public: { score: clone(score), events: clone(events), beat, partCompletion: clone(partCompletion), review: 'Mechanical checks only. Listening review is separate.' } };
    },
    stateHash() { return hash({ engine: 'ensemble-authority@2', tick, beat, started, complete, correct, missed, cueErrors, levels, events, partCompletion, active: [...active].sort() }); },
    outputs(actor) { return complete ? [{ actor, type: 'music-score', content: clone(score), contentHash: hash(score) }] : []; },
  };
}
