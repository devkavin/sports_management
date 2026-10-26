import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mountDialog } from '../../lib/modalLifecycle';
import { FeedbackMessages } from '../../context/FeedbackMessages';

/** Full editors and confirmations share one stack for focus, Escape and inert state. */
export const AccessibleDialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; className?: string; busy?: boolean }> = ({ title, onClose, children, className, busy = false }) => {
  const layer = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => mountDialog(layer.current!, dialog.current!, () => close.current()), []);
  return createPortal(<div ref={layer} className="fixed inset-0 flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm"><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} aria-busy={busy || undefined} className={className || 'flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl outline-none'}>{children}<FeedbackMessages /></section></div>, document.body);
};
