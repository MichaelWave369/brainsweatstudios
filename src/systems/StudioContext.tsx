import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { freshSave, recordResult, SAVE_KEY, validateSave } from './progress';
import type { Difficulty, GameId, SaveData, Settings } from '../data/types';

function readInitial() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return { save: validateSave(JSON.parse(raw)), warning: '' }; }
  catch { return { save: freshSave(), warning: 'Your saved progress could not be read. Export or import a backup in Settings. New progress is safe to play.' }; }
  return { save: freshSave(), warning: '' };
}
interface StudioContextValue {
  save: SaveData; warning: string; setDifficulty: (d: Difficulty) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  finish: (game: GameId, d: Difficulty, mission: number, score: number) => ReturnType<typeof recordResult>;
  importSave: (raw: unknown) => void; reset: () => void; clearWarning: () => void;
}
const StudioContext = createContext<StudioContextValue | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(readInitial, []);
  const [save, setSave] = useState(initial.save);
  const [warning, setWarning] = useState(initial.warning);
  function commit(next: SaveData) {
    setSave(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); }
    catch { setWarning('This browser cannot keep a local save right now. You can keep playing and export your progress in Settings.'); }
  }
  function finish(game: GameId, d: Difficulty, mission: number, score: number) { const result = recordResult(save, game, d, mission, score); commit(result.save); return result; }
  return <StudioContext.Provider value={{ save, warning, finish, setDifficulty: d => commit({ ...save, difficulty: d, selectedDifficulty: true }), updateSettings: settings => commit({ ...save, settings: { ...save.settings, ...settings } }), importSave: raw => commit(validateSave(raw)), reset: () => commit(freshSave()), clearWarning: () => setWarning('') }}>{children}</StudioContext.Provider>;
}
export function useStudio() { const studio = useContext(StudioContext); if (!studio) throw new Error('StudioProvider is missing.'); return studio; }
