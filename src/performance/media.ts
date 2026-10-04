import type { FamilyMachine, FamilyPublicInput } from '../families/types.ts';
import { clone, hash } from '../runtime/data.ts';
import { validateScore } from '../families/specs.ts';

// Explicit V11 wrapper; legacy media receipts use the unchanged V10 machines.
// Admission already checked creator evidence in the career boundary. Here the
// score supplies a concrete cue target and travels in the native transition hash.
export function scoredMediaMachine(base: FamilyMachine, inputs: Record<string, FamilyPublicInput>): FamilyMachine {
  const scores = [...new Map(Object.values(inputs).flatMap(input => input.artifacts.filter(a => a.type === 'music-score').map(a => [a.contentHash, validateScore(a.content)] as const))).entries()];
  const cues: { tick: number; role: string; scoreHash: string; beat: number; title: string }[] = [];
  let tick = 0;
  return {
    roles: base.roles,
    legal: role => base.legal(role),
    observe: role => ({ ...base.observe(role), musicScores: scores.map(([scoreHash, score]) => ({ scoreHash, title: score.title, beats: score.bars * score.meter })) }),
    advance(intents) {
      const events = base.advance(intents); tick++;
      for (const [role, action] of Object.entries(intents)) if (['music-cue', 'original-music'].includes(action)) for (const [scoreHash, score] of scores) {
        const beat = (tick - 1) % (score.bars * score.meter);
        cues.push({ tick, role, scoreHash, beat, title: score.title });
        events.push(`Original score cue ${scoreHash} at beat ${beat}.`);
      }
      return events;
    },
    result() { const r = base.result(); return { ...r, measures: { ...r.measures, scoreReferences: scores.length, scoredCues: cues.length }, public: { ...r.public, musicCues: clone(cues), musicScores: scores.map(([scoreHash, score]) => ({ scoreHash, score: clone(score) })) } }; },
    stateHash: () => hash({ schema: 'scored-media@1', base: base.stateHash(), tick, scores, cues }),
    outputs: actor => base.outputs(actor),
  };
}
