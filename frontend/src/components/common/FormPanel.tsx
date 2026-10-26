import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AccessibleDialog } from './AccessibleDialog';
import { useFeedback, useUnsavedChanges } from '../../context/FeedbackContext';
import { mayCloseEditor } from '../../lib/formUx';

export const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rowing-500';
export const buttonClass = 'rounded-xl bg-rowing-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rowing-500 disabled:opacity-40';
export const smallButtonClass = 'rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40';
export { utcDate, dateText, localInput } from '../../lib/dateTime';

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block min-w-0 text-xs font-semibold text-slate-300">{label}{children}</label>;
export const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold text-white">{title}</h3>{children}</section>;
export interface FormModalProps { title: string; onClose: () => void; children: React.ReactNode; dirty?: boolean; busy?: boolean; }

/** Also usable by large editors that retain their own header and responsive layout. */
export const EditorDialog: React.FC<FormModalProps & { className?: string }> = ({ title, onClose, children, dirty, busy = false, className }) => {
  const { confirm } = useFeedback();
  const [changed, setChanged] = useState(false);
  const asking = useRef(false);
  const isDirty = dirty ?? changed;
  useUnsavedChanges(isDirty, busy);
  const requestClose = async () => {
    if (asking.current) return;
    asking.current = true;
    try { if (await mayCloseEditor({ dirty: isDirty, busy }, confirm)) onClose(); }
    finally { asking.current = false; }
  };
  // Explicit dirty state wins. Existing forms also receive protection on user edits.
  return <AccessibleDialog title={title} busy={busy} onClose={requestClose} className={className}><div className="contents" onChangeCapture={() => setChanged(true)} onClickCapture={(event) => { const target = event.target as HTMLElement; if (target.closest('[data-editor-dismiss]') && target.closest('[role="dialog"]') === event.currentTarget.closest('[role="dialog"]')) { event.preventDefault(); event.stopPropagation(); void requestClose(); } }}>{children}</div></AccessibleDialog>;
};

export const FormModal: React.FC<FormModalProps> = ({ title, onClose, children, dirty, busy = false }) => {
  // Header close uses the same guard as Escape, delegated to its surrounding editor.
  return <EditorDialog title={title} onClose={onClose} dirty={dirty} busy={busy}><header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 p-5"><h2 className="font-bold text-white">{title}</h2><button type="button" data-editor-dismiss disabled={busy} aria-label="Close dialog" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"><X className="h-5 w-5" /></button></header><div className="min-h-0 overflow-y-auto p-5">{children}</div></EditorDialog>;
};
