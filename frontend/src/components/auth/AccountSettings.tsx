import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUnsavedChanges } from '../../context/FeedbackContext';
import { api } from '../../services/api';
import { Panel, Field, inputClass, buttonClass, FormModal } from '../common/FormPanel';
import { NewPasswordFields, PasswordField } from '../common/PasswordField';
import { focusNewPasswordError, getNewPasswordErrors, normalizePassword } from '../../lib/password';

type FormKind = 'profile' | 'password' | 'email';
type Feedback = { error?: string; message?: string };
const FormFeedback: React.FC<{ feedback?: Feedback }> = ({ feedback }) => <>
  {feedback?.error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{feedback.error}</p>}
  {feedback?.message && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">{feedback.message}</p>}
</>;

export const AccountSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [weight, setWeight] = useState(user?.weight_kg?.toString() || '');
  const [height, setHeight] = useState(user?.height_cm?.toString() || '');
  const [side, setSide] = useState(user?.side_preference || '');
  const [savedProfile, setSavedProfile] = useState(JSON.stringify([name, weight, height, side]));
  const [password, setPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [passwordVersion, setPasswordVersion] = useState(0);
  const [emailVersion, setEmailVersion] = useState(0);
  const [emailPassword, setEmailPassword] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<Partial<Record<FormKind, Feedback>>>({});
  const [busy, setBusy] = useState<FormKind | null>(null);
  const pending = useRef(false);
  useUnsavedChanges(savedProfile !== JSON.stringify([name, weight, height, side]) || Boolean(password || nextPassword || confirmation || emailPassword || email), busy !== null);
  const run = async (kind: FormKind, work: () => Promise<string>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(kind);
    setFeedback((current) => ({ ...current, [kind]: {} }));
    try { const message = await work(); setFeedback((current) => ({ ...current, [kind]: { message } })); }
    catch (err: any) { setFeedback((current) => ({ ...current, [kind]: { error: err.message || 'The request failed. Please try again.' } })); }
    finally { pending.current = false; setBusy(null); }
  };
  return <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
    <h2 className="text-2xl font-extrabold text-white">Account settings</h2><p className="text-sm text-slate-400">{user?.email}</p>
    <Panel title="Your profile">
      <FormFeedback feedback={feedback.profile} />
      <form onSubmit={(event) => { event.preventDefault(); void run('profile', async () => {
        const snapshot = JSON.stringify([name, weight, height, side]);
        await api.updateProfile({ full_name: name, weight_kg: weight ? Number(weight) : null, height_cm: height ? Number(height) : null, side_preference: side || null });
        setSavedProfile(snapshot);
        await refreshUser();
        return 'Profile saved.';
      }); }} aria-busy={busy === 'profile'}>
        <fieldset disabled={busy !== null} className="min-w-0 space-y-4">
          <Field label="Full name"><input id="profile-name" name="name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Weight (kg), optional"><input id="profile-weight" name="weight" type="number" min="1" step="any" value={weight} onChange={(event) => setWeight(event.target.value)} className={inputClass} /></Field>
            <Field label="Height (cm), optional"><input id="profile-height" name="height" type="number" min="1" step="any" value={height} onChange={(event) => setHeight(event.target.value)} className={inputClass} /></Field>
          </div>
          <Field label="Rowing side"><select id="profile-side" name="side" value={side} onChange={(event) => setSide(event.target.value as typeof side)} className={inputClass}><option value="">Not set</option>{['port', 'starboard', 'both', 'scull'].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <button disabled={busy !== null} className={buttonClass}>{busy === 'profile' ? 'Saving profile…' : 'Save profile'}</button>
        </fieldset>
      </form>
    </Panel>
    <Panel title="Change password">
      <FormFeedback feedback={feedback.password} />
      <form onSubmit={(event) => {
        event.preventDefault();
        if (pending.current) return;
        setPasswordSubmitted(true);
        const errors = getNewPasswordErrors(nextPassword, confirmation);
        if (Object.keys(errors).length) { focusNewPasswordError(event.currentTarget, 'change-new-password', errors); return; }
        void run('password', async () => {
          await api.changePassword(password, normalizePassword(nextPassword));
          setPassword(''); setNextPassword(''); setConfirmation(''); setPasswordSubmitted(false); setPasswordVersion((value) => value + 1);
          return 'Password changed. Other sessions have been signed out.';
        });
      }} aria-busy={busy === 'password'}>
        <fieldset disabled={busy !== null} className="min-w-0 space-y-4">
          <PasswordField key={'current-' + passwordVersion} id="change-current-password" label="Current password" autoComplete="current-password" value={password} onChange={setPassword} />
          <NewPasswordFields key={passwordVersion} id="change-new-password" password={nextPassword} confirmation={confirmation} onPasswordChange={setNextPassword} onConfirmationChange={setConfirmation} submitted={passwordSubmitted} disabled={busy !== null} />
          <button disabled={busy !== null} className={buttonClass}>{busy === 'password' ? 'Changing password…' : 'Change password'}</button>
        </fieldset>
      </form>
    </Panel>
    <Panel title="Change email">
      <p className="text-xs text-slate-400">Your existing address stays active until you confirm the link delivered to your new address.</p>
      <FormFeedback feedback={feedback.email} />
      <form onSubmit={(event) => { event.preventDefault(); void run('email', async () => {
        const result = await api.changeEmail(emailPassword, email.trim());
        setEmailPassword(''); setEmail(''); setEmailVersion((value) => value + 1);
        return result.message;
      }); }} aria-busy={busy === 'email'}>
        <fieldset disabled={busy !== null} className="min-w-0 space-y-4">
          <Field label="New email address"><input id="change-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></Field>
          <PasswordField key={emailVersion} id="email-current-password" label="Current password" autoComplete="current-password" value={emailPassword} onChange={setEmailPassword} />
          <button disabled={busy !== null} className={buttonClass}>{busy === 'email' ? 'Sending confirmation…' : 'Send confirmation link'}</button>
        </fieldset>
      </form>
    </Panel>
  </div>;
};

interface RecoveryProps { action?: string; token?: string; onClose: () => void }
export const AccountRecovery: React.FC<RecoveryProps> = (props) => <RecoveryDialog key={(props.action || '') + ':' + (props.token || '')} {...props} />;

const RecoveryDialog: React.FC<RecoveryProps> = ({ action, token, onClose }) => {
  const { logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const reset = Boolean(token && action === 'password_reset');
  return <FormModal title={action === 'email_change' ? 'Confirm your email' : token ? 'Choose a new password' : 'Reset your password'} onClose={onClose} busy={busy} dirty={!message && Boolean(email || password || confirmation)}>
    {message ? <div className="space-y-4"><p role="status" className="text-sm text-emerald-200">{message}</p><button type="button" onClick={onClose} className={buttonClass}>Return to sign in</button></div> : <form aria-busy={busy} className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (pending.current) return;
      setError('');
      if (reset) { setSubmitted(true); const errors = getNewPasswordErrors(password, confirmation); if (Object.keys(errors).length) { focusNewPasswordError(event.currentTarget, 'reset-password', errors); return; } }
      pending.current = true; setBusy(true);
      try {
        const result = token ? await api.confirmAccountAction(token, reset ? normalizePassword(password) : undefined) : await api.forgotPassword(email.trim());
        setPassword(''); setConfirmation(''); setEmail('');
        if (token) logout();
        setMessage(result.message);
      } catch (err: any) { setError(err.message || 'The request failed. Please try again.'); }
      finally { pending.current = false; setBusy(false); }
    }}>
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {!token && <Field label="Your account email"><input id="recovery-email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></Field>}
        {reset && <NewPasswordFields id="reset-password" password={password} confirmation={confirmation} onPasswordChange={setPassword} onConfirmationChange={setConfirmation} submitted={submitted} disabled={busy} />}
        {action === 'email_change' && <p className="text-sm text-slate-300">Confirm this email change to update your sign-in address. You will then sign in again.</p>}
        <button disabled={busy} className={buttonClass}>{busy ? 'Please wait…' : token ? 'Confirm update' : 'Send reset link'}</button>
      </fieldset>
    </form>}
  </FormModal>;
};
