import { useEffect, useRef, useState } from 'react';
import type { FamilyReceipt } from '../families/types';
import { translate as t } from '../i18n/translate';
import { parseJSON } from '../runtime/data';
import { defaultRenderSettings, scoreFromReceipt, validateBundle, validateVoice, voicesForScore } from '../performance/specs';
import type { renderPerformance } from '../performance/render';
import type { PerformanceBundle, VoiceProfile } from '../performance/types';

type Rendered = Awaited<ReturnType<typeof renderPerformance>>;
function download(name: string, value: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PerformancePanel({ receipt, muted, onReview }: { receipt: FamilyReceipt; muted: boolean; onReview: (text: string) => void }) {
  const [bundle, setBundle] = useState<PerformanceBundle>(() => validateBundle({ schema: 'performance-bundle@1', performance: receipt, voices: voicesForScore(scoreFromReceipt(receipt)), settings: defaultRenderSettings() }));
  const [result, setResult] = useState<Rendered | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [review, setReview] = useState(''), [playing, setPlaying] = useState(false);
  const worker = useRef<Worker | null>(null), audio = useRef<HTMLAudioElement | null>(null), epoch = useRef(0), alive = useRef(true), url = useRef('');
  const score = scoreFromReceipt(bundle.performance);
  const cancel = () => { epoch.current++; worker.current?.terminate(); worker.current = null; audio.current?.pause(); setBusy(false); setPlaying(false); };
  useEffect(() => {
    alive.current = true;
    const hidden = () => { if (document.hidden) { epoch.current++; worker.current?.terminate(); worker.current = null; audio.current?.pause(); setBusy(false); setPlaying(false); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { alive.current = false; epoch.current++; worker.current?.terminate(); audio.current?.pause(); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!result) return;
    const next = URL.createObjectURL(new Blob([result.wav.slice().buffer], { type: 'audio/wav' }));
    url.current = next;
    return () => { audio.current?.pause(); URL.revokeObjectURL(next); if (url.current === next) url.current = ''; };
  }, [result]);
  useEffect(() => { if (muted) { audio.current?.pause(); } }, [muted]);
  const render = () => {
    cancel(); setNotice(''); const generation = epoch.current;
    try {
      const next = new Worker(new URL('../performance/render.worker.ts', import.meta.url), { type: 'module' });
      worker.current = next; setBusy(true);
      next.onmessage = (event: MessageEvent<{ ok: boolean; result: Rendered; error?: string }>) => {
        if (!alive.current || generation !== epoch.current || document.hidden) return;
        next.terminate(); worker.current = null; setBusy(false);
        if (event.data.ok) { setResult(event.data.result); setNotice('Audio rendered locally. Score replay verified.'); }
        else setNotice(event.data.error || 'Local render failed.');
      };
      next.onerror = () => { if (alive.current && generation === epoch.current) { next.terminate(); worker.current = null; setBusy(false); setNotice('Local audio worker failed.'); } };
      next.postMessage(validateBundle(bundle));
    } catch (error) { cancel(); setNotice(error instanceof Error ? error.message : 'Local render failed.'); }
  };
  const changeVoice = (voice: VoiceProfile, key: keyof VoiceProfile, value: number | string) => {
    try { const replacement = validateVoice({ ...voice, [key]: value }); cancel(); setResult(null); setBundle({ ...bundle, voices: bundle.voices.map(v => v.id === voice.id ? replacement : v) }); setNotice(''); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Voice rejected.'); }
  };
  const importBundle = async (file?: File) => {
    if (!file) return;
    const generation = epoch.current;
    try {
      if (file.size > 1250000) throw new Error('Performance file exceeds the import limit.');
      const next = validateBundle(parseJSON(await file.text(), 1250000));
      if (!alive.current || generation !== epoch.current) return;
      cancel(); setResult(null); setBundle(next); setNotice('Performance imported and replay verified. Playback is stopped.');
    } catch (error) { if (alive.current && generation === epoch.current) setNotice(error instanceof Error ? error.message : 'Performance rejected.'); }
  };
  return <section className="academy-panel performance-panel" aria-labelledby="performance-title"><span className="eyebrow">{t('ORIGINAL SYNTHETIC PERFORMANCE')}</span><h2 id="performance-title">{t('Performance listening room')}</h2>
    <h3>{score.title}</h3><p>{t('Listen to the recorded actions, including mistakes. Mechanical accuracy and your listening review are separate.')}</p>
    <div className="performance-score-strip" aria-label={t('Score parts')}>{score.parts.map(part => <span key={part.id}>{part.id} · {part.notes.length} {t('notes')}</span>)}</div>
    <details><summary>{t('Synthetic voice profiles')}</summary><p>{t('Fictional vowel voices are parameters, not recordings of people. Export the performance bundle to keep your chosen profiles.')}</p>
      {bundle.voices.map(voice => <fieldset key={voice.id}><legend>{voice.id}</legend><div className="performance-controls">
        <label>{t('Timbre')}<select value={voice.timbre} onChange={e => changeVoice(voice, 'timbre', e.target.value)}>{['round', 'bright', 'airy'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></label>
        {(['brightness', 'breathiness', 'vibratoDepth', 'pan'] as const).map(key => <label key={key}>{t(({ brightness: 'Brightness', breathiness: 'Breathiness', vibratoDepth: 'Vibrato depth', pan: 'Stereo position' })[key])}<input aria-label={t(({ brightness: 'Brightness', breathiness: 'Breathiness', vibratoDepth: 'Vibrato depth', pan: 'Stereo position' })[key])} type="range" min={key === 'pan' ? -1 : 0} max={key === 'breathiness' ? 0.3 : key === 'vibratoDepth' ? 0.5 : 1} step={0.01} value={voice[key]} onChange={e => changeVoice(voice, key, Number(e.target.value))}/><output>{voice[key].toFixed(2)}</output></label>)}
      </div></fieldset>)}
      <pre tabIndex={0}>{JSON.stringify(bundle.voices, null, 2)}</pre></details>
    <div className="button-row"><button className="btn primary" disabled={busy} onClick={render}>{t('Render local audio')}</button><button className="btn secondary" disabled={!busy && !playing} onClick={cancel}>{t('Stop audio')}</button>
      <button className="btn secondary" disabled={!result || busy || muted || playing} onClick={() => { if (!audio.current || !url.current) return; const generation=epoch.current; audio.current.src = url.current; audio.current.muted = muted; void audio.current.play().then(() => { if (alive.current && generation===epoch.current && !document.hidden) setPlaying(true); else audio.current?.pause(); }).catch(() => {if(alive.current&&generation===epoch.current)setNotice('Audio playback is unavailable in this browser. Export WAV to listen locally.');}); }}>{t('Play recorded performance')}</button>
      <button className="btn secondary" disabled={!result || busy} onClick={() => download('brain-sweat-performance.wav', result!.wav.slice().buffer, 'audio/wav')}>{t('Export WAV')}</button>
      <button className="btn secondary" disabled={!result || busy} onClick={() => download('brain-sweat-performance.mid', result!.midi.slice().buffer, 'audio/midi')}>{t('Export MIDI')}</button></div>
    <audio ref={audio} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)}/>
    {muted && <p>{t('Studio sound is muted. Enable sound in the studio controls to play audio.')}</p>}
    {result && <><svg viewBox="0 0 600 110" role="img" aria-label={t('Rendered stereo amplitude envelope')}>{result.peaks.map((peak, i) => <rect key={i} x={i * 6.25} y={55 - peak * 50} width={4} height={Math.max(1, peak * 100)} fill="currentColor"/>)}</svg><p>{t('Duration')}: {result.duration.toFixed(2)} s · {bundle.settings.sampleRate} Hz · {t('Stereo WAV')}</p>
      <details><summary>{t('Audio render receipt')}</summary><p>{t('Score replay proves the simulation. The audio hash identifies these exported bytes; another engine may render different samples.')}</p><pre tabIndex={0}>{JSON.stringify(result.receipt, null, 2)}</pre><button className="btn secondary" onClick={() => download('brain-sweat-audio-receipt.json', JSON.stringify(result.receipt, null, 2), 'application/json')}>{t('Export audio receipt')}</button></details></>}
    <div className="button-row"><button className="btn secondary" onClick={() => download('brain-sweat-performance-bundle.json', JSON.stringify(bundle, null, 2), 'application/json')}>{t('Export performance bundle')}</button><button className="btn secondary" onClick={() => download('brain-sweat-original-score.json', JSON.stringify(score, null, 2), 'application/json')}>{t('Export original score')}</button><label className="btn secondary import-button">{t('Import performance bundle')}<input type="file" accept=".json,application/json" aria-label={t('Import performance bundle')} onChange={e => { void importBundle(e.target.files?.[0]); e.target.value = ''; }}/></label></div>
    <label>{t('Human listening review')}<textarea value={review} maxLength={80} onChange={e => setReview(e.target.value)} placeholder={t('What did you hear?')}/></label><button className="btn secondary" disabled={!review.trim() || bundle.performance.digest !== receipt.digest} onClick={() => { try { onReview(`Listening review: ${review.trim()}`); setReview(''); setNotice('Listening review saved as an episode note.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Review rejected.'); } }}>{t('Save listening review')}</button>
    <p>{t('Playback starts only when requested. Hidden pages stop playback and rendering. No microphone, account, cloud model or upload is required.')}</p><p role="status">{busy ? t('Rendering original audio locally…') : t(notice)}</p>
  </section>;
}
