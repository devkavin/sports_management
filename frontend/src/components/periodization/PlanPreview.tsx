import type { PeriodizationPlanInput } from '../../types/periodization';
import { phaseLabels, timelineSegments } from './planHelpers';

export function PlanPreview({plan}: {plan: PeriodizationPlanInput}) {
  const segments = timelineSegments(plan.phases);
  return <div className="min-w-0 space-y-3">
    {plan.description && <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{plan.description}</p>}
    {segments.length > 0 && <div aria-label="Phase timeline, proportional to inclusive dates" className="relative h-4 overflow-hidden rounded bg-slate-800">{segments.map(({phase,left,width},index)=><div key={index} title={`${phase.name}: ${phase.start_date} – ${phase.end_date}`} style={{left:`${left}%`,width:`${width}%`}} className={`absolute h-full border-r border-slate-950 ${index%2 ? 'bg-amber-500' : 'bg-rowing-500'}`} />)}</div>}
    <ol className="space-y-2">{[...plan.phases].sort((a,b)=>a.start_date.localeCompare(b.start_date)).map((phase,index)=><li key={index} className="min-w-0 rounded-lg border border-slate-700 p-3 text-sm"><div className="break-words font-semibold text-white">{phase.name} · {phaseLabels[phase.phase]}</div><p className="text-xs text-slate-400">{phase.start_date} – {phase.end_date} · inclusive{phase.schedule_ids.length ? ` · ${phase.schedule_ids.length} linked schedule(s)` : ''}</p>{phase.goals && <p className="mt-1 whitespace-pre-wrap break-words text-slate-300">{phase.goals}</p>}</li>)}</ol>
    <p className="text-xs text-slate-400">Plans organize dated phases and link existing schedules. No schedules or sessions are created automatically.</p>
  </div>;
}
