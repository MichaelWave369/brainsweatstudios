import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Json } from '../data/types';
import { checkpoint, currentProfile, writeCheckpoint } from './profiles';
import { parseSessionKey, validSlot } from './checkpointValidation';
const Session = createContext<{ key: string; profileId: string } | null>(null);
export function MissionSession({ sessionKey, children }: { sessionKey: string; children: ReactNode }) {
  // Keep the owner fixed until this session unmounts, including effects queued before a profile switch.
  const [profileId] = useState(() => currentProfile().id);
  return <Session.Provider value={{ key: sessionKey, profileId }}>{children}</Session.Provider>;
}
export function useMissionState<T>(field: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const session = useContext(Session); const key = session?.key || ''; const profileId = session?.profileId;
  const [value, setValue] = useState<T>(() => {
    const fallback = initial instanceof Function ? initial() : initial;
    const saved = key ? checkpoint(key, profileId)?.state[field] : undefined;
    if (field === 'running') return fallback;
    const details = parseSessionKey(key);
    if (!details || saved === undefined || !validSlot(details.game, field, saved, details.difficulty, details.mission)) return fallback;
    if (fallback !== null && (Array.isArray(fallback) !== Array.isArray(saved) || typeof fallback !== typeof saved)) return fallback;
    return saved as T;
  });
  useEffect(() => { if (key) { const serialized = JSON.parse(JSON.stringify(value)) as Json; writeCheckpoint(key, field, serialized, profileId); } }, [key, field, value, profileId]);
  return [value, setValue];
}
