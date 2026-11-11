import { useRef, useState } from 'react';
import type { Schedule, SchedulePhase } from '../../types';
import type { PeriodizationPlan, PeriodizationPlanInput, PlanPhase } from '../../types/periodization';
import { api } from '../../services/api';
import { Field, FormModal, buttonClass, inputClass, smallButtonClass } from '../common/FormPanel';
import { emptyPhase, phaseLabels, scheduleFitsPhase, validatePlan } from './planHelpers';

function ScheduleLinks({phase,schedules,onChange}: {phase:PlanPhase;schedules:Schedule[];onChange:(ids:number[])=>void}) {
  const [query,setQuery] = useState('');
  const eligible = schedules.filter(schedule=>scheduleFitsPhase(schedule,phase));
  return <div className="space-y-2"><Field label="Find existing schedules (optional)"><input type="search" value={query} onChange={event=>setQuery(event.target.value)} className={inputClass} placeholder="Search schedules within these dates" /></Field>
    {phase.schedule_ids.map(id=>{const schedule=schedules.find(row=>row.id===id);return <div key={id} className="flex items-center justify-between gap-2 text-xs text-slate-300"><span className="min-w-0 break-words">{schedule?.name || `Unavailable schedule #${id}`}{(!schedule || !scheduleFitsPhase(schedule,phase)) && ' · unavailable in this window; remove or adjust dates'}</span><button type="button" className={smallButtonClass} onClick={()=>onChange(phase.schedule_ids.filter(value=>value!==id))}>Remove</button></div>;})}
    <div className="max-h-40 space-y-1 overflow-y-auto">{eligible.filter(schedule=>!phase.schedule_ids.includes(schedule.id)&&schedule.name.toLowerCase().includes(query.toLowerCase())).map(schedule=><button key={schedule.id} type="button" className="block w-full rounded-lg border border-slate-700 p-2 text-left text-xs text-slate-200 hover:bg-slate-800" onClick={()=>onChange([...phase.schedule_ids,schedule.id])}>{schedule.name} · {schedule.start_date.slice(0,10)} – {schedule.end_date.slice(0,10)}</button>)}</div>
    {!eligible.length && <p className="text-xs text-slate-400">No active schedules fit this date window.</p>}
  </div>;
}

export function PlanEditor({existing,schedules,regattaDate,onClose,onSaved}: {existing?:PeriodizationPlan;schedules:Schedule[];regattaDate?:string;onClose:()=>void;onSaved:(plan:PeriodizationPlan)=>void}) {
  const [draft,setDraft] = useState<PeriodizationPlanInput>(()=>existing ? {name:existing.name,description:existing.description,phases:existing.phases.map(phase=>({...phase,schedule_ids:[...phase.schedule_ids]}))} : {name:'',description:'',phases:[emptyPhase()]});
  const baseline = useRef(JSON.stringify(draft));
  const [busy,setBusy] = useState(false);
  const guard=useRef(false);
  const [error,setError] = useState('');
  const updatePhase = (index:number,patch:Partial<PlanPhase>) => setDraft(current=>({...current,phases:current.phases.map((phase,i)=>i===index ? {...phase,...patch} : phase)}));
  const save = async (event:React.FormEvent) => {
    event.preventDefault(); event.stopPropagation(); if(guard.current)return;
    const validation=validatePlan(draft,regattaDate); if(validation){setError(validation);return;}
    guard.current=true;setBusy(true);setError('');
    try { const plan=existing ? await api.updatePeriodizationPlan(existing.id,{...draft,version:existing.version}) : await api.createPeriodizationPlan(draft); onSaved(plan); }
    catch(error){setError(error instanceof Error ? error.message : 'Could not save the plan.');}
    finally {guard.current=false;setBusy(false);}
  };
  return <FormModal title={existing ? 'Edit periodization plan' : 'Create periodization plan'} onClose={onClose} busy={busy} dirty={baseline.current!==JSON.stringify(draft)}><form onSubmit={save} className="min-w-0 space-y-4"><fieldset disabled={busy} className="min-w-0 space-y-4">
    <Field label="Plan name"><input autoFocus required maxLength={200} className={inputClass} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></Field>
    <Field label="Description (optional)"><textarea className={inputClass} rows={2} value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></Field>
    <p className="text-xs text-slate-400">Dates are inclusive. Phases cannot overlap.{regattaDate ? ` All phases must finish by the regatta date, ${regattaDate}.` : ''} Saving does not create schedules or sessions.</p>
    {draft.phases.map((phase,index)=><fieldset key={index} className="min-w-0 space-y-3 rounded-xl border border-slate-700 p-3"><legend className="px-1 text-sm font-bold text-slate-200">Phase {index+1}</legend>
      <Field label="Phase name"><input required maxLength={200} value={phase.name} className={inputClass} onChange={event=>updatePhase(index,{name:event.target.value})}/></Field>
      <Field label="Training phase"><select value={phase.phase} className={inputClass} onChange={event=>updatePhase(index,{phase:event.target.value as SchedulePhase})}>{Object.entries(phaseLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2"><Field label="Start date"><input type="date" required max={phase.end_date || regattaDate} value={phase.start_date} className={inputClass + ' [color-scheme:dark]'} onChange={event=>updatePhase(index,{start_date:event.target.value})}/></Field><Field label="End date"><input type="date" required min={phase.start_date || undefined} max={regattaDate} value={phase.end_date} className={inputClass + ' [color-scheme:dark]'} onChange={event=>updatePhase(index,{end_date:event.target.value})}/></Field></div>
      <Field label="Goals (optional)"><textarea rows={2} value={phase.goals} className={inputClass} onChange={event=>updatePhase(index,{goals:event.target.value})}/></Field>
      <ScheduleLinks phase={phase} schedules={schedules} onChange={ids=>updatePhase(index,{schedule_ids:ids})}/>
      <button type="button" disabled={draft.phases.length===1} className={smallButtonClass} onClick={()=>setDraft({...draft,phases:draft.phases.filter((_,i)=>i!==index)})}>Remove phase {index+1}</button>
    </fieldset>)}
    <button type="button" disabled={draft.phases.length>=50} className={smallButtonClass} onClick={()=>setDraft({...draft,phases:[...draft.phases,emptyPhase()]})}>Add phase</button>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    <button type="submit" disabled={busy} className={buttonClass}>{busy ? 'Saving…' : existing ? 'Save plan' : 'Create plan'}</button>
  </fieldset></form></FormModal>;
}
