import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getNewPasswordErrors } from '../../lib/password';

interface PasswordFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  onBlur?: () => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({ id, name = id, label, value, onChange, autoComplete, onBlur, error, hint, disabled, required = true }) => {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number | null; end: number | null } | null>(null);
  useEffect(() => {
    if (!selection.current || !input.current) return;
    input.current.focus({ preventScroll: true });
    input.current.setSelectionRange(selection.current.start, selection.current.end);
    selection.current = null;
  }, [visible]);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`, capsLock && `${id}-caps`].filter(Boolean).join(' ') || undefined;
  const checkCaps = (event: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'));
  return <div className="space-y-1">
    <label htmlFor={id} className="block text-xs font-semibold text-slate-300">{label}</label>
    <div className="relative">
      <input ref={input} id={id} name={name} type={visible ? 'text' : 'password'} value={value}
        onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} disabled={disabled}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy}
        onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={() => { setCapsLock(false); onBlur?.(); }}
        className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-3 pr-12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rowing-500" />
      <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-controls={id} aria-pressed={visible} disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { selection.current = { start: input.current?.selectionStart ?? null, end: input.current?.selectionEnd ?? null }; setVisible(!visible); }}
        className="absolute inset-y-0 right-0 rounded-r-xl px-3 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-rowing-500">
        {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
      </button>
    </div>
    {hint && <p id={`${id}-hint`} className="text-xs font-normal text-slate-400">{hint}</p>}
    {capsLock && <p id={`${id}-caps`} role="status" className="text-xs text-amber-300">Caps Lock is on.</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-rose-300">{error}</p>}
  </div>;
};

interface NewPasswordFieldsProps {
  id: string;
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  submitted?: boolean;
  disabled?: boolean;
  label?: string;
}

export const NewPasswordFields: React.FC<NewPasswordFieldsProps> = ({ id, password, confirmation, onPasswordChange, onConfirmationChange, submitted = false, disabled, label = 'New password' }) => {
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const errors = getNewPasswordErrors(password, confirmation);
  return <div className="space-y-3">
    <PasswordField id={id} label={label} value={password} onChange={onPasswordChange} autoComplete="new-password" disabled={disabled}
      onBlur={() => setPasswordTouched(true)} error={submitted || passwordTouched ? errors.password : undefined}
      hint="Use 15–128 characters. A long, unique passphrase works well. Spaces are allowed." />
    <PasswordField id={`${id}-confirmation`} label="Confirm new password" value={confirmation} onChange={onConfirmationChange} autoComplete="new-password" disabled={disabled}
      onBlur={() => setConfirmationTouched(true)} error={submitted || confirmationTouched ? errors.confirmation : undefined} />
  </div>;
};
