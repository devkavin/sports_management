import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibleDialog } from '../components/common/AccessibleDialog';
import { ConfirmOptions, discardOptions } from '../lib/formUx';
import { FeedbackMessages, FeedbackMessagesContext } from './FeedbackMessages';
import { getDialogCount, subscribeDialogs } from '../lib/modalLifecycle';

type Tone = 'success' | 'error' | 'info';
interface Pending { options: ConfirmOptions; resolve: (answer: boolean) => void; }
interface Feedback {
  notify: (message: string, tone?: Tone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  registerDirty: (key: object, dirty: boolean, busy?: boolean) => void;
  confirmNavigation: () => Promise<boolean>;
}
const Context = createContext<Feedback | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<{ id: number; message: string; tone: Tone }[]>([]);
  const nextId = useRef(0);
  const pending = useRef<Pending[]>([]);
  const [question, setQuestion] = useState<Pending | null>(null);
  const dirtyEditors = useRef(new Map<object, boolean>());
  const dialogCount = useSyncExternalStore(subscribeDialogs, getDialogCount, () => 0);
  const notify = useCallback((message: string, tone: Tone = 'error') => setMessages((current) => [...current.slice(-2), { id: ++nextId.current, message, tone }]), []);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    const item = { options, resolve };
    pending.current.push(item);
    if (pending.current.length === 1) setQuestion(item);
  }), []);
  const answer = (value: boolean) => {
    const current = pending.current.shift();
    setQuestion(pending.current[0] || null);
    current?.resolve(value);
  };
  const registerDirty = useCallback((key: object, dirty: boolean, busy = false) => { if (dirty || busy) dirtyEditors.current.set(key, busy); else dirtyEditors.current.delete(key); }, []);
  const navigationPending = useRef<Promise<boolean> | null>(null);
  const confirmNavigation = useCallback(() => {
    if (Array.from(dirtyEditors.current.values()).some(Boolean)) { notify('Please wait for the current save to finish before leaving.', 'info'); return Promise.resolve(false); }
    if (!dirtyEditors.current.size) return Promise.resolve(true);
    if (!navigationPending.current) navigationPending.current = confirm(discardOptions).finally(() => { navigationPending.current = null; });
    return navigationPending.current;
  }, [confirm, notify]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirtyEditors.current.size) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('beforeunload', unload); pending.current.splice(0).forEach((item) => item.resolve(false)); };
  }, []);
  return <Context.Provider value={{ notify, confirm, registerDirty, confirmNavigation }}><FeedbackMessagesContext.Provider value={{ messages, dismiss: (id) => setMessages((current) => current.filter((message) => message.id !== id)) }}>
    {children}
    {!dialogCount && <FeedbackMessages />}
    {question && <AccessibleDialog title={question.options.title} onClose={() => answer(false)}><div className="space-y-4 p-5"><h2 className="text-lg font-bold text-white">{question.options.title}</h2><p className="text-sm text-slate-300">{question.options.message}</p><div className="flex justify-end gap-3"><button type="button" className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-white" onClick={() => answer(false)}>{question.options.cancelLabel || 'Cancel'}</button><button type="button" className={'rounded-xl px-4 py-2 text-sm font-semibold text-white ' + (question.options.danger ? 'bg-rose-600' : 'bg-rowing-600')} onClick={() => answer(true)}>{question.options.confirmLabel || 'Confirm'}</button></div></div></AccessibleDialog>}
  </FeedbackMessagesContext.Provider></Context.Provider>;
};

export const useFeedback = () => { const context = useContext(Context); if (!context) throw new Error('FeedbackProvider is required'); return context; };
export const useUnsavedChanges = (dirty: boolean, busy = false) => {
  const { registerDirty } = useFeedback();
  const key = useRef({});
  useEffect(() => { registerDirty(key.current, dirty, busy); return () => registerDirty(key.current, false); }, [dirty, busy, registerDirty]);
};
