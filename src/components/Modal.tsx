import { useEffect, useRef, type ReactNode } from 'react';
import Icon from './Icon';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); }; }, []);
  return <dialog ref={dialog} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-header"><h2 id="modal-title">{title}</h2><button aria-label="Close dialog" className="icon-button" onClick={onClose}><Icon name="close" /></button></div>{children}
  </dialog>;
}
