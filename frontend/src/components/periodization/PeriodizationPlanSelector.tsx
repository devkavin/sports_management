import { useId, useState } from 'react';
import type { Schedule } from '../../types';
import { inputClass, smallButtonClass } from '../common/FormPanel';
import { PlanEditor } from './PlanEditor';
import { PlanPreview } from './PlanPreview';
import { validatePlan } from './planHelpers';
import { usePlans } from './usePlans';

export function PeriodizationPlanSelector({value,onChange,schedules,regattaDate,disabled=false}: {value:number|null;onChange:(id:number|null)=>void;schedules:Schedule[];regattaDate?:string;disabled?:boolean}) {
  const {plans,loading,error,retry,accept}=usePlans();
  const [query,setQuery]=useState('');
  const [creating,setCreating]=useState(false);
  const id=useId();
  const selected=plans.find(plan=>plan.id===value);
  const visible=plans.filter(plan=>(!plan.archived || plan.id===value) && (plan.id===value || `${plan.name} ${plan.description}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>a.name.localeCompare(b.name));
  const validation=selected ? validatePlan(selected,regattaDate) : '';
  return <div className="min-w-0 space-y-3 rounded-xl border border-slate-700 p-3">
    <label htmlFor={`${id}-search`} className="block text-xs font-semibold text-slate-300">Find a periodization plan (optional)<input id={`${id}-search`} disabled={disabled} type="search" className={inputClass} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search plan names or descriptions"/></label>
    <label htmlFor={id} className="block text-xs font-semibold text-slate-300">Periodization plan<select id={id} disabled={disabled || loading} className={inputClass} value={value??''} onChange={event=>onChange(event.target.value ? Number(event.target.value) : null)}><option value="">No plan</option>{value!==null && !selected && <option value={value}>Saved plan #{value} · unavailable</option>}{visible.map(plan=><option key={plan.id} value={plan.id} disabled={plan.archived && plan.id!==value}>{plan.name}{plan.archived ? ' · Archived' : ''}</option>)}</select></label>
    {loading && <p role="status" className="text-xs text-slate-400">Loading plans…</p>}
    {error && <p role="alert" className="text-sm text-rose-200">{error} <button type="button" disabled={disabled} className={smallButtonClass} onClick={retry}>Retry loading plans</button></p>}
    {!loading && !error && !visible.length && <p className="text-xs text-slate-400">{plans.length ? 'No active plans match your search.' : 'No saved plans yet.'}</p>}
    {value!==null && !selected && !loading && !error && <p role="alert" className="text-xs text-amber-200">The saved plan is unavailable. Choose another plan or No plan.</p>}
    {selected && <><p className="break-words text-sm font-semibold text-white">{selected.name}{selected.archived ? ' · Archived' : ''}</p><PlanPreview plan={selected}/>{validation && <p role="alert" className="text-sm text-amber-200">{validation} Choose another plan or update the regatta date.</p>}</>}
    {!selected && <p className="text-xs text-slate-400">Selecting a plan does not create schedules or sessions automatically.</p>}
    <button type="button" disabled={disabled} className={smallButtonClass} onClick={()=>setCreating(true)}>Create plan</button>
    {creating && <PlanEditor schedules={schedules} regattaDate={regattaDate} onClose={()=>setCreating(false)} onSaved={plan=>{accept(plan);onChange(plan.id);setCreating(false);}}/>}
  </div>;
}
