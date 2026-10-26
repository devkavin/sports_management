import { createModalStack } from './formUx';

const stack = createModalStack<{ layer: HTMLElement; dialog: HTMLElement }>();
const inertBefore = new Map<HTMLElement, boolean>();
const listeners = new Set<() => void>();
let overflowBefore = '';
let initialFocus: HTMLElement | null = null;
export const subscribeDialogs = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getDialogCount = () => stack.size;
const syncLayers = () => {
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!inertBefore.has(child)) inertBefore.set(child, child.inert);
    child.inert = stack.top ? child !== stack.top.layer : inertBefore.get(child)!;
  }
  if (!stack.size) { inertBefore.forEach((value, element) => { element.inert = value; }); inertBefore.clear(); }
};

export function mountDialog(layer: HTMLElement, dialog: HTMLElement, onEscape: () => void): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;
  const entry = { layer, dialog };
  if (!stack.size) { initialFocus = previousFocus; overflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  stack.add(entry);
  entry.layer.style.zIndex = String(70 + stack.size);
  syncLayers();
  entry.dialog.focus();
  listeners.forEach((listener) => listener());
  const observer = new MutationObserver(syncLayers);
  observer.observe(document.body, { childList: true });
  const keys = (event: KeyboardEvent) => {
    if (!stack.isTop(entry)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onEscape(); return; }
    if (event.key !== 'Tab') return;
    const targets = Array.from(entry.dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((target) => !target.hidden && target.getClientRects().length > 0 && !target.closest('[inert]'));
    const first = targets[0], last = targets[targets.length - 1];
    if (!first) { event.preventDefault(); entry.dialog.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !entry.dialog.contains(document.activeElement) || document.activeElement === entry.dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !entry.dialog.contains(document.activeElement) || document.activeElement === entry.dialog)) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', keys);
  return () => {
    const wasTop = stack.isTop(entry);
    stack.remove(entry); observer.disconnect();
    document.removeEventListener('keydown', keys);
    syncLayers();
    if (!stack.size) document.body.style.overflow = overflowBefore;
    if (wasTop) {
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]') && (!stack.top || stack.top.dialog.contains(previousFocus))) previousFocus.focus();
      else stack.top?.dialog.focus();
      if (!stack.size && (!previousFocus?.isConnected || previousFocus.closest('[inert]')) && initialFocus?.isConnected && !initialFocus.closest('[inert]')) initialFocus.focus();
    }
    if (!stack.size) initialFocus = null;
    listeners.forEach((listener) => listener());
  };
}
