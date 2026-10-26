export interface ConfirmOptions { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; }
export const discardOptions: ConfirmOptions = { title: 'Discard unsaved changes?', message: 'Your changes have not been saved. Stay to finish editing, or discard them to leave.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true };

export async function mayCloseEditor(state: { busy: boolean; dirty: boolean }, confirm: (options: ConfirmOptions) => Promise<boolean>): Promise<boolean> {
  if (state.busy) return false;
  return !state.dirty || await confirm(discardOptions);
}

export async function guardBrowserNavigation(requestedUrl: string, acceptedUrl: string, confirm: () => Promise<boolean>, replace: (url: string) => void): Promise<boolean> {
  // Popstate/hashchange already moved the URL. Keep it aligned with the editor
  // while consent is pending, including when the user presses Back again.
  replace(acceptedUrl);
  const approved = await confirm();
  replace(approved ? requestedUrl : acceptedUrl);
  return approved;
}

export function filterSelectedOptions<T extends { id: number; name?: string }>(options: T[], query: string, selected: number, label: (option: T) => string = (option) => option.name || ''): T[] {
  return options.filter((option) => option.id === selected || label(option).toLowerCase().includes(query.trim().toLowerCase()));
}

interface MemberAccess { id: number; full_name: string; role: string; is_active: boolean; }
export function memberAccessConfirmation(original: MemberAccess | undefined, draft: MemberAccess, selfId: number): ConfirmOptions | null {
  if (!original || (original.role === draft.role && original.is_active === draft.is_active)) return null;
  return { title: 'Change member access?', message: `${draft.full_name} will have the ${draft.role} role and ${draft.is_active ? 'active' : 'suspended'} access.${draft.id === selfId ? ' This changes your own access and will sign you out.' : ''}`, confirmLabel: 'Update access', danger: !draft.is_active || draft.id === selfId };
}

export function requestFailureMessage(status: number): string {
  if (!status) return 'Unable to connect. Check your network connection and try again. If you were saving, check whether the change was recorded before retrying.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to make this change. Contact your club administrator.';
  if (status === 404) return 'This item is no longer available. Refresh the page and try again.';
  if (status === 409) return 'This change conflicts with the current information. Refresh and review it before trying again.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'The server could not complete this request. Please try again shortly.';
  return 'Unable to complete this request. Review the information and try again.';
}

export function createModalStack<T extends object>() {
  const entries: T[] = [];
  return {
    add(entry: T) { entries.push(entry); },
    remove(entry: T) { const index = entries.indexOf(entry); if (index >= 0) entries.splice(index, 1); },
    isTop(entry: T) { return entries[entries.length - 1] === entry; },
    get top() { return entries[entries.length - 1]; },
    get size() { return entries.length; },
  };
}
