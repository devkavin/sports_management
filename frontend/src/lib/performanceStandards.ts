import type { Exercise, Equipment } from '../types';
import type { StandardMetric } from '../types/standards';

export function parseStandardTarget(text: string, metric: StandardMetric): number | null {
  const value = text.trim();
  let number: number;
  if ((metric === 'duration' || metric === 'split') && /^\d+:[0-5]\d(?:\.\d+)?$/.test(value)) {
    const [minutes, seconds] = value.split(':').map(Number);
    number = minutes * 60 + seconds;
  } else if (/^\d+(?:\.\d+)?$/.test(value)) number = Number(value);
  else return null;
  return Number.isFinite(number) && number > 0 && number <= 1e9 ? number : null;
}

export const standardTargetInput = (value: number) => String(value);

export function formatStandardValue(value: number, metric: StandardMetric): string {
  if (metric === 'watts') return `${value} W`;
  if (metric === 'distance') return `${value} m`;
  let minutes = Math.floor(value / 60);
  let seconds = Number((value - minutes * 60).toFixed(10));
  if (seconds >= 60) { minutes++; seconds = 0; }
  const text = seconds.toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 10 });
  return `${minutes}:${text.padStart(text.indexOf('.') === 1 ? text.length + 1 : text.length, '0')}${metric === 'split' ? ' /500m' : ' total'}`;
}

export function standardDefaults(exercises: Exercise[], equipment: Equipment[]) {
  const rower = exercises.find(exercise => exercise.is_active && exercise.category === 'erg_test' && exercise.default_distance_m === 2000
    && equipment.some(item => item.id === exercise.equipment_id && item.category === 'concept2_rowerg'));
  return { name: '', exercise_id: rower?.id || 0, metric: 'duration' as const, comparison: 'at_most' as const,
    protocol_distance_m: 2000, protocol_duration_sec: null, audience: 'club' as const, athlete_ids: [] as number[], schedule_ids: [] as number[],
    effective_from: null, effective_until: null, result_max_age_days: 90, notes: '', stretch_value: null };
}
