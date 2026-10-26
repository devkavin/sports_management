import React, { createContext, useContext } from 'react';

export interface FeedbackMessage { id: number; message: string; tone: 'success' | 'error' | 'info'; }
export const FeedbackMessagesContext = createContext<{ messages: FeedbackMessage[]; dismiss: (id: number) => void }>({ messages: [], dismiss: () => {} });

/** Rendered inside the active dialog so its live feedback is never made inert. */
export const FeedbackMessages: React.FC = () => {
  const { messages, dismiss } = useContext(FeedbackMessagesContext);
  if (!messages.length) return null;
  return <div className="fixed bottom-4 right-4 z-[100] max-h-[40vh] w-[min(28rem,calc(100vw-2rem))] space-y-2 overflow-y-auto" aria-label="Notifications">{messages.map((item) => <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} className={'flex items-start gap-3 rounded-xl border bg-slate-900 p-4 text-sm shadow-xl ' + (item.tone === 'error' ? 'border-rose-500 text-rose-100' : item.tone === 'success' ? 'border-emerald-500 text-emerald-100' : 'border-sky-500 text-sky-100')}><p className="min-w-0 flex-1 break-words">{item.message}</p><button aria-label="Dismiss notification" type="button" onClick={() => dismiss(item.id)}>×</button></div>)}</div>;
};
