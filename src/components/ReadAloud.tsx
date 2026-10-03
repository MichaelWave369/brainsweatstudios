import { useEffect, useState } from 'react';
import { useStudio } from '../systems/StudioContext';
import Icon from './Icon';
const localVoices = () => typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices().filter(voice => voice.localService) : [];
export default function ReadAloud({ route }: { route: string }) {
  const { save } = useStudio(); const [voices, setVoices] = useState(localVoices); const [speaking, setSpeaking] = useState(false); const [notice, setNotice] = useState('');
  const voice = voices.find(v => v.lang.toLowerCase().startsWith(save.settings.locale));
  useEffect(() => { if (!('speechSynthesis' in window)) return; const changed = () => setVoices(localVoices()); window.speechSynthesis.addEventListener('voiceschanged', changed); return () => { window.speechSynthesis.removeEventListener('voiceschanged', changed); window.speechSynthesis.cancel(); }; }, []);
  useEffect(() => { window.speechSynthesis?.cancel(); setSpeaking(false); setNotice(''); }, [route, save.settings.locale, save.settings.muted]);
  function read() {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    if (!voice) { setNotice('No local voice is available for this language on this device.'); return; }
    const main = document.getElementById('main-content'); const text = main?.innerText.slice(0, 12000) || '';
    const utterance = new SpeechSynthesisUtterance(text); utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9; utterance.volume = 0.75;
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => { setSpeaking(false); setNotice('Reading stopped. The full text remains available.'); };
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); setSpeaking(true); setNotice('');
  }
  return <div className="reading-control"><button className="quiet-pill" aria-label={speaking ? 'Stop reading' : 'Read aloud'} disabled={save.settings.muted} onClick={read} title={voice ? 'On-device voices only. No microphone is used.' : 'No local voice is available for this language on this device.'}><Icon name="volume" size={17} /><span>{speaking ? 'Stop reading' : 'Read aloud'}</span></button>{notice && <span role="status" className="reading-notice">{notice}</span>}</div>;
}
