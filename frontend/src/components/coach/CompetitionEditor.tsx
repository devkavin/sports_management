import React, { useRef, useState } from 'react';
import { Competition, Schedule } from '../../types';
import { api } from '../../services/api';
import { Field, FormModal, inputClass, buttonClass } from '../common/FormPanel';
import { PeriodizationPlanSelector } from '../periodization/PeriodizationPlanSelector';
import { RegattaDraft, regattaPayload } from '../../lib/regatta';

export const CompetitionEditor: React.FC<{ competition?: Competition | null; schedules: Schedule[]; onClose: () => void; onSaved: () => void }> = ({ competition, schedules, onClose, onSaved }) => {
  const [draft, setDraft] = useState<RegattaDraft>(() => ({
    name: competition?.name || '', location: competition?.location || '', distance: competition ? String(competition.target_distance_m) : '',
    date: competition?.start_date.slice(0, 10) || '', endDate: competition?.end_date.slice(0, 10) || '',
    multiDay: Boolean(competition && competition.start_date.slice(0, 10) !== competition.end_date.slice(0, 10)),
    planId: competition?.periodization_plan_id || null, notes: competition?.notes || '',
  }));
  const baseline = useRef(JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const change = <K extends keyof RegattaDraft>(key: K, value: RegattaDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault(); event.stopPropagation(); if (pending.current) return;
    setError('');
    try {
      const payload = { ...regattaPayload(draft), competition_type: competition?.competition_type || 'sprint_regatta' };
      pending.current = true; setBusy(true);
      if (competition) await api.updateCompetition(competition.id, payload);
      else await api.createCompetition(payload);
      onSaved(); onClose();
    } catch (err: any) { setError(err.message); }
    finally { pending.current = false; setBusy(false); }
  };
  return <FormModal title={competition ? 'Edit regatta / competition' : 'Add target regatta / competition'} onClose={onClose} busy={busy} dirty={baseline.current !== JSON.stringify(draft)}>
    <form onSubmit={save} className="space-y-5">
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <Field label="Competition name"><input required maxLength={255} value={draft.name} onChange={event => change('name', event.target.value)} className={inputClass} /></Field>
        <Field label="Regatta location / course"><input maxLength={255} value={draft.location} onChange={event => change('location', event.target.value)} className={inputClass} /></Field>
        <Field label="Race distance (metres)"><input required type="number" min="1" max="2147483647" step="1" value={draft.distance} onChange={event => change('distance', event.target.value)} className={inputClass} /></Field>
        <Field label="Regatta date (date of the competition)"><input required type="date" value={draft.date} onChange={event => change('date', event.target.value)} className={inputClass + ' [color-scheme:dark]'} /></Field>
        <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={draft.multiDay} onChange={event => { change('multiDay', event.target.checked); if (!event.target.checked) change('endDate', draft.date); }} />This competition spans multiple days</label>
        {draft.multiDay && <Field label="Competition end date"><input required type="date" min={draft.date || undefined} value={draft.endDate} onChange={event => change('endDate', event.target.value)} className={inputClass + ' [color-scheme:dark]'} /></Field>}
        <p className="text-xs text-slate-400">Single-day events use the regatta date for both date bounds. These are competition dates; training phase dates are set in the plan below.</p>
        <PeriodizationPlanSelector value={draft.planId} onChange={id => change('planId', id)} schedules={schedules} regattaDate={draft.date || undefined} disabled={busy} />
        <Field label="Competition notes (optional)"><textarea rows={3} maxLength={4000} value={draft.notes} onChange={event => change('notes', event.target.value)} className={inputClass} /></Field>
        <button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : competition ? 'Save changes' : 'Save regatta'}</button>
      </fieldset>
    </form>
  </FormModal>;
};
