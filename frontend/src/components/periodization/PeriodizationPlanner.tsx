import { useRef, useState } from 'react';
import type { Schedule } from '../../types';
import type { PeriodizationPlan } from '../../types/periodization';
import { api } from '../../services/api';
import { buttonClass, inputClass, smallButtonClass } from '../common/FormPanel';
import { PlanEditor } from './PlanEditor';
import { PlanPreview } from './PlanPreview';
import { usePlans } from './usePlans';

export function PeriodizationPlanner({schedules}: {schedules:Schedule[]}) {
  const {plans,loading,error,retry,accept} = usePlans();
  const [query,setQuery]=useState('');
  const [editor,setEditor]=useState<PeriodizationPlan | 'new' | null>(null);
  const [busy,setBusy]=useState<number|null>(null);
  const guard=useRef(false);
  const [actionError,setActionError]=useState('');
  const archive = async(plan:PeriodizationPlan) => {
    if(guard.current)return; guard.current=true;setBusy(plan.id);setActionError('');
    try{accept(await api.archivePeriodizationPlan(plan.id,!plan.archived,plan.version));}
    catch(error){setActionError(error instanceof Error ? error.message : 'Could not change plan status.');}
    finally{guard.current=false;setBusy(null);}
  };
  const visible=plans.filter(plan=>`${plan.name} ${plan.description}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(a.archived)-Number(b.archived)||a.name.localeCompare(b.name));
  return <section className="min-w-0 space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">Dated periodization plans</h3><p className="mt-1 text-xs text-slate-400">Reusable dated phases, goals and links to existing schedules. Taxonomy below organizes training categories separately.</p></div><button type="button" className={buttonClass} onClick={()=>setEditor('new')}>Create plan</button></div>
    <label className="block text-xs font-semibold text-slate-300">Search plans<input type="search" className={inputClass} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name or description"/></label>
    {loading && <p role="status" className="text-sm text-slate-400">Loading plans…</p>}
    {error && <p role="alert" className="text-sm text-rose-200">{error} <button type="button" className={smallButtonClass} onClick={retry}>Retry loading plans</button></p>}
    {actionError && <p role="alert" className="text-sm text-rose-200">{actionError} <button type="button" className={smallButtonClass} onClick={retry}>Refresh plans</button></p>}
    {!loading && !error && !visible.length && <p className="text-sm text-slate-400">{plans.length ? 'No plans match your search.' : 'No dated plans yet. Create one to define your training phases.'}</p>}
    <div className="space-y-3">{visible.map(plan=><article key={plan.id} className="min-w-0 space-y-3 rounded-xl border border-slate-700 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="min-w-0 break-words font-semibold text-white">{plan.name}{plan.archived ? ' · Archived' : ''}</h4><div className="flex gap-2"><button type="button" disabled={busy!==null || plan.archived} className={smallButtonClass} onClick={()=>setEditor(plan)}>Edit</button><button type="button" disabled={busy!==null} className={smallButtonClass} onClick={()=>void archive(plan)}>{busy===plan.id ? 'Updating…' : plan.archived ? 'Restore' : 'Archive'}</button></div></div><PlanPreview plan={plan}/></article>)}</div>
    {editor && <PlanEditor existing={editor==='new' ? undefined : editor} schedules={schedules} onClose={()=>setEditor(null)} onSaved={plan=>{accept(plan);setEditor(null);}}/>}
  </section>;
}
