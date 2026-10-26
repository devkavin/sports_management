// This small local baseline complements the authoritative server policy. It is
// not an exhaustive list of compromised passwords.
const commonPasswords = new Set([
  'passwordpassword', 'password123456789', '123456789012345', '1234567890123456',
  'qwertyuiopasdfgh', 'qwertyuiop123456', 'letmeinletmeinletmein', 'iloveyouiloveyou',
  'thisismypassword', 'correcthorsebatterystaple', 'welcome123456789', 'changeme123456789',
]);

export const normalizePassword = (password: string): string => password.normalize('NFC');

export function validateNewPassword(password: string): string | undefined {
  const normalized = normalizePassword(password);
  const length = Array.from(normalized).length;
  if (length < 15) return 'Use at least 15 characters.';
  if (length > 128) return 'Use no more than 128 characters.';
  const folded = normalized.toLowerCase();
  if (commonPasswords.has(folded) || new Set(Array.from(folded)).size === 1) {
    return 'Choose a less common or repetitive password.';
  }
  return undefined;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | undefined {
  if (!confirmation) return 'Confirm your new password.';
  return normalizePassword(password) === normalizePassword(confirmation) ? undefined : 'Passwords do not match.';
}

export function getNewPasswordErrors(password: string, confirmation: string): { password?: string; confirmation?: string } {
  const passwordError = validateNewPassword(password);
  const confirmationError = validatePasswordConfirmation(password, confirmation);
  return { ...(passwordError ? { password: passwordError } : {}), ...(confirmationError ? { confirmation: confirmationError } : {}) };
}

export function focusNewPasswordError(form: Pick<HTMLFormElement, 'elements'>, id: string, errors: { password?: string; confirmation?: string }): void {
  const name = errors.password ? id : errors.confirmation ? `${id}-confirmation` : undefined;
  if (!name) return;
  const field = form.elements.namedItem(name);
  if (field && 'focus' in field && typeof field.focus === 'function') field.focus();
}
