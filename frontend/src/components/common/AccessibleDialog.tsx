import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mountDialog } from '../../lib/modalLifecycle';
import { FeedbackMessages } from '../../context/FeedbackMessages';
import { mountDialogViewport } from '../../lib/dialogViewport';

/** Full editors and confirmations share one stack for focus, Escape and inert state. */
export const AccessibleDialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; className?: string; busy?: boolean }> = ({ title, onClose, children, className, busy = false }) => {
  const layer = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const unwatch = mountDialogViewport(layer.current!);
    const unmount = mountDialog(layer.current!, dialog.current!, () => close.current());
    return () => { unmount(); unwatch(); };
  }, []);
  return createPortal(<div ref={layer} className="app-dialog-layer bg-slate-950/90 backdrop-blur-sm"><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} aria-busy={busy || undefined} className={'app-dialog ' + (className || 'flex w-full max-w-xl flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl outline-none')}>{children}<FeedbackMessages /></section></div>, document.body);
};
