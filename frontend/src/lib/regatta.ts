export interface RegattaDraft {
  name: string; location: string; distance: string; date: string; multiDay: boolean; endDate: string; planId: number | null; notes: string;
}
const validDay = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
export function regattaPayload(draft: RegattaDraft) {
  if (!draft.name.trim()) throw new Error('Enter the competition name.');
  if (!validDay(draft.date)) throw new Error('Choose a valid regatta date.');
  const end = draft.multiDay ? draft.endDate : draft.date;
  if (!validDay(end) || end < draft.date) throw new Error('Choose an end date on or after the regatta date.');
  const distance = Number(draft.distance);
  if (!Number.isInteger(distance) || distance < 1 || distance > 2147483647) throw new Error('Enter a positive whole-number race distance in metres.');
  return { name: draft.name.trim(), location: draft.location.trim(), target_distance_m: distance,
    start_date: `${draft.date}T00:00:00.000Z`, end_date: `${end}T00:00:00.000Z`, periodization_plan_id: draft.planId, notes: draft.notes.trim() };
}
/** Competition timestamps represent calendar dates; displaying them must not shift the day. */
export const regattaDateText = (value: string) => new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString();
