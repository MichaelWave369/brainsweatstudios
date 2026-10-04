import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import ErrorBoundary from './components/ErrorBoundary';
import { StudioProvider } from './systems/StudioContext';
import { getBundle } from './systems/profiles';
import './styles/studio.css';

// Verify saved profiles before React schedules its first render. The browser's
// loaded page and the studio UI then share the same fully checked native state.
getBundle();
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><StudioProvider><App /></StudioProvider></ErrorBoundary></StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).catch(() => { console.warn('Offline installation is unavailable in this browser. Online play is still available.'); }); });
}
