import { utcDate } from './dateTime';

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function calendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + index));
}

export function calendarRange(month: Date) {
  const days = calendarDays(month);
  const last = days[days.length - 1];
  return { starts_at: days[0].toISOString(), ends_at: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString() };
}

export function sessionsOnDate<T extends { session_date: string }>(sessions: T[], key: string): T[] {
  return sessions.filter(session => localDateKey(utcDate(session.session_date)) === key)
    .sort((a, b) => utcDate(a.session_date).getTime() - utcDate(b.session_date).getTime());
}

export function attendanceTotals(rows: { checkin: string | null }[]) {
  const totals = { assigned: rows.length, present: 0, absent: 0, excused: 0, no_show: 0, unrecorded: 0 };
  for (const row of rows) {
    if (row.checkin === 'present' || row.checkin === 'absent' || row.checkin === 'excused' || row.checkin === 'no_show') totals[row.checkin]++;
    else totals.unrecorded++;
  }
  return totals;
}
