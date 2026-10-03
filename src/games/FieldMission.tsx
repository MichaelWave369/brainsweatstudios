import type { GameProps, GameResult } from '../data/types';
import { difficultyIndex, clamp } from '../data/types';
import { fieldMissions } from '../data/fieldMissions';
import { useMissionState } from '../systems/MissionSession';
import { Action, GameLayout, Notice, Stat, Stats, StepDots } from './shared';
export default function FieldMission({ game, base, difficulty, mission, paused, onFinish }: GameProps & { game: string; base: GameResult }) {
  const brief = fieldMissions[game as keyof typeof fieldMissions]![mission - 5]; const d = difficultyIndex(difficulty);
  const [extensionStep, setStep] = useMissionState('extensionStep', 0); const [resources, setResources] = useMissionState('fieldResources', 5 + Math.floor(base.score / 30) - d); const [time, setTime] = useMissionState('fieldTime', 6); const [trust, setTrust] = useMissionState('fieldTrust', 2); const [learning, setLearning] = useMissionState('fieldLearning', 0); const [waiting, setWaiting] = useMissionState('extensionWaiting', false); const [feedback, setFeedback] = useMissionState('extensionFeedback', ''); const [history, setHistory] = useMissionState<string[]>('extensionHistory', []);
  const choices = extensionStep === 0 ? [
    { text: 'Start with a small reusable plan', cost: 1, hours: 1, trust: 1, learning: 2, note: 'A small test preserves resources and gives evidence for the next decision.' },
    { text: 'Invest in a bigger test with clear limits', cost: 3, hours: 2, trust: 2, learning: 3, note: 'A larger test offers more evidence, but it uses resources you may need later.' },
    { text: 'Promise an immediate perfect outcome', cost: 0, hours: 0, trust: -2, learning: 0, note: 'A promise cannot replace evidence. It raises expectations without checking what is possible.' },
  ] : extensionStep === 1 ? [
    { text: 'Share resources and test a small step', cost: 0, hours: 2, trust: 2, learning: 2, note: 'Sharing appropriate resources and testing a change keeps the plan realistic.' },
    { text: 'Pay for a faster supported alternative', cost: 3, hours: 1, trust: 1, learning: 2, note: 'Speed saves time here, but spending more leaves less room for the final handoff.' },
    { text: 'Ignore the change and keep the promise', cost: 0, hours: 0, trust: -2, learning: 0, note: 'The situation changed. A plan that ignores it can miss needs or safety boundaries.' },
  ] : [
    { text: 'Explain the evidence and agree on a check-in', cost: 0, hours: 1, trust: 2, learning: 2, note: 'Clear evidence, limits, and a next check-in make the handoff useful.' },
    { text: 'Ask a trusted helper to review the plan', cost: 1, hours: 1, trust: 2, learning: 2, note: 'An appropriate helper can catch an assumption and support the next step.' },
    { text: 'Say it is solved without explaining limits', cost: 0, hours: 0, trust: -2, learning: 0, note: 'A confident label does not communicate the plan or its limits.' },
  ];
  return <GameLayout kind={game} title={brief.title} description="Base mission complete. Now respond to a changing situation." paused={paused}>
    <Stats><Stat label="Resources" value={resources} accent /><Stat label="Time left" value={time} /><Stat label="Trust" value={trust} /></Stats><StepDots total={3} current={extensionStep} /><div className="event-card"><span className="eyebrow">Field mission</span><h3>{[brief.situation, brief.change, brief.reflection][extensionStep]}</h3></div>
    {!waiting ? <div className="dialogue-choices">{choices.map(choice => <button key={choice.text} disabled={resources < choice.cost || time < choice.hours} onClick={() => { setResources(resources - choice.cost); setTime(time - choice.hours); setTrust(Math.max(0, trust + choice.trust)); setLearning(learning + choice.learning); setFeedback(choice.note); setHistory([...history, choice.text]); setWaiting(true); }}><strong>{choice.text}</strong><small>{choice.cost} resources · {choice.hours} time</small></button>)}</div> : <><Notice>{feedback}</Notice><Action onClick={() => { if (extensionStep < 2) { setStep(extensionStep + 1); setWaiting(false); } else { const fieldScore = clamp(learning / 6 * 45 + trust / 7 * 40 + Math.min(1, resources / 2) * 15); onFinish({ score: Math.round(base.score * 0.65 + fieldScore * 0.35), summary: `${brief.title}: you completed the original simulation and adapted your plan through three connected decisions.`, lesson: `${base.lesson} The field mission adds a second skill: notice when conditions change, use resources realistically, and explain what the next person needs to know.`, metrics: { 'Base score': base.score, 'Field score': Math.round(fieldScore), 'Resources left': resources, 'Trust built': trust } }); } }}>{extensionStep < 2 ? 'Continue field mission' : 'Finish field mission'}</Action></>}
    <ul className="game-log">{history.map((line, i) => <li key={i}>{line}</li>)}</ul>
  </GameLayout>;
}
