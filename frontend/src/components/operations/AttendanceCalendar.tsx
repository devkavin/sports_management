import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ClubSession } from '../../types/operations';
import { calendarDays, localDateKey, sessionsOnDate } from '../../lib/attendanceCalendar';
import { utcDate } from '../../lib/dateTime';
import { smallButtonClass } from '../common/FormPanel';

interface Props {
  month: Date;
  sessions: ClubSession[];
  selectedDate: string | null;
  loading: boolean;
  error: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (key: string) => void;
  onRetry: () => void;
}

export const sessionStatusClass = (status: ClubSession['status']) => status === 'cancelled'
  ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  : status === 'completed' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-sky-500/30 bg-sky-500/10 text-sky-200';

export const AttendanceCalendar: React.FC<Props> = ({ month, sessions, selectedDate, loading, error, onMonthChange, onSelectDate, onRetry }) => {
  const days = calendarDays(month);
  const today = localDateKey(new Date());
  const changeMonth = (offset: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  return <section aria-label="Sessions and attendance calendar" aria-busy={loading} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-2 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
      <h3 aria-live="polite" className="text-lg font-bold text-white">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="attendance-month">Go to month</label>
        <input id="attendance-month" type="month" value={localDateKey(month).slice(0, 7)} onChange={event => {
          if (/^\d{4}-\d{2}$/.test(event.target.value)) { const [year, value] = event.target.value.split('-').map(Number); if (year >= 1000 && year <= 9998) onMonthChange(new Date(year, value - 1, 1)); }
        }} className="min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-2 text-xs text-white [color-scheme:dark]" />
        <button type="button" className={smallButtonClass} onClick={() => onMonthChange(new Date())}>Today</button>
        <button type="button" aria-label="Previous month" className={smallButtonClass} onClick={() => changeMonth(-1)}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next month" className={smallButtonClass} onClick={() => changeMonth(1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
    <p className="mb-3 px-1 text-xs text-slate-400">Select a date to view sessions and manage attendance. Times use your device’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
    {loading && <p role="status" className="mb-3 px-1 text-sm text-slate-300">Loading sessions…</p>}
    {error && <div role="alert" className="mb-3 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error} <button type="button" onClick={onRetry} className={smallButtonClass}>Retry calendar</button></div>}
    <table className="w-full table-fixed border-collapse" aria-label={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
      <thead><tr>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <th scope="col" key={day} className="pb-2 text-center text-xs font-semibold text-slate-400"><abbr title={day} className="no-underline">{day.slice(0, 3)}</abbr></th>)}</tr></thead>
      <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
        const key = localDateKey(day);
        const rows = sessionsOnDate(sessions, key);
        const label = day.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return <td key={key} className="border border-slate-800 p-0 align-top">
          <button type="button" disabled={loading || Boolean(error)} aria-label={`${label}, ${rows.length} session${rows.length === 1 ? '' : 's'}`} aria-pressed={selectedDate === key} aria-current={today === key ? 'date' : undefined} onClick={() => onSelectDate(key)} className={'flex min-h-[88px] w-full min-w-0 flex-col gap-1 p-1 text-left outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rowing-400 disabled:opacity-40 sm:min-h-[132px] sm:p-2 ' + (selectedDate === key ? 'bg-rowing-500/10 ' : '') + (day.getMonth() === month.getMonth() ? 'text-slate-200' : 'bg-slate-950/40 text-slate-500')}>
            <span className={'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ' + (today === key ? 'bg-rowing-600 text-white' : '')}>{day.getDate()}</span>
            {rows.length > 0 && <><span className="text-[10px] font-semibold sm:hidden">{rows.length} <span className="sr-only">sessions</span></span><span aria-hidden="true" className="flex gap-1 sm:hidden">{Array.from(new Set(rows.map(row => row.status))).map(status => <span key={status} className={'h-1.5 w-1.5 rounded-full ' + (status === 'cancelled' ? 'bg-rose-400' : status === 'completed' ? 'bg-emerald-400' : 'bg-sky-400')} />)}</span></>}
            {rows.slice(0, 2).map(session => <span key={session.id} className={'hidden w-full truncate rounded border px-1 py-0.5 text-[10px] sm:block ' + sessionStatusClass(session.status)}>{utcDate(session.session_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} {session.title}</span>)}
            {rows.length > 2 && <span className="hidden text-[10px] sm:block">+{rows.length - 2} more</span>}
          </button>
        </td>;
      })}</tr>)}</tbody>
    </table>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">{(['scheduled', 'completed', 'cancelled'] as const).map(status => <span key={status} className={'rounded-lg border px-2 py-1 capitalize ' + sessionStatusClass(status)}>{status}</span>)}</div>
  </section>;
};
