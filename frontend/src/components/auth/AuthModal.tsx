import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Field, FormModal, inputClass, buttonClass } from '../common/FormPanel';
import { NewPasswordFields, PasswordField } from '../common/PasswordField';
import { focusNewPasswordError, getNewPasswordErrors, normalizePassword } from '../../lib/password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onJoinClub?: () => void;
  onForgotPassword?: () => void;
}

// Closing removes the form instance, including passwords and reveal state.
export const AuthModal: React.FC<AuthModalProps> = (props) => props.isOpen ? <AuthDialog key={props.initialMode || 'login'} {...props} /> : null;

const AuthDialog: React.FC<AuthModalProps> = ({ onClose, initialMode = 'login', onJoinClub, onForgotPassword }) => {
  const { login, registerClub } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [clubCode, setClubCode] = useState('');
  const [clubLocation, setClubLocation] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const clearSecrets = () => { setPassword(''); setAdminPassword(''); setConfirmation(''); setSubmitted(false); };
  const changeMode = (next: typeof mode) => { clearSecrets(); setError(''); setMode(next); };
  const dirty = Boolean(email || password || clubName || clubCode || clubLocation || adminName || adminEmail || adminPassword || confirmation);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    if (mode === 'register') {
      setSubmitted(true);
      const errors = getNewPasswordErrors(adminPassword, confirmation);
      if (Object.keys(errors).length) { focusNewPasswordError(event.currentTarget, 'register-password', errors); return; }
    }
    pending.current = true;
    setLoading(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else {
        await registerClub({ name: clubName, code: clubCode, location: clubLocation, admin_name: adminName, admin_email: adminEmail.trim(), admin_password: normalizePassword(adminPassword) });
        try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } }); } catch { /* Optional celebration. */ }
      }
      clearSecrets();
      onClose();
    } catch (err: any) { setError(err.message || (mode === 'login' ? 'Sign in failed. Please try again.' : 'Registration failed. Please try again.')); }
    finally { pending.current = false; setLoading(false); }
  };
  return <FormModal title={mode === 'login' ? 'Sign In to Club' : 'Register New Rowing Club'} onClose={onClose} dirty={mode === 'register' && dirty} busy={loading}>
    <p className="text-xs text-slate-400">{mode === 'login' ? 'Access your schedules and performance metrics' : 'Start with a clean club workspace and add your real team data'}</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
    {mode === 'register' && <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-200"><div className="flex items-center gap-1.5 font-bold text-emerald-300"><Sparkles className="h-4 w-4" /> Clean workspace</div><p className="mt-1">No fictional athletes, equipment, results, or schedules are created. Add the club’s real records after registration.</p></div>}
    <form onSubmit={submit} className="space-y-4 pt-4" aria-busy={loading}>
      <fieldset disabled={loading} className="min-w-0 space-y-4">
        {mode === 'login' ? <>
          <Field label="Email address"><input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></Field>
          <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
          {onForgotPassword && <button type="button" onClick={() => { clearSecrets(); onForgotPassword(); }} className="text-xs font-semibold text-sky-300 hover:text-white">Forgot your password?</button>}
        </> : <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Club name"><input id="register-club-name" name="club_name" required value={clubName} onChange={(event) => setClubName(event.target.value)} className={inputClass} /></Field>
            <Field label="Club code"><input id="register-club-code" name="club_code" required value={clubCode} onChange={(event) => setClubCode(event.target.value.toUpperCase())} className={inputClass} /></Field>
          </div>
          <Field label="Boathouse location (optional)"><input id="register-location" name="location" value={clubLocation} onChange={(event) => setClubLocation(event.target.value)} className={inputClass} /></Field>
          <h3 className="border-t border-slate-800 pt-3 text-xs font-bold text-purple-300">Club administrator account</h3>
          <Field label="Administrator full name"><input id="register-admin-name" name="name" autoComplete="name" required value={adminName} onChange={(event) => setAdminName(event.target.value)} className={inputClass} /></Field>
          <Field label="Administrator email"><input id="register-admin-email" name="email" autoComplete="username" type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} className={inputClass} /></Field>
          <NewPasswordFields key={mode} id="register-password" label="Create password" password={adminPassword} confirmation={confirmation} onPasswordChange={setAdminPassword} onConfirmationChange={setConfirmation} submitted={submitted} disabled={loading} />
        </>}
        <button type="submit" disabled={loading} className={buttonClass + ' w-full'}>{loading ? (mode === 'login' ? 'Authenticating…' : 'Creating club…') : mode === 'login' ? 'Sign in' : 'Register club'}</button>
        <div className="space-y-3 text-center">
          <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')} className="text-xs font-semibold text-rowing-300 hover:text-white">{mode === 'login' ? 'Register a new Rowing Club instead →' : 'Already registered? Sign in here'}</button>
          {mode === 'login' && onJoinClub && <div><button type="button" onClick={() => { clearSecrets(); onJoinClub(); }} className="text-xs font-semibold text-sky-300 hover:text-white">Join an existing club →</button></div>}
        </div>
      </fieldset>
    </form>
  </FormModal>;
};
