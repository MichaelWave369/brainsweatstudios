import { useState } from 'react';
import { clamp, difficultyIndex, money, type GameProps } from '../data/types';
import { Action, GameLayout, Notice, Stat, Stats, StepDots } from './shared';

interface Task { id: string; name: string; due: number; cost: number; info: string; autopay?: boolean }
export default function LifeAdmin({ difficulty, mission, paused, onFinish }: GameProps) {
  const d = difficultyIndex(difficulty); const duration = 8; const slots = [3, 2, 1][d]; const rent = 180 + mission * 5;
  const tasks: Task[] = [
    { id: 'statement', name: 'Check the bank statement', due: 2, cost: 0, info: 'Match payments with receipts. An unfamiliar charge needs independent checking.' },
    { id: 'rent', name: 'Pay the fictional apartment rent', due: 3, cost: rent, info: 'The fictional lease names the amount, due date, and a $10 late fee.', autopay: true },
    { id: 'trial', name: 'Cancel an unused trial', due: 4, cost: 0, info: 'The trial renews for $18 after day 4. Cancel before the renewal if you do not want it.' },
    { id: 'food', name: 'Buy planned pantry supplies', due: 4, cost: 35, info: 'Keep enough funds for this essential grocery plan.' },
    { id: 'phone', name: 'Pay the phone bill', due: 5, cost: 25, info: 'The bill is $25, with a $5 late fee in this game. Check the amount and date.', autopay: true },
    { id: 'appointment', name: 'Confirm next week’s appointment', due: 6, cost: 0, info: 'Save the date and time. Ask for a clear confirmation.' },
    { id: 'receipt', name: 'File a receipt and warranty', due: 7, cost: 0, info: 'Keep the receipt, warranty terms, and seller details together before they get lost.' },
  ];
  const [planning, setPlanning] = useState(true); const [schedule, setSchedule] = useState<Record<string, number>>({}); const [auto, setAuto] = useState<string[]>([]); const [day, setDay] = useState(1); const [cash, setCash] = useState([300, 280, 265][d] + mission * 5); const [used, setUsed] = useState(0); const [done, setDone] = useState<Record<string, number>>({}); const [log, setLog] = useState<string[]>([]); const [notice, setNotice] = useState('');
  function perform(task: Task) {
    const late = day > task.due ? task.id === 'rent' ? 10 : task.id === 'phone' ? 5 : 0 : 0; const cost = task.cost + late;
    if (cash < cost) { setNotice(`The account has ${money(cash)}, but this task needs ${money(cost)}. Check your other obligations and try the next task.`); return; }
    setCash(cash - cost); setDone({ ...done, [task.id]: day }); setUsed(used + 1); setLog([...log, `Day ${day}: ${task.name}${cost ? ` · paid ${money(cost)}` : ''}${late ? ` including ${money(late)} late fee` : ''}. ${task.info}`]); setNotice('');
  }
  function advance() {
    if (day === duration) { const complete = tasks.filter(t => done[t.id]); const onTime = complete.filter(t => done[t.id] <= t.due); const score = Math.round(clamp(complete.length / tasks.length * 40 + onTime.length / tasks.length * 40 + (cash >= 0 ? 10 : 0) + (done.trial && done.trial <= 4 ? 10 : 0))); onFinish({ score, summary: `You completed ${complete.length} of ${tasks.length} tasks, with ${onTime.length} handled by their deadline.`, lesson: 'A due date is different from the day you plan to act. Leave room for surprises, check renewal terms, keep records, and make sure autopay has enough funds. This fictional apartment is a practice model, not a real lease or bank account.', metrics: { 'On-time tasks': onTime.length, 'Account funds left': money(cash), 'Tasks still open': tasks.length - complete.length } }); return; }
    const nextDay = day + 1; let nextCash = cash; const nextDone = { ...done }; const notes: string[] = [];
    if (nextDay === 5 && (!done.trial || done.trial > 4)) { nextCash -= 18; notes.push('Day 5: The unused trial renewed for $18. The renewal date matters.'); }
    for (const task of tasks.filter(t => auto.includes(t.id) && t.due === nextDay && !nextDone[t.id])) {
      if (nextCash >= task.cost) { nextCash -= task.cost; nextDone[task.id] = nextDay; notes.push(`Day ${nextDay}: Autopay handled ${task.name} for ${money(task.cost)}.`); }
      else notes.push(`Day ${nextDay}: Autopay could not pay ${task.name}; the account needs more funds. It remains open.`);
    }
    setCash(nextCash); setDone(nextDone); setDay(nextDay); setUsed(0); setNotice(''); setLog([...log, ...notes]);
  }
  const plannedCount = (n: number) => Object.values(schedule).filter(v => v === n).length;
  return <GameLayout kind="admin" title={['The organized first week', 'A week with a renewal', 'Receipts and reminders', 'The busy calendar', 'One thing at a time'][mission]} description={`Plan an eight-day calendar for a fictional apartment. You have ${slots} manual action${slots === 1 ? '' : 's'} each day. Save cash for essentials and notice the trial’s renewal date.`} paused={paused}>
    <Stats><Stat label="Account funds" value={money(cash)} icon="wallet" accent /><Stat label="Calendar day" value={`${day}/8`} icon="calendar" /><Stat label="Actions left" value={slots - used} /></Stats><StepDots total={8} current={day - 1} />
    {planning ? <><h3>Put the responsibilities on your calendar</h3>{tasks.map(task => <div className="task-row" key={task.id}><div><strong>{task.name}</strong><small>Due day {task.due}{task.cost ? ` · ${money(task.cost)}` : ''}</small></div><select className="repair-select" aria-label={`Schedule ${task.name}`} value={schedule[task.id] || ''} onChange={e => setSchedule({ ...schedule, [task.id]: Number(e.target.value) })}><option value="">Pick day</option>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}</select></div>)}{Array.from({ length: 8 }, (_, i) => i + 1).some(n => plannedCount(n) > slots) && <Notice tone="warning">A planned day has more tasks than your daily action slots. Move some tasks earlier or be ready to adjust.</Notice>}<div className="game-actions"><Action disabled={Object.keys(schedule).length !== tasks.length} onClick={() => setPlanning(false)}>Launch my week</Action></div></> : <><h3>Day {day}: your life dashboard</h3>{tasks.map(task => <div className="task-row" key={task.id}><div><strong>{done[task.id] ? '✓ ' : ''}{task.name}</strong><small>{done[task.id] ? `Completed day ${done[task.id]}` : `Planned day ${schedule[task.id]} · due day ${task.due}${task.cost ? ` · ${money(task.cost)}` : ''}`}</small>{task.autopay && !done[task.id] && <label className="small" style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 9 }}><input type="checkbox" checked={auto.includes(task.id)} onChange={() => setAuto(auto.includes(task.id) ? auto.filter(id => id !== task.id) : [...auto, task.id])} />Autopay on the due date</label>}</div><button className="btn secondary" disabled={!!done[task.id] || used >= slots || day < schedule[task.id]} onClick={() => perform(task)}>{done[task.id] ? 'Done' : 'Do now'}</button></div>)}<Notice>{used >= slots ? 'Your action slots are used. Advance the calendar and continue tomorrow.' : 'Planned tasks become available on their scheduled day. Do essential tasks before their due date.'}</Notice>{notice && <Notice tone="warning">{notice}</Notice>}<div className="game-actions"><Action onClick={advance}>{day === 8 ? 'Review my week' : 'Advance to next day'}</Action></div><ul className="game-log">{log.map((line, i) => <li key={i}>{line}</li>)}</ul></>}
  </GameLayout>;
}
