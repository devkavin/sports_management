import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Equipment, Exercise, Schedule, User } from '../../types';
import { PerformanceStandard, StandardEvaluation, StandardInput, StandardMetric } from '../../types/standards';
import { api } from '../../services/api';
import { useFeedback } from '../../context/FeedbackContext';
import { Field, FormModal, Panel, inputClass, buttonClass, smallButtonClass, dateText } from '../common/FormPanel';
import { formatStandardValue, parseStandardTarget, standardDefaults, standardTargetInput } from '../../lib/performanceStandards';

const metricLabels: Record<StandardMetric, string> = { duration: 'Total time', split: 'Average split /500m', watts: 'Average power (W)', distance: 'Distance (m)' };
const statuses = { meets: 'Meets standard', below: 'Below standard', stretch: 'Meets stretch target', no_result: 'No comparable result', inactive: 'Standard not currently effective' };
interface Props { exercises: Exercise[]; equipment: Equipment[]; members: User[]; schedules: Schedule[]; }
const timeInput = (value: number, _metric: StandardMetric) => standardTargetInput(value);

export const StandardEditor: React.FC<Props & { existing?: PerformanceStandard; duplicate?: boolean; onClose: () => void; onSaved: (row: PerformanceStandard) => void }> = ({ exercises, equipment, members, schedules, existing, duplicate, onClose, onSaved }) => {
  const [form, setForm] = useState<StandardInput>(() => existing ? { ...existing, name: duplicate ? `${existing.name} copy` : existing.name } : { ...standardDefaults(exercises, equipment), target_value: 0 });
  const [target, setTarget] = useState(existing ? timeInput(existing.target_value, existing.metric) : '');
  const [stretch, setStretch] = useState(existing?.stretch_value != null ? timeInput(existing.stretch_value, existing.metric) : '');
  const [protocolKind, setProtocolKind] = useState<'duration' | 'distance'>(form.protocol_duration_sec !== null ? 'duration' : 'distance');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const baseline = useRef(JSON.stringify({ form, target, stretch }));
  const change = <K extends keyof StandardInput>(field: K, value: StandardInput[K]) => setForm(current => ({ ...current, [field]: value }));
  const timed = protocolKind === 'duration';
  const metrics: StandardMetric[] = timed ? ['distance', 'watts'] : ['duration', 'split', 'watts'];
  const comparison = form.metric === 'duration' || form.metric === 'split' ? 'at_most' : 'at_least';
  const value = parseStandardTarget(target, form.metric);
  const exercise = exercises.find(item => item.id === form.exercise_id);
  const toggleId = (field: 'athlete_ids' | 'schedule_ids', id: number) => change(field, form[field].includes(id) ? form[field].filter(value => value !== id) : [...form[field], id]);
  const changeProtocol = (duration: number | null, distance: number | null) => {
    setProtocolKind(duration !== null ? 'duration' : 'distance');
    setForm(current => ({ ...current, protocol_duration_sec: duration, protocol_distance_m: distance, metric: duration !== null ? 'distance' : 'duration' }));
    setTarget(''); setStretch('');
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (pending.current) return;
    const stretchValue = stretch.trim() ? parseStandardTarget(stretch, form.metric) : null;
    const problem = !form.name.trim() ? 'Enter a standard name.' : !form.exercise_id ? 'Choose a real club exercise.'
      : value === null ? 'Enter a positive target. Time accepts seconds or M:SS.s.'
      : stretch.trim() && stretchValue === null ? 'Enter a valid stretch target or leave it blank.'
      : stretchValue !== null && value !== null && (comparison === 'at_most' ? stretchValue >= value : stretchValue <= value) ? 'The stretch target must be more demanding than the required target.'
      : form.audience === 'athletes' && !form.athlete_ids.length ? 'Select at least one athlete.'
      : form.audience === 'schedules' && !form.schedule_ids.length ? 'Select at least one schedule roster.'
      : form.effective_from && form.effective_until && form.effective_until < form.effective_from ? 'The end date must be on or after the start date.' : '';
    if (problem) { setError(problem); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      // Explicit fields prevent a duplicated row from carrying IDs or archive state.
      const payload: StandardInput = { name: form.name.trim(), exercise_id: form.exercise_id, metric: form.metric, comparison,
        target_value: value!, stretch_value: stretchValue, protocol_distance_m: form.protocol_distance_m, protocol_duration_sec: form.protocol_duration_sec,
        audience: form.audience, athlete_ids: form.audience === 'athletes' ? form.athlete_ids : [], schedule_ids: form.audience === 'schedules' ? form.schedule_ids : [],
        effective_from: form.effective_from || null, effective_until: form.effective_until || null, result_max_age_days: form.result_max_age_days, notes: form.notes };
      const row = existing && !duplicate ? await api.updateStandard(existing.id, { ...payload, version: existing.version }) : await api.createStandard(payload);
      onSaved(row); onClose();
    } catch (err: any) { setError(err.message); } finally { pending.current = false; setBusy(false); }
  };
  return <FormModal title={existing && !duplicate ? 'Edit performance standard' : 'Create performance standard'} onClose={onClose} busy={busy} dirty={baseline.current !== JSON.stringify({ form, target, stretch })}>
    <form onSubmit={save} onInvalidCapture={event => { const details = (event.target as HTMLElement).closest('details'); if (details) details.open = true; }} className="space-y-5">
      <p className="text-sm text-slate-400">Set an explicit test and requirement. Only verified results for this exercise and the exact test distance or duration are compared.</p>
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <Field label="Standard name"><input required maxLength={120} value={form.name} onChange={event => change('name', event.target.value)} className={inputClass} placeholder="e.g. Senior squad 2k requirement" /></Field>
        <Field label="Search exercises"><input type="search" value={exerciseSearch} onChange={event => setExerciseSearch(event.target.value)} className={inputClass} placeholder="Search your exercise library" /></Field>
        <Field label="Test exercise"><select required value={form.exercise_id || ''} className={inputClass} onChange={event => {
          const next = exercises.find(item => item.id === Number(event.target.value));
          const duration = next?.default_distance_m ? null : next?.default_duration_sec || null;
          setProtocolKind(duration ? 'duration' : 'distance');
          setForm(current => ({ ...current, exercise_id: next?.id || 0, protocol_distance_m: next?.default_distance_m || (duration ? null : 2000), protocol_duration_sec: duration, metric: duration ? 'distance' : 'duration' })); setTarget(''); setStretch('');
        }}><option value="">Choose a club exercise</option>{exercises.filter(item => item.id === form.exercise_id || (item.is_active && item.name.toLowerCase().includes(exerciseSearch.toLowerCase()))).map(item => <option key={item.id} value={item.id}>{item.name}{!item.is_active ? ' (inactive)' : ''}</option>)}</select></Field>
        {!exercises.some(item => item.is_active) && <p className="text-sm text-amber-200">Create a test exercise in Exercise library first. No sample exercises or targets are added automatically.</p>}
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Test protocol"><select value={timed ? 'duration' : 'distance'} onChange={event => changeProtocol(event.target.value === 'duration' ? 1800 : null, event.target.value === 'distance' ? 2000 : null)} className={inputClass}><option value="distance">Fixed distance</option><option value="duration">Fixed duration</option></select></Field>
          <Field label={timed ? 'Test duration (seconds)' : 'Test distance (metres)'}><input type="number" required min="1" step="1" value={(timed ? form.protocol_duration_sec : form.protocol_distance_m) || ''} onChange={event => change(timed ? 'protocol_duration_sec' : 'protocol_distance_m', Number(event.target.value) || null)} className={inputClass} /></Field></div>
        <p className="text-xs text-slate-400">Protocol values describe the test, not an athlete result. An entry must record the exact distance or duration to qualify.</p>
        <Field label="Measure"><select value={form.metric} onChange={event => { change('metric', event.target.value as StandardMetric); setTarget(''); setStretch(''); }} className={inputClass}>{metrics.map(metric => <option key={metric} value={metric}>{metricLabels[metric]}</option>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label={`Required ${metricLabels[form.metric].toLowerCase()}`}><input required inputMode={form.metric === 'duration' || form.metric === 'split' ? 'text' : 'decimal'} value={target} onChange={event => setTarget(event.target.value)} placeholder={form.metric === 'duration' || form.metric === 'split' ? 'Seconds or M:SS.s' : 'Enter a target'} className={inputClass} /></Field>
          <Field label="Stretch target (optional)"><input inputMode={form.metric === 'duration' || form.metric === 'split' ? 'text' : 'decimal'} value={stretch} onChange={event => setStretch(event.target.value)} placeholder="Leave blank if not needed" className={inputClass} /></Field></div>
        <p className="text-xs text-slate-400">{comparison === 'at_most' ? 'Lower or equal meets the requirement.' : 'Higher or equal meets the requirement.'} Stretch is an optional, more demanding target.</p>
        <Field label="Applies to"><select value={form.audience} onChange={event => change('audience', event.target.value as StandardInput['audience'])} className={inputClass}><option value="club">All active club athletes (default)</option><option value="schedules">Selected schedule rosters</option><option value="athletes">Selected athletes</option></select></Field>
        {form.audience === 'athletes' && <div className="space-y-2"><Field label="Search athletes"><input type="search" value={peopleSearch} onChange={event => setPeopleSearch(event.target.value)} className={inputClass} /></Field><p className="text-xs text-slate-400">{form.athlete_ids.length} selected</p><div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-700 p-3">{members.filter(item => form.athlete_ids.includes(item.id) || (item.role === 'athlete' && item.is_active && item.full_name.toLowerCase().includes(peopleSearch.toLowerCase()))).map(item => <label key={item.id} className="flex items-center gap-3 text-sm text-slate-200"><input type="checkbox" checked={form.athlete_ids.includes(item.id)} onChange={() => toggleId('athlete_ids', item.id)} />{item.full_name}{!item.is_active || item.role !== 'athlete' ? ' (unavailable — deselect to remove)' : ''}</label>)}</div></div>}
        {form.audience === 'schedules' && <div className="space-y-2"><Field label="Search schedule rosters"><input type="search" value={scheduleSearch} onChange={event => setScheduleSearch(event.target.value)} className={inputClass} /></Field><p className="text-xs text-slate-400">{form.schedule_ids.length} selected. Applies to active athletes assigned to these schedules, including later roster changes.</p><div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-700 p-3">{schedules.filter(item => form.schedule_ids.includes(item.id) || (item.is_active && item.name.toLowerCase().includes(scheduleSearch.toLowerCase()))).map(item => <label key={item.id} className="flex items-center gap-3 text-sm text-slate-200"><input type="checkbox" checked={form.schedule_ids.includes(item.id)} onChange={() => toggleId('schedule_ids', item.id)} />{item.name}{!item.is_active ? ' (inactive — deselect to remove)' : ''}</label>)}</div></div>}
        <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">More options: dates, result age and notes</summary><div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Effective from (UTC date, optional)"><input type="date" value={form.effective_from || ''} onChange={event => change('effective_from', event.target.value || null)} className={inputClass} /></Field><Field label="Effective until (UTC date, optional)"><input type="date" min={form.effective_from || undefined} value={form.effective_until || ''} onChange={event => change('effective_until', event.target.value || null)} className={inputClass} /></Field></div>
          <Field label="Maximum result age (days)"><input type="number" required min="1" max="3650" step="1" value={form.result_max_age_days || ''} onChange={event => change('result_max_age_days', Number(event.target.value))} className={inputClass} /></Field>
          <p className="text-xs text-slate-400">Uses the latest qualifying verified result within this age and the effective dates. Missing, old or unverified results are never counted as a failed test.</p>
          <Field label="Coach notes (optional)"><textarea maxLength={2000} rows={3} value={form.notes || ''} onChange={event => change('notes', event.target.value)} className={inputClass} /></Field>
        </div></details>
        <div className="rounded-xl border border-rowing-500/30 bg-rowing-500/10 p-3 text-sm text-slate-200"><h3 className="font-bold">Requirement preview</h3><p className="mt-1">{exercise?.name || 'Choose an exercise'} · {timed ? `${form.protocol_duration_sec || '—'} seconds` : `${form.protocol_distance_m || '—'} m`}</p><p>{value === null ? 'Enter a target to preview the requirement.' : `${comparison === 'at_most' ? 'At most' : 'At least'} ${formatStandardValue(value, form.metric)}`}</p><p className="mt-1 text-xs text-slate-400">{form.audience === 'club' ? 'All active club athletes' : form.audience === 'athletes' ? `${form.athlete_ids.length} selected athletes` : `${form.schedule_ids.length} schedule rosters`} · Latest comparable result · {form.result_max_age_days} days</p></div>
        <button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : existing && !duplicate ? 'Save changes' : 'Create standard'}</button>
      </fieldset>
    </form>
  </FormModal>;
};

export const PerformanceStandards: React.FC<Props> = props => {
  const { confirm, notify } = useFeedback();
  const [rows, setRows] = useState<PerformanceStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<{ existing?: PerformanceStandard; duplicate?: boolean } | null>(null);
  const [evaluation, setEvaluation] = useState<PerformanceStandard | null>(null);
  const [results, setResults] = useState<StandardEvaluation[]>([]);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const sequence = useRef(0);
  const load = async () => {
    const request = ++sequence.current; setLoading(true); setError('');
    try { const items = await api.getStandards(); if (sequence.current === request) setRows(items); }
    catch (err: any) { if (sequence.current === request) setError(err.message); }
    finally { if (sequence.current === request) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { sequence.current++; }; }, []);
  useEffect(() => {
    if (!evaluation) return;
    let active = true; setResults([]); setResultError(''); setResultLoading(true);
    api.evaluateStandard(evaluation.id).then(items => { if (active) setResults(items); })
      .catch(err => { if (active) setResultError(err.message); }).finally(() => { if (active) setResultLoading(false); });
    return () => { active = false; };
  }, [evaluation]);
  const saved = (row: PerformanceStandard) => { setRows(current => [row, ...current.filter(item => item.id !== row.id)]); notify('Performance standard saved.', 'success'); };
  const archive = async (row: PerformanceStandard) => {
    if (pending.current) return; pending.current = true; setBusy(true);
    try {
      if (!await confirm({ title: row.archived ? 'Restore this standard?' : 'Archive this standard?', message: row.archived ? 'It will apply again when its effective dates allow.' : 'It will stop applying. Existing results are retained.', confirmLabel: row.archived ? 'Restore' : 'Archive' })) return;
      saved(await api.archiveStandard(row.id, !row.archived, row.version));
    } catch (err: any) { setError(err.message); } finally { pending.current = false; setBusy(false); }
  };
  const visible = rows.filter(row => (showArchived || !row.archived) && (row.name + ' ' + (props.exercises.find(item => item.id === row.exercise_id)?.name || '')).toLowerCase().includes(search.toLowerCase()));
  return <Panel title="Performance standards">
    <div className="flex flex-wrap items-start justify-between gap-3"><p className="max-w-2xl text-sm text-slate-400">Set coach-defined requirements for comparable tests. Default to the whole club, or choose schedule rosters and individual athletes.</p><button type="button" onClick={() => setEditor({})} className={buttonClass + ' flex items-center gap-2'}><Plus className="h-4 w-4" />Create standard</button></div>
    <div className="flex flex-wrap items-end gap-4"><div className="w-full sm:max-w-sm"><Field label="Search standards or exercises"><input type="search" value={search} onChange={event => setSearch(event.target.value)} className={inputClass} /></Field></div><label className="flex items-center gap-2 py-3 text-sm text-slate-300"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Include archived</label><button type="button" disabled={loading || busy} onClick={() => void load()} className={smallButtonClass}>Refresh</button></div>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    {loading ? <p role="status" className="text-sm text-slate-400">Loading performance standards…</p> : !error && !visible.length ? <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">{rows.length ? 'No standards match your filters.' : 'No performance standards yet. Create your first requirement; no sample targets are applied.'}</p> : null}
    <div className="grid gap-3 xl:grid-cols-2">{visible.map(row => <article key={row.id} className="min-w-0 space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4"><div><h4 className="break-words font-bold text-white">{row.name}{row.archived ? ' · Archived' : ''}</h4><p className="mt-1 text-xs text-slate-400">{props.exercises.find(item => item.id === row.exercise_id)?.name || 'Exercise unavailable'} · {row.protocol_distance_m ? `${row.protocol_distance_m} m` : `${row.protocol_duration_sec} seconds`}</p></div><p className="text-sm font-semibold text-rowing-200">{row.comparison === 'at_most' ? 'At most' : 'At least'} {formatStandardValue(row.target_value, row.metric)}</p>{row.stretch_value != null && <p className="text-xs text-amber-200">Stretch: {formatStandardValue(row.stretch_value, row.metric)}</p>}<p className="text-xs text-slate-400">{row.audience === 'club' ? 'All active club athletes' : row.audience === 'athletes' ? `${row.athlete_ids.length} selected athletes` : `${row.schedule_ids.length} schedule rosters`} · Result age ≤ {row.result_max_age_days} days</p><p className="text-xs text-slate-400">{row.effective_from || 'No start limit'} → {row.effective_until || 'No end limit'} (UTC)</p>{row.notes && <p className="whitespace-pre-wrap break-words text-xs text-slate-300">{row.notes}</p>}<div className="flex flex-wrap gap-2"><button type="button" className={smallButtonClass} onClick={() => setEvaluation(row)}>View athlete results</button><button type="button" disabled={busy || row.archived} className={smallButtonClass} onClick={() => setEditor({ existing: row })}>Edit</button><button type="button" className={smallButtonClass} onClick={() => setEditor({ existing: row, duplicate: true })}>Duplicate</button><button type="button" disabled={busy} className={smallButtonClass} onClick={() => void archive(row)}>{row.archived ? 'Restore' : 'Archive'}</button></div></article>)}</div>
    {editor && <StandardEditor {...props} {...editor} onClose={() => setEditor(null)} onSaved={saved} />}
    {evaluation && <FormModal title={evaluation.name + ' · Athlete results'} dirty={false} onClose={() => setEvaluation(null)}><div className="space-y-4"><p className="text-xs text-slate-400">Latest verified result for the exact exercise and protocol, within the result-age limit and effective dates. No comparable result means no judgment has been made.</p>{resultLoading ? <p role="status" className="text-sm text-slate-400">Checking comparable results…</p> : resultError ? <p role="alert" className="text-sm text-rose-200">{resultError} <button type="button" className={smallButtonClass} onClick={() => setEvaluation({ ...evaluation })}>Retry</button></p> : !results.length ? <p className="text-sm text-slate-400">No active athletes currently match this audience.</p> : results.map(result => <article key={result.athlete_id} className="space-y-1 rounded-xl border border-slate-700 p-3"><h4 className="text-sm font-bold text-white">{result.athlete_name}</h4><p className={'text-sm ' + (result.status === 'stretch' || result.status === 'meets' ? 'text-emerald-200' : result.status === 'below' ? 'text-amber-200' : 'text-slate-400')}>{statuses[result.status]}</p>{result.value !== null && <p className="text-sm text-white">{formatStandardValue(result.value, evaluation.metric)}</p>}{result.recorded_date && <p className="text-xs text-slate-400">Recorded {dateText(result.recorded_date)}</p>}</article>)}</div></FormModal>}
  </Panel>;
};
