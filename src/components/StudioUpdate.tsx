import { useEffect, useState } from 'react';

export default function StudioUpdate() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    const worker = navigator.serviceWorker;
    const checkVersion = () => {
      const assets = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[type="module"][src], link[rel="stylesheet"][href]'), element => element instanceof HTMLScriptElement ? element.src : element.href);
      if (assets.length) worker.controller?.postMessage({ type: 'STUDIO_CHECK_VERSION', assets });
    };
    const receive = (event: MessageEvent) => {
      if (!disposed && event.source === worker.controller && event.data?.type === 'STUDIO_UPDATE_STATUS' && typeof event.data.current === 'boolean') setAvailable(!event.data.current);
    };
    const checkUpdates = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void worker.getRegistration(import.meta.env.BASE_URL).then(registration => registration?.update()).catch(() => { /* Offline play keeps the last installed version. */ });
    };
    worker.addEventListener('message', receive);
    worker.addEventListener('controllerchange', checkVersion);
    document.addEventListener('visibilitychange', checkUpdates);
    window.addEventListener('online', checkUpdates);
    checkVersion();
    void worker.ready.then(() => { if (!disposed) checkVersion(); });
    return () => {
      disposed = true;
      worker.removeEventListener('message', receive);
      worker.removeEventListener('controllerchange', checkVersion);
      document.removeEventListener('visibilitychange', checkUpdates);
      window.removeEventListener('online', checkUpdates);
    };
  }, []);
  return available ? <div className="studio-update" role="status"><p>A new studio update is ready.</p><button className="btn primary" onClick={() => window.location.reload()}>Refresh studio</button></div> : null;
}
