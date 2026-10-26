import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Search, UserPlus } from 'lucide-react';
import { api } from '../../services/api';
import { BoatSidePreference, ClubInvitationPreview, ClubPublic } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Field, FormModal, inputClass, buttonClass } from '../common/FormPanel';
import { NewPasswordFields } from '../common/PasswordField';
import { focusNewPasswordError, getNewPasswordErrors, normalizePassword } from '../../lib/password';

interface Props { isOpen: boolean; onClose: () => void; inviteToken?: string }
export const MembershipAccessModal: React.FC<Props> = (props) => props.isOpen ? <MembershipDialog key={props.inviteToken || 'join'} {...props} /> : null;

const MembershipDialog: React.FC<Props> = ({ onClose, inviteToken }) => {
  const { acceptInvitation } = useAuth();
  const [clubCode, setClubCode] = useState('');
  const [club, setClub] = useState<ClubPublic | null>(null);
  const [preview, setPreview] = useState<ClubInvitationPreview | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [weight, setWeight] = useState<number | ''>('');
  const [side, setSide] = useState<BoatSidePreference | ''>('');
  const [loading, setLoading] = useState(Boolean(inviteToken));
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const clearSecrets = () => { setPassword(''); setConfirmation(''); setSubmitted(false); };

  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    pending.current = true;
    api.previewClubInvitation(inviteToken)
      .then((result) => { if (active) { setPreview(result); setEmail(result.email); } })
      .catch((err) => { if (active) setError(err.message || 'The invitation could not be loaded. Please try again.'); })
      .finally(() => { if (active) { pending.current = false; setLoading(false); } });
    return () => { active = false; };
  }, [inviteToken]);

  const findClub = async () => {
    if (pending.current || !clubCode.trim()) return;
    pending.current = true; setLoading(true); setError('');
    try { setClub(await api.findClub(clubCode.trim())); }
    catch (err: any) { setClub(null); setError(err.message || 'The club could not be found. Please try again.'); }
    finally { pending.current = false; setLoading(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    if (!inviteToken && !club) { await findClub(); return; }
    if (!preview && (!club || club.athlete_join_policy !== 'approval_required')) return;
    setSubmitted(true); setError('');
    const errors = getNewPasswordErrors(password, confirmation);
    if (Object.keys(errors).length) { focusNewPasswordError(event.currentTarget, 'join-password', errors); return; }
    pending.current = true; setLoading(true);
    try {
      const account = { full_name: fullName, password: normalizePassword(password), weight_kg: weight || undefined, side_preference: side || undefined };
      if (inviteToken) {
        await acceptInvitation({ token: inviteToken, ...account });
        clearSecrets();
        window.history.replaceState({}, '', window.location.pathname);
        onClose();
      } else {
        await api.requestClubMembership({ club_code: clubCode.trim(), email: email.trim(), ...account });
        clearSecrets(); setComplete(true);
      }
    } catch (err: any) { setError(err.message || 'Your request could not be submitted. Please try again.'); }
    finally { pending.current = false; setLoading(false); }
  };
  const dirty = !complete && Boolean(clubCode || fullName || (!inviteToken && email) || password || confirmation || weight || side);
  return <FormModal title={inviteToken ? 'Accept club invitation' : 'Join an existing club'} onClose={onClose} dirty={dirty} busy={loading}>
    <p className="text-xs text-slate-400">{inviteToken ? 'Create your account using this secure invitation.' : 'Athletes request access; a coach or administrator reviews it.'}</p>
    {loading && inviteToken && !preview && <p role="status" className="mt-4 text-sm text-slate-300">Loading invitation…</p>}
    {error && <div role="alert" className="mt-4 break-words rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
    {complete ? <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
      <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" /><h3 className="mt-2 font-bold text-white">Request sent to {club?.name}</h3>
      <p role="status" className="mt-1 text-xs text-slate-300">A coach or administrator must approve your request before you can sign in.</p>
      <button type="button" onClick={onClose} className={buttonClass + ' mt-4'}>Done</button>
    </div> : <form onSubmit={submit} className="mt-5 space-y-4" aria-busy={loading}>
      <fieldset disabled={loading} className="min-w-0 space-y-4">
        {!inviteToken && !club && <Field label="Club code"><div className="flex gap-2">
          <input id="join-club-code" name="club_code" value={clubCode} onChange={(event) => setClubCode(event.target.value.toUpperCase())} className={inputClass} placeholder="Enter the code provided by your club" required />
          <button type="submit" disabled={loading || !clubCode.trim()} className={buttonClass + ' mt-1 flex items-center gap-1'}><Search className="h-4 w-4" />{loading ? 'Finding…' : 'Find'}</button>
        </div></Field>}
        {(club || preview) && <div className="rounded-2xl border border-rowing-500/25 bg-rowing-500/5 p-4">
          <div className="flex items-start justify-between gap-3"><div><div className="font-bold text-white">{club?.name || preview?.club_name}</div>
            <div className="text-xs text-slate-400">{club?.location || preview?.club_location || 'Location not specified'}{preview ? ' · Invitation for ' + preview.role : ''}</div>
          </div>{club && <button type="button" onClick={() => { setClub(null); setError(''); clearSecrets(); }} className="shrink-0 text-xs font-semibold text-rowing-300">Different club</button>}</div>
          {club?.athlete_join_policy === 'invite_only' && <p className="mt-2 text-xs text-amber-300">This club is invitation-only. Ask an administrator for a secure invitation link.</p>}
          {club?.athlete_join_policy === 'closed' && <p className="mt-2 text-xs text-rose-300">This club is not accepting requests.</p>}
        </div>}
        {(preview || (club && club.athlete_join_policy === 'approval_required')) && <>
          <Field label="Full name"><input id="join-name" name="name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} required /></Field>
          {!preview ? <Field label="Email"><input id="join-email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} required /></Field> : <Field label="Invited account email"><input id="invited-email" name="email" type="email" autoComplete="username" value={preview.email} readOnly className={inputClass} /></Field>}
          <NewPasswordFields id="join-password" label="Create password" password={password} confirmation={confirmation} onPasswordChange={setPassword} onConfirmationChange={setConfirmation} submitted={submitted} disabled={loading} />
          {(!preview || preview.role === 'athlete') && <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Weight in kg (optional)"><input id="join-weight" name="weight" type="number" min="1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value ? Number(event.target.value) : '')} className={inputClass} /></Field>
            <Field label="Rowing side (optional)"><select id="join-side" name="side" value={side} onChange={(event) => setSide(event.target.value as BoatSidePreference | '')} className={inputClass}><option value="">Not set</option><option value="scull">Scull</option><option value="port">Port</option><option value="starboard">Starboard</option><option value="both">Both</option></select></Field>
          </div>}
          <button disabled={loading} className={buttonClass + ' flex w-full items-center justify-center gap-2'}><UserPlus className="h-4 w-4" />{loading ? 'Submitting…' : inviteToken ? 'Create account and join' : 'Request to join'}</button>
        </>}
      </fieldset>
    </form>}
  </FormModal>;
};
