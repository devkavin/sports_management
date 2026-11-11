export type StandardMetric = 'duration' | 'split' | 'watts' | 'distance';
export interface StandardInput {
  name: string; exercise_id: number; metric: StandardMetric; comparison: 'at_most' | 'at_least';
  target_value: number; stretch_value: number | null; protocol_distance_m: number | null; protocol_duration_sec: number | null;
  audience: 'club' | 'athletes' | 'schedules'; athlete_ids: number[]; schedule_ids: number[];
  effective_from: string | null; effective_until: string | null; result_max_age_days: number; notes: string;
}
export interface PerformanceStandard extends StandardInput {
  id: number; version: number; archived: boolean; created_at: string; updated_at: string;
}
export interface StandardEvaluation {
  athlete_id: number; athlete_name: string; status: 'meets' | 'below' | 'stretch' | 'no_result' | 'inactive';
  value: number | null; result_id: number | null; recorded_date: string | null;
}
