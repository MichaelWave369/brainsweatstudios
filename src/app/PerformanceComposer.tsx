import { useState } from 'react';
import { translate as t } from '../i18n/translate';
import { composeScore, performanceConfig } from '../performance/specs';
import { PERFORMANCE_MODES, type PerformanceMode } from '../performance/types';
import type { FamilyConfig } from '../families/types';

export default function PerformanceComposer({ seed, onConfig }: { seed: number; onConfig: (config: FamilyConfig) => void }) {
  const [mode, setMode] = useState<PerformanceMode>('choir'), [key, setKey] = useState(0), [bpm, setBpm] = useState(108), [meter, setMeter] = useState(4), [notice, setNotice] = useState('');
  const labels = { choir: 'Agent choir', band: 'Agent band', 'call-response': 'Call and response', composition: 'Eight-bar composition' };
  return <div className="performance-composer"><h3>{t('Original performance workshop')}</h3><p>{t('Choose a score, prepare the handoff, then run the ensemble. Controllers share one logical timeline.')}</p>
    <label>{t('Performance mode')}<select value={mode} onChange={e => setMode(e.target.value as PerformanceMode)}>{PERFORMANCE_MODES.map(m => <option key={m} value={m}>{t(labels[m])}</option>)}</select></label>
    <div className="performance-controls"><label>{t('Musical key')}<select value={key} onChange={e => setKey(Number(e.target.value))}>{['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'].map((k, i) => <option key={k} value={i}>{k}</option>)}</select></label>
      <label>{t('Tempo in BPM')}<input type="number" min={60} max={160} value={bpm} onChange={e => setBpm(Number(e.target.value))}/></label>
      <label>{t('Meter')}<select value={meter} onChange={e => setMeter(Number(e.target.value))}><option value={4}>4/4</option><option value={3}>3/4</option></select></label></div>
    <button className="btn secondary" onClick={() => { try { onConfig(performanceConfig(composeScore(mode, seed, key, bpm, meter), seed)); setNotice(t('Original score prepared. Prepare handoff to perform it.')); } catch (error) { setNotice(error instanceof Error ? error.message : 'Composition rejected.'); } }}>{t('Create original score')}</button>
    <p>{t('Eight original bars follow C–F–G-style chord relationships in the selected key. Call and response alternates phrase windows; no artist recordings or microphone are used.')}</p>
    {notice && <p role="status">{t(notice)}</p>}
  </div>;
}
