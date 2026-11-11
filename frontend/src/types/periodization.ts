import type { SchedulePhase } from './index';
export interface PlanPhase {
  name: string; phase: SchedulePhase; start_date: string; end_date: string; goals: string; schedule_ids: number[];
}
export interface PeriodizationPlanInput { name: string; description: string; phases: PlanPhase[]; }
export interface PeriodizationPlan extends PeriodizationPlanInput {
  id: number; club_id: number; archived: boolean; version: number; created_at: string; updated_at: string;
}
