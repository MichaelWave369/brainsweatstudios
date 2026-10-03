import { courseById, lessonScore, type LessonRecord } from '../data/classes';
import { freshSave, recordResult, SAVE_KEY, validateSave } from './progress';
import type { Checkpoint, Difficulty, GameId, Json, SaveData, Settings } from '../data/types';
import { parseSessionKey, validSlot } from './checkpointValidation';
import { validateAcademy, type AcademySave } from '../training/models';
export const PROFILE_KEY = 'brain-sweat-studio:profiles:v2';
export interface Profile { id: string; label: string; save: SaveData }
interface Bundle { version: 2; active: string; profiles: Profile[] }
let bundle: Bundle | undefined;
let revision = 0;
let warning = '';
const listeners = new Set<() => void>();
const newId = () => globalThis.crypto?.randomUUID?.() || `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export function validateBundle(raw: unknown): Bundle {
  const b = raw as Bundle;
  if (!b || b.version !== 2 || !Array.isArray(b.profiles) || b.profiles.length < 1 || b.profiles.length > 6) throw new Error('Invalid local profiles.');
  const profiles = b.profiles.map(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(p.id) || typeof p.label !== 'string' || !p.label.trim() || p.label.length > 24) throw new Error('Invalid profile label.');
    return { id: p.id, label: p.label, save: validateSave(p.save) };
  });
  if (new Set(profiles.map(p => p.id)).size !== profiles.length || !profiles.some(p => p.id === b.active)) throw new Error('Invalid active profile.');
  return { version: 2, active: b.active, profiles };
}
export function getBundle(): Bundle {
  if (bundle) return bundle;
  let save = freshSave();
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      try { bundle = validateBundle(JSON.parse(saved)); return bundle; }
      catch {
        warning = 'A saved file could not be read. Import a backup in Settings if needed.';
        // Retain the unreadable bundle before a future save replaces it, and try the active-slot backup.
        try { localStorage.setItem(`${PROFILE_KEY}:recovery`, saved); } catch { /* Local saves can be unavailable. */ }
      }
    }
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy) save = validateSave(JSON.parse(legacy));
  } catch { warning = 'A saved file could not be read. Import a backup in Settings if needed.'; }
  const id = newId(); bundle = { version: 2, active: id, profiles: [{ id, label: 'Explorer 1', save }] };
  // Persist the slot identity before a player first joins online play. Otherwise
  // a reload before any game/settings mutation creates a different local slot.
  persist(false); return bundle;
}
export const currentProfile = () => { const b = getBundle(); return b.profiles.find(p => p.id === b.active)!; };
export const getRevision = () => revision;
export const getWarning = () => warning;
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function persist(notify = true) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(getBundle())); localStorage.setItem(SAVE_KEY, JSON.stringify(currentProfile().save)); }
  catch { warning = 'This browser cannot keep a local save right now. Keep playing and export your progress in Settings.'; }
  if (notify) { revision++; listeners.forEach(l => l()); }
}
export function commitSave(next: SaveData, notify = true) {
  const b = getBundle(); bundle = { ...b, profiles: b.profiles.map(p => p.id === b.active ? { ...p, save: next } : p) }; persist(notify);
}
export function finishMission(game: GameId, d: Difficulty, mission: number, score: number) {
  if (checkpoint(`${game}/${d}/${mission}`)?.botPractice) {
    clearCheckpoint(`${game}/${d}/${mission}`);
    return { save: currentProfile().save, xpGain: 0, bonus: 0, newlyCompleted: false, newBadges: [] as string[] };
  }
  const award = recordResult(currentProfile().save, game, d, mission, score);
  award.save.checkpoints = { ...award.save.checkpoints }; delete award.save.checkpoints[`${game}/${d}/${mission}`]; commitSave(award.save); return award;
}
export function updateSettings(settings: Partial<Settings>) { commitSave({ ...currentProfile().save, settings: { ...currentProfile().save.settings, ...settings } }); }
export function setDifficulty(difficulty: Difficulty) { commitSave({ ...currentProfile().save, difficulty, selectedDifficulty: true }); }
export function switchProfile(id: string) { const b = getBundle(); if (!b.profiles.some(p => p.id === id)) return; bundle = { ...b, active: id }; persist(); }
export function addProfile(label: string) {
  const b = getBundle(); if (b.profiles.length >= 6) throw new Error('All six local slots are in use.');
  const name = label.trim().slice(0, 24); if (!name) throw new Error('Choose a nickname for this slot.');
  const p = { id: newId(), label: name, save: freshSave() }; bundle = { version: 2, active: p.id, profiles: [...b.profiles, p] }; persist();
}
export function renameProfile(label: string) { const b = getBundle(); const name = label.trim().slice(0, 24); if (!name) return; bundle = { ...b, profiles: b.profiles.map(p => p.id === b.active ? { ...p, label: name } : p) }; persist(); }
export function importSave(raw: unknown) { commitSave(validateSave(raw)); }
export function resetProfile() { commitSave(freshSave()); }
export function clearWarning() { warning = ''; revision++; listeners.forEach(l => l()); }
export function checkpoint(key: string, profileId?: string): Checkpoint | undefined {
  if (!parseSessionKey(key)) return undefined;
  const profile = profileId ? getBundle().profiles.find(p => p.id === profileId) : currentProfile();
  return profile?.save.checkpoints[key];
}
export function writeCheckpoint(key: string, field: string, value: Json, profileId?: string) {
  const session = parseSessionKey(key);
  if (!session || profileId && profileId !== currentProfile().id || !validSlot(session.game, field, value, session.difficulty, session.mission)) return;
  const save = currentProfile().save; const previous = save.checkpoints[key];
  if (previous && JSON.stringify(previous.state[field]) === JSON.stringify(value)) return;
  const entry = { state: { ...previous?.state, [field]: value }, updatedAt: new Date().toISOString(), botPractice: previous?.botPractice || false };
  commitSave({ ...save, checkpoints: { ...save.checkpoints, [key]: entry } }, false);
}
export function markBotPractice(key: string) { if (!parseSessionKey(key)) return; const save = currentProfile().save; const previous = save.checkpoints[key]; commitSave({ ...save, checkpoints: { ...save.checkpoints, [key]: { state: previous?.state || {}, updatedAt: new Date().toISOString(), botPractice: true } } }, false); }
export function clearCheckpoint(key: string, notify = true) { const save = currentProfile().save; const checkpoints = { ...save.checkpoints }; delete checkpoints[key]; commitSave({ ...save, checkpoints }, notify); }

export function refreshProfiles() { revision++; listeners.forEach(l => l()); }

export function saveAcademy(value: AcademySave, profileId: string) {
  if (profileId !== currentProfile().id) return;
  commitSave({ ...currentProfile().save, academy: validateAcademy(value) }, false);
}

export function saveLesson(id:string,parameter:number,answers:number[],submit=false):LessonRecord {
 const course=courseById(id);if(!course||!Number.isFinite(parameter)||parameter<course.min||parameter>course.max||answers.length!==3||!answers.every((a,i)=>Number.isInteger(a)&&a>=-1&&a<course.questions[i].choices.length))throw new Error('Invalid class activity.');
 const save=currentProfile().save,previous=save.classes[id];const record={parameter,answers:[...answers],tested:submit,best:Math.max(previous?.best||0,submit?lessonScore(course,answers):0),attempts:(previous?.attempts||0)+(submit?1:0),date:submit?new Date().toISOString():previous?.date||''};commitSave({...save,classes:{...save.classes,[id]:record}},submit);return record;
}
