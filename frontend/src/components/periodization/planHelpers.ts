import type { Schedule } from '../../types';
import type { PeriodizationPlan, PeriodizationPlanInput, PlanPhase } from '../../types/periodization';

export function mergePlanSnapshots(remote: PeriodizationPlan[], accepted: PeriodizationPlan[]) {
  const merged = new Map(remote.map(plan => [plan.id, plan]));
  for (const plan of accepted) {
    if (!merged.has(plan.id) || merged.get(plan.id)!.version < plan.version) merged.set(plan.id, plan);
  }
  return [...merged.values()];
}

export const phaseLabels = { base_endurance: 'Base endurance', strength_build: 'Strength build', race_pace_peak: 'Race pace / peak', taper_recovery: 'Taper / recovery' };
export const emptyPhase = (): PlanPhase => ({ name: '', phase: 'base_endurance', start_date: '', end_date: '', goals: '', schedule_ids: [] });
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4)) >= 1000 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const scheduleFitsPhase = (schedule: Pick<Schedule, 'is_active' | 'start_date' | 'end_date'>, phase: PlanPhase) => schedule.is_active && validDate(phase.start_date) && validDate(phase.end_date) && schedule.start_date.slice(0,10) >= phase.start_date && schedule.end_date.slice(0,10) <= phase.end_date;
export function validatePlan(plan: PeriodizationPlanInput, regattaDate?: string): string {
  if (!plan.name.trim()) return 'Enter a plan name.';
  if (!plan.phases.length || plan.phases.length > 50) return 'Add between 1 and 50 phases.';
  for (const phase of plan.phases) {
    if (!phase.name.trim()) return 'Give every phase a name.';
    if (!validDate(phase.start_date) || !validDate(phase.end_date)) return 'Enter valid start and end dates for every phase.';
    if (phase.end_date < phase.start_date) return 'A phase must end on or after its start date.';
    if (regattaDate && phase.end_date > regattaDate) return 'Every phase must finish on or before the regatta date.';
  }
  const sorted = [...plan.phases].sort((a,b)=>a.start_date.localeCompare(b.start_date));
  if (sorted.some((phase,index)=>index > 0 && phase.start_date <= sorted[index-1].end_date)) return 'Phase date windows must not overlap (dates are inclusive).';
  return '';
}
export function timelineSegments(phases: PlanPhase[]) {
  const sorted = [...phases].sort((a,b)=>a.start_date.localeCompare(b.start_date));
  if (!sorted.length || sorted.some(phase=>!validDate(phase.start_date)||!validDate(phase.end_date)||phase.end_date<phase.start_date)) return [];
  const start = Date.parse(sorted[0].start_date);
  const end = Math.max(...sorted.map(phase=>Date.parse(phase.end_date))) + 86400000;
  return sorted.map(phase=>({phase,left:(Date.parse(phase.start_date)-start)/(end-start)*100,width:(Date.parse(phase.end_date)-Date.parse(phase.start_date)+86400000)/(end-start)*100}));
}
