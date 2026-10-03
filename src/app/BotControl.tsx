import { useEffect, useRef, useState } from 'react';
import type { Difficulty, GameId } from '../data/types';
import { applyBotStep, botPlan, fieldBotStep, type BotStep } from '../systems/bots';
export default function BotControl({ game, difficulty, mission, paused, practice, onPractice, auto = false }: { game: GameId; difficulty: Difficulty; mission: number; paused: boolean; practice: boolean; onPractice: () => void; auto?: boolean }) {
  const [running, setRunning] = useState(auto); const [message, setMessage] = useState('Guided bots demonstrate an authored strategy. You can take control at any time.'); const [speed, setSpeed] = useState(450);
  const plan = useRef<BotStep[]>([]); const cursor = useRef(0); const ready = useRef(false); const failures = useRef(0); const actionCount = useRef(0);
  const startPractice = useRef(onPractice); startPractice.current = onPractice;
  useEffect(() => { let cancelled = false; ready.current = false; failures.current = 0; actionCount.current = 0; if (auto) startPractice.current(); void botPlan(game, difficulty, mission).then(steps => { if (!cancelled) { plan.current = steps; cursor.current = 0; ready.current = true; } }); return () => { cancelled = true; }; }, [game, difficulty, mission, auto]);
  function step() {
    if (!ready.current || paused || document.hidden) return;
    const controls = document.querySelector('.game-controls'); if (!controls) return;
    if (actionCount.current >= 220) { setRunning(false); setMessage('The bot stopped at its action limit. Take control or restart the practice.'); return; }
    const next = plan.current[cursor.current];
    if (!next) { const field = fieldBotStep(controls); if (field) { actionCount.current++; setMessage(field); failures.current = 0; } else { failures.current++; if (failures.current > 60) { setRunning(false); setMessage('The bot is waiting for a result. Take control if the mission needs another decision.'); } } return; }
    const applied = applyBotStep(next, controls); setMessage(next.label);
    if (applied) { cursor.current++; failures.current = 0; actionCount.current++; }
    else { failures.current++; if (failures.current > 12) { setRunning(false); setMessage('The planned control is unavailable. Take control to inspect this state.'); } }
  }
  const tick = useRef(step); tick.current = step;
  useEffect(() => { if (!running || paused) return; const timer = setInterval(() => tick.current(), speed); return () => clearInterval(timer); }, [running, paused, speed]);
  const begin = () => { onPractice(); setRunning(true); };
  return <div className="bot-control" role="region" aria-label="Optional guided bot"><div><strong>{practice ? 'Bot practice' : 'Optional guided bot'}</strong><p>Bot practice does not change XP, badges, or streaks.</p></div><div className="game-actions"><button className="btn secondary" disabled={paused || running} onClick={() => { onPractice(); step(); }}>Demonstrate next move</button><button className="btn secondary" disabled={paused || running} onClick={begin}>Watch bot play</button><button className="btn primary" disabled={!running} onClick={() => setRunning(false)}>Take control</button><label className="counter"><span>Bot speed</span><select aria-label="Bot speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={450}>Observe</option><option value={120}>Fast simulation</option></select></label></div><p className="small" role="status">{message}</p></div>;
}
