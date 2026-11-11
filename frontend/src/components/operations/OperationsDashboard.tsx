import { filterSelectedOptions } from '../../lib/formUx';
import { useFeedback } from '../../context/FeedbackContext';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { Equipment, User } from '../../types';
import { AttendanceRow, BoatReservation, ClubSession, DamageRecord, EmailDelivery, OutingRecord, SavedCrew } from '../../types/operations';
import { Field, Panel, FormModal, EditorDialog, inputClass, buttonClass, smallButtonClass, dateText, utcDate, localInput } from '../common/FormPanel';
import { AttendanceCalendar, sessionStatusClass } from './AttendanceCalendar';
import { attendanceTotals, calendarRange, localDateKey, sessionsOnDate } from '../../lib/attendanceCalendar';

const boatSeats: Record<string, string[]> = {
  '1x_single_scull': ['Single'], '2x_double_scull': ['Bow', 'Stroke'], '2-_pair': ['Bow', 'Stroke'],
  '4-_four': ['Bow', '2', '3', 'Stroke'], '4+_coxed_four': ['Bow', '2', '3', 'Stroke', 'Cox'],
  '8+_eight': ['Bow', '2', '3', '4', '5', '6', '7', 'Stroke', 'Cox'],
};

export const OperationsDashboard: React.FC = () => {
  const { notify, confirm } = useFeedback();
  const { user } = useAuth();
  const { destination } = useNavigation();
  const staff = user?.role !== 'athlete';
  const manager = user?.role === 'admin' || user?.role === 'coach';
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState<ClubSession[]>([]);
  const [crewList, setCrewList] = useState<SavedCrew[]>([]);
  const [bookings, setBookings] = useState<BoatReservation[]>([]);
  const [damage, setDamage] = useState<DamageRecord[]>([]);
  const [outings, setOutings] = useState<OutingRecord[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [deliveries, setDeliveries] = useState<EmailDelivery | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(destination.target || null);
  const [register, setRegister] = useState<AttendanceRow[]>([]);
  const [attendanceLoadedId, setAttendanceLoadedId] = useState<number | null>(null);
  const [attendanceError, setAttendanceError] = useState('');
  const attendanceRequest = useRef(0);
  const [sessionView, setSessionView] = useState<'calendar' | 'list'>(manager && !destination.target ? 'calendar' : 'list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSessions, setCalendarSessions] = useState<ClubSession[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState('');
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [crewEditor, setCrewEditor] = useState<{ id?: number; name: string; equipment_id: number; seats: Record<string, number> } | null>(null);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [boatSearch, setBoatSearch] = useState('');
  const [bookingForm, setBookingForm] = useState(false);
  const [bookingCrew, setBookingCrew] = useState('');
  const [bookingSession, setBookingSession] = useState('');
  const [bookingCrewSearch, setBookingCrewSearch] = useState('');
  const [bookingSessionSearch, setBookingSessionSearch] = useState('');
  const actionPending = useRef(false);
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [damageForm, setDamageForm] = useState(false);
  const [damageEquipment, setDamageEquipment] = useState('');
  const [severity, setSeverity] = useState('advisory');
  const [description, setDescription] = useState('');
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [duration, setDuration] = useState(60);
  const [rsvpNote, setRsvpNote] = useState('');
  const selected = (sessionView === 'calendar' ? calendarSessions.find(session => session.id === selectedId) : undefined)
    || sessions.find((session) => session.id === selectedId) || calendarSessions.find((session) => session.id === selectedId);
  const boats = equipment.filter((item) => boatSeats[item.category]);
  const athletes = members.filter((member) => member.role === 'athlete' && member.is_active);

  const load = async () => {
    const [sessionRows, crews, reservations, damages, outingRows, items, people] = await Promise.all([
      api.operation<ClubSession[]>('/sessions'), api.operation<SavedCrew[]>('/crews'),
      api.operation<BoatReservation[]>('/reservations'), api.operation<DamageRecord[]>('/damage'),
      api.operation<OutingRecord[]>('/outings'), api.getEquipment(), staff ? api.getClubMembers() : Promise.resolve([]),
    ]);
    setSessions(sessionRows); setCrewList(crews); setBookings(reservations); setDamage(damages); setOutings(outingRows); setEquipment(items); setMembers(people);
    if (selectedRef.current == null && sessionView === 'list') setSelectedId(sessionRows.filter((session) => utcDate(session.session_date) > new Date() && session.status === 'scheduled').sort((a, b) => a.session_date.localeCompare(b.session_date))[0]?.id || sessionRows[0]?.id || null);
    if (user?.role === 'admin') setDeliveries(await api.operation<EmailDelivery>('/communications'));
  };
  const loadAttendance = async (id: number) => {
    const request = ++attendanceRequest.current;
    setAttendanceError(''); setAttendanceLoadedId(null);
    try {
      const rows = await api.operation<AttendanceRow[]>(`/sessions/${id}/attendance`);
      if (selectedRef.current !== id || request !== attendanceRequest.current) return;
      setRegister(rows); setAttendanceLoadedId(id);
      setRsvpNote(rows.find((row) => row.user_id === user?.id)?.note || '');
    } catch (err: any) {
      if (selectedRef.current === id && request === attendanceRequest.current) setAttendanceError(err.message);
    }
  };
  useEffect(() => { load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (destination.target) { setSelectedId(destination.target); setTab('sessions'); setSessionView('list'); setSelectedDate(null); } }, [destination.revision]);
  useEffect(() => { setRegister([]); if (selectedId) void loadAttendance(selectedId); }, [selectedId]);
  const monthKey = localDateKey(calendarMonth).slice(0, 7);
  useEffect(() => {
    if (!manager || sessionView !== 'calendar' || tab !== 'sessions') return;
    let active = true;
    setCalendarLoading(true); setCalendarError(''); setCalendarSessions([]);
    const query = new URLSearchParams(calendarRange(calendarMonth));
    api.operation<ClubSession[]>(`/sessions?${query}`).then(rows => {
      if (active) setCalendarSessions(rows);
    }).catch(err => { if (active) setCalendarError(err.message); })
      .finally(() => { if (active) setCalendarLoading(false); });
    return () => { active = false; };
  }, [monthKey, calendarRevision, manager, sessionView, tab]);
  const run = async (work: () => Promise<void>, success: string, question?: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true); setError(''); setMessage('');
    try { if (question && !await confirm(question)) return; await work(); await load(); setCalendarRevision(value => value + 1); if (selectedId) await loadAttendance(selectedId); setMessage(success); }
    catch (err: any) { setError(err.message); notify(err.message); } finally { setBusy(false); actionPending.current = false; }
  };
  const visibleSessions = useMemo(() => sessions.filter((session) => (session.title + ' ' + session.status).toLowerCase().includes(search.toLowerCase())), [sessions, search]);
  const visibleCalendarSessions = useMemo(() => calendarSessions.filter(session => (session.title + ' ' + session.status).toLowerCase().includes(search.toLowerCase())), [calendarSessions, search]);
  const daySessions = selectedDate ? sessionsOnDate(visibleCalendarSessions, selectedDate) : [];
  const totals = attendanceTotals(register);
  const names = (crew: SavedCrew) => Object.entries(crew.seats).map(([seat, id]) => seat + ': ' + (crew.seat_names?.[seat] || members.find((member) => member.id === id)?.full_name || (id === user?.id ? user.full_name : 'Club athlete'))).join(' · ');

  const sessionPanel = <Panel title={selected?.title || 'Session register'}>{selected ? <>
          <p className="text-sm text-slate-300">{dateText(selected.session_date)} · {selected.duration_minutes} minutes · <span className="font-bold capitalize">{selected.status}</span></p>{selected.change_reason && <p className="text-xs text-amber-200">Last change: {selected.change_reason}</p>}
          {selected.location && <p className="text-sm text-slate-300">Location: {selected.location}</p>}
          {manager && <div className="flex flex-wrap gap-2">{(selected.status === 'cancelled' ? [['restore', 'Restore session']] : selected.status === 'scheduled' ? [['reschedule', 'Reschedule'], ['cancel', 'Cancel session'], ...(utcDate(selected.session_date) <= new Date() ? [['complete', 'Mark completed']] : [])] : []).map(([action, label]) => <button type="button" key={action} disabled={busy} className={smallButtonClass} onClick={() => { setLifecycle(action); setReason(''); setNewDate(localInput(selected.session_date)); setDuration(selected.duration_minutes); }}>{label}</button>)}</div>}
          <p className="text-xs text-slate-400">RSVP records expected attendance. Staff check-in records what happened. Exercise results are kept separately.</p>
          {!staff && selected.status === 'scheduled' && utcDate(selected.session_date) > new Date() && <div className="space-y-3"><Field label="Note for your coach (optional)"><input value={rsvpNote} onChange={(event) => setRsvpNote(event.target.value)} maxLength={1000} className={inputClass} /></Field><div className="flex flex-wrap gap-2">{[['going', 'Going'], ['maybe', 'Maybe'], ['declined', 'Cannot attend']].map(([value, label]) => <button key={value} disabled={busy} className={buttonClass} onClick={() => run(async () => { await api.operation(`/sessions/${selected.id}/rsvp`, 'PUT', { rsvp: value, note: rsvpNote || null }); }, 'Your RSVP was saved.')}>{label}</button>)}</div></div>}
          {attendanceError ? <div role="alert" className="space-y-2 text-sm text-rose-200"><p>{attendanceError}</p><button type="button" className={smallButtonClass} onClick={() => void loadAttendance(selected.id)}>Retry attendance</button></div> : attendanceLoadedId !== selected.id ? <p role="status" className="text-sm text-slate-400">Loading attendance…</p> : <>
            {staff && <dl aria-label="Attendance summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(totals).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><dt className="text-xs capitalize text-slate-400">{key.replace('_', ' ')}</dt><dd className="mt-1 text-lg font-bold text-white">{value}</dd></div>)}</dl>}
            <div className="space-y-2">{register.map((row) => <div key={row.user_id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 break-words"><h4 className="text-sm font-bold text-white">{row.name}</h4><p className="text-xs text-slate-400">RSVP: {row.rsvp} · Attendance: {row.checkin?.replace('_', ' ') || 'Not recorded'}</p>{row.note && <p className="mt-1 text-xs text-slate-300">{row.note}</p>}</div>{staff && <Field label={'Attendance for ' + row.name}><select disabled={busy || selected.status === 'cancelled'} value={row.checkin || ''} onChange={(event) => run(async () => { await api.operation(`/sessions/${selected.id}/attendance/${row.user_id}`, 'PUT', { checkin: event.target.value || null }); }, 'Attendance saved.')} className={inputClass}><option value="">Not recorded</option>{[['present', 'Present'], ['absent', 'Absent'], ['excused', 'Excused'], ['no_show', 'No show']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}</div>)}{!register.length && <p className="text-sm text-slate-400">No active athletes assigned to this session.</p>}</div>
          </>}
        </> : <p className="text-sm text-slate-400">Choose a session to view its register.</p>}</Panel>;

  return <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
    <div><h2 className="text-2xl font-extrabold text-white">Club operations</h2><p className="mt-1 text-sm text-slate-400">Attendance, crews, boat bookings, repairs and outings in one place.</p></div>
    {error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
    <nav aria-label="Club operations" className="flex gap-2 overflow-x-auto pb-2">{[['sessions', 'Sessions & attendance'], ['crews', 'Saved crews'], ['bookings', 'Boat reservations'], ['damage', 'Damage & repairs'], ['outings', 'Launch / return'], ...(user?.role === 'admin' ? [['delivery', 'Email delivery']] : [])].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} aria-current={tab === value ? 'page' : undefined} className={'shrink-0 rounded-xl px-4 py-2 text-xs font-bold ' + (tab === value ? 'bg-rowing-500/20 text-rowing-200' : 'bg-slate-900 text-slate-400')}>{label}</button>)}</nav>
    {loading && <p className="text-sm text-slate-400">Loading club records…</p>}
    {tab === 'sessions' && manager && <div className="flex flex-wrap items-end justify-between gap-3"><div role="group" aria-label="Sessions display" className="flex gap-2">{(['calendar', 'list'] as const).map(view => <button key={view} type="button" disabled={busy} aria-pressed={sessionView === view} onClick={() => { setSessionView(view); setSelectedDate(null); }} className={smallButtonClass + (sessionView === view ? ' border-rowing-400 bg-rowing-500/20 text-white' : '')}>{view === 'calendar' ? 'Calendar view' : 'List view'}</button>)}</div><div className="w-full sm:w-72"><Field label="Search session title or status"><input type="search" value={search} onChange={event => setSearch(event.target.value)} className={inputClass} placeholder="Search sessions" /></Field></div></div>}
    {tab === 'sessions' && manager && sessionView === 'calendar' && <AttendanceCalendar month={calendarMonth} sessions={visibleCalendarSessions} selectedDate={selectedDate} loading={calendarLoading} error={calendarError} onRetry={() => setCalendarRevision(value => value + 1)} onMonthChange={month => { if (!busy) { setCalendarMonth(month); setSelectedDate(null); } }} onSelectDate={key => { if (busy) return; setSelectedDate(key); setSelectedId(sessionsOnDate(visibleCalendarSessions, key)[0]?.id ?? null); setMessage(''); setError(''); }} />}
    {tab === 'sessions' && (!manager || sessionView === 'list') && <div className="grid items-start gap-5 lg:grid-cols-[minmax(230px,1fr)_2fr]"><Panel title="Choose a session">{!manager && <Field label="Search title or status"><input value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="Search sessions" /></Field>}<div className="max-h-[60vh] space-y-2 overflow-y-auto">{visibleSessions.map((session) => <button type="button" disabled={busy} key={session.id} onClick={() => setSelectedId(session.id)} className={'block w-full rounded-xl border p-3 text-left ' + (selectedId === session.id ? 'border-rowing-400 bg-rowing-500/10' : 'border-slate-800 bg-slate-950')}><span className="block text-sm font-bold text-white">{session.title}</span><span className="mt-1 block text-xs text-slate-400">{dateText(session.session_date)} · {session.status}</span></button>)}{!visibleSessions.length && <p className="text-sm text-slate-400">No assigned sessions match.</p>}</div></Panel>
      {sessionPanel}</div>}
    {manager && selectedDate && <EditorDialog title={'Sessions & attendance · ' + new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} dirty={false} busy={busy} onClose={() => setSelectedDate(null)} className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl outline-none">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 p-4 sm:p-5"><div><h2 className="font-bold text-white">{new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2><p className="text-xs text-slate-400">Sessions & attendance · {daySessions.length} session{daySessions.length === 1 ? '' : 's'}{search ? ' matching your search' : ''}</p></div><button type="button" data-editor-dismiss disabled={busy} aria-label="Close date details" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"><X className="h-5 w-5" /></button></header>
      <div className="min-h-16 space-y-4 overflow-y-auto p-3 sm:p-5">
        {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}{message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
        {calendarError ? <p role="alert" className="text-sm text-rose-200">{calendarError} <button type="button" className={smallButtonClass} onClick={() => setCalendarRevision(value => value + 1)}>Retry calendar</button></p> : calendarLoading ? <p role="status" className="text-sm text-slate-400">Refreshing sessions…</p> : daySessions.length ? <div className="grid items-start gap-4 lg:grid-cols-[minmax(200px,1fr)_2fr]"><nav aria-label="Sessions on selected date" className="space-y-2">{daySessions.map(session => <button key={session.id} type="button" disabled={busy} aria-pressed={selectedId === session.id} onClick={() => { setSelectedId(session.id); setMessage(''); setError(''); }} className={'block w-full space-y-1 rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-rowing-400 ' + (selectedId === session.id ? 'border-rowing-400 bg-rowing-500/10' : 'border-slate-700 bg-slate-950')}><span className="block break-words text-sm font-bold text-white">{session.title}</span><span className="block text-xs text-slate-400">{utcDate(session.session_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {session.duration_minutes} minutes</span><span className={'inline-block rounded border px-2 py-0.5 text-xs capitalize ' + sessionStatusClass(session.status)}>{session.status}</span></button>)}</nav><div className="min-w-0">{daySessions.some(session => session.id === selectedId) ? sessionPanel : <p className="text-sm text-slate-300">Choose a session to view its attendance. Updated sessions may have moved to another date.</p>}</div></div> : <p className="rounded-xl border border-slate-800 p-6 text-center text-sm text-slate-400">{search ? 'No sessions match your search on this date.' : 'No sessions scheduled on this date.'}</p>}
      </div>
    </EditorDialog>}
    {tab === 'crews' && <Panel title="Saved crews">{manager && <button className={buttonClass} onClick={() => { setCrewEditor({ name: '', equipment_id: 0, seats: {} }); setAthleteSearch(''); setBoatSearch(''); }}>Create crew</button>}<div className="grid gap-3 md:grid-cols-2">{crewList.map((crew) => <article key={crew.id} className="space-y-2 rounded-xl border border-slate-800 p-4"><h4 className="font-bold text-white">{crew.name}</h4><p className="text-xs text-slate-400">{equipment.find((item) => item.id === crew.equipment_id)?.name || 'Boat'}</p><p className="text-xs text-slate-300">{names(crew)}</p>{manager && <button className={smallButtonClass} onClick={() => { setCrewEditor({ ...crew, seats: { ...crew.seats } }); setAthleteSearch(''); setBoatSearch(''); }}>Edit crew</button>}</article>)}</div>{!crewList.length && <p className="text-sm text-slate-400">No saved crews yet. A coach creates a crew using the club's real boats and athletes.</p>}</Panel>}
    {tab === 'bookings' && <Panel title="Boat reservations">{staff && <button className={buttonClass} onClick={() => { setBookingForm(true); setBookingCrewSearch(''); setBookingSessionSearch(''); setBookingCrew(''); setBookingSession(''); setStarts(''); setEnds(''); }}>Reserve a boat</button>}<div className="space-y-3">{bookings.map((booking) => <article key={booking.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 p-4 sm:flex-row"><div><h4 className="font-bold text-white">{booking.equipment_name} · {booking.crew_name}</h4><p className="text-xs text-slate-400">{dateText(booking.starts_at)} → {dateText(booking.ends_at)}</p><p className="mt-1 text-xs capitalize text-slate-300">{booking.status}</p></div>{staff && booking.status === 'booked' && <button disabled={busy} className={smallButtonClass} onClick={() => run(async () => { await api.operation(`/reservations/${booking.id}/cancel`, 'POST'); }, 'Reservation cancelled.', { title: 'Cancel boat reservation?', message: `Release ${booking.equipment_name} for ${booking.crew_name}? The crew will need a new reservation to use this boat.`, confirmLabel: 'Cancel reservation', danger: true })}>Cancel reservation</button>}</article>)}</div>{!bookings.length && <p className="text-sm text-slate-400">No reservations yet.</p>}</Panel>}
    {tab === 'damage' && <Panel title="Damage & repairs"><button className={buttonClass} onClick={() => { setDamageForm(true); setDamageEquipment(''); setDescription(''); setSeverity('advisory'); }}>Report damage</button><div className="space-y-3">{damage.map((record) => <article key={record.id} className="space-y-2 rounded-xl border border-slate-800 p-4"><h4 className="font-bold text-white">{equipment.find((item) => item.id === record.equipment_id)?.name || 'Equipment'} · {record.resolved_at ? 'Resolved' : record.severity}</h4><p className="text-sm text-slate-300">{record.description}</p><p className="text-xs text-slate-400">Reported {dateText(record.created_at)}</p>{record.resolution && <p className="text-xs text-emerald-200">Repair: {record.resolution}</p>}{staff && !record.resolved_at && <button disabled={busy} className={smallButtonClass} onClick={() => { setResolving(record.id); setResolution(''); }}>Record repair / resolve</button>}</article>)}</div>{!damage.length && <p className="text-sm text-slate-400">No damage reports recorded.</p>}</Panel>}
    {tab === 'outings' && <Panel title="Launch and return log"><p className="text-xs text-slate-400">Launch is available during an active reservation. An unreturned outing continues to block launch even after its booked time.</p>{staff && <div className="flex flex-wrap gap-2">{bookings.filter((booking) => booking.status === 'booked' && !outings.some((outing) => outing.reservation_id === booking.id) && utcDate(booking.starts_at) <= new Date() && utcDate(booking.ends_at) > new Date()).map((booking) => <button key={booking.id} disabled={busy} className={buttonClass} onClick={() => run(async () => { await api.operation('/outings', 'POST', { reservation_id: booking.id }); }, 'Crew launch recorded.')}>Launch {booking.equipment_name}</button>)}</div>}<div className="space-y-3">{outings.map((outing) => <article key={outing.id} className="space-y-2 rounded-xl border border-slate-800 p-4"><h4 className="font-bold text-white">{bookings.find((booking) => booking.id === outing.reservation_id)?.equipment_name || 'Boat outing'}</h4><p className="text-xs text-slate-400">Launched {dateText(outing.launched_at)} · Expected return {dateText(outing.expected_return_at)}</p><p className={'text-sm ' + (outing.returned_at ? 'text-emerald-200' : utcDate(outing.expected_return_at) < new Date() ? 'text-rose-200' : 'text-amber-200')}>{outing.returned_at ? 'Returned ' + dateText(outing.returned_at) : utcDate(outing.expected_return_at) < new Date() ? 'Overdue — return not recorded' : 'On the water'}</p>{staff && !outing.returned_at && <button disabled={busy} className={buttonClass} onClick={() => run(async () => { await api.operation(`/outings/${outing.id}/return`, 'POST'); }, 'Return recorded.')}>Record return</button>}</article>)}</div>{!outings.length && <p className="text-sm text-slate-400">No outings recorded.</p>}</Panel>}
    {tab === 'delivery' && deliveries && <Panel title="Email delivery"><p className={'rounded-xl p-3 text-sm ' + (deliveries.email_configured ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200')}>{deliveries.email_configured ? 'SMTP is configured. Messages remain queued until the server confirms handoff.' : 'Email delivery needs configuration. Ask the server administrator to configure SMTP and PUBLIC_APP_URL. Copy invitation links manually in the meantime.'}</p><div className="space-y-2">{deliveries.messages.map((item) => <article key={item.id} className="rounded-xl border border-slate-800 p-3"><h4 className="text-sm font-bold text-white">{item.subject}</h4><p className="break-words text-xs text-slate-400">{item.recipient} · {item.status.replace(/_/g, ' ')} · {item.attempts} attempts</p>{item.last_error && <p className="mt-1 text-xs text-rose-200">{item.last_error}</p>}{item.status === 'failed' && <button disabled={busy} className={smallButtonClass} onClick={() => run(async () => { await api.operation(`/communications/${item.id}/retry`, 'POST'); }, 'Email queued for retry.')}>Retry</button>}</article>)}</div><button className={smallButtonClass} disabled={busy} onClick={() => run(async () => {}, 'Delivery status refreshed.')}>Refresh delivery status</button></Panel>}
    {crewEditor && <FormModal busy={busy} title={crewEditor.id ? 'Edit saved crew' : 'Create saved crew'} onClose={() => setCrewEditor(null)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); run(async () => { await api.operation(crewEditor.id ? `/crews/${crewEditor.id}` : '/crews', crewEditor.id ? 'PUT' : 'POST', crewEditor); setCrewEditor(null); }, 'Crew saved.'); }}>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}<Field label="Crew name"><input required maxLength={255} value={crewEditor.name} onChange={(event) => setCrewEditor({ ...crewEditor, name: event.target.value })} className={inputClass} /></Field><Field label="Search boats"><input value={boatSearch} onChange={(event) => setBoatSearch(event.target.value)} className={inputClass} /></Field><Field label="Boat"><select required value={crewEditor.equipment_id || ''} onChange={(event) => setCrewEditor({ ...crewEditor, equipment_id: Number(event.target.value), seats: {} })} className={inputClass}><option value="">Choose a boat</option>{boats.filter((boat) => boat.id === crewEditor.equipment_id || boat.name.toLowerCase().includes(boatSearch.toLowerCase())).map((boat) => <option key={boat.id} value={boat.id}>{boat.name} · {boat.category}</option>)}</select></Field><Field label="Search athletes for the seat selectors"><input value={athleteSearch} onChange={(event) => setAthleteSearch(event.target.value)} className={inputClass} /></Field><div className="grid gap-3 sm:grid-cols-2">{(boatSeats[equipment.find((item) => item.id === crewEditor.equipment_id)?.category || ''] || []).map((seat) => <Field key={seat} label={seat}><select required value={crewEditor.seats[seat] || ''} onChange={(event) => setCrewEditor({ ...crewEditor, seats: { ...crewEditor.seats, [seat]: Number(event.target.value) } })} className={inputClass}><option value="">Choose athlete</option>{athletes.filter((athlete) => athlete.id === crewEditor.seats[seat] || athlete.full_name.toLowerCase().includes(athleteSearch.toLowerCase())).map((athlete) => <option key={athlete.id} value={athlete.id} disabled={Object.entries(crewEditor.seats).some(([key, id]) => key !== seat && id === athlete.id)}>{athlete.full_name}</option>)}</select></Field>)}</div><button disabled={busy} className={buttonClass}>Save crew</button>
    </form></FormModal>}
    {bookingForm && <FormModal busy={busy} dirty={Boolean(bookingCrew || bookingSession || starts || ends)} title="Reserve a boat" onClose={() => setBookingForm(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); run(async () => { const session = sessions.find((item) => item.id === Number(bookingSession)); await api.operation('/reservations', 'POST', { crew_id: Number(bookingCrew), session_id: bookingSession ? Number(bookingSession) : null, starts_at: session ? utcDate(session.session_date).toISOString() : new Date(starts).toISOString(), ends_at: session ? new Date(utcDate(session.session_date).getTime() + session.duration_minutes * 60000).toISOString() : new Date(ends).toISOString() }); setBookingForm(false); }, 'Boat reserved.'); }}>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}<Field label="Search crews"><input value={bookingCrewSearch} onChange={(event) => setBookingCrewSearch(event.target.value)} placeholder="Search crew names" className={inputClass} /></Field><Field label="Saved crew"><select required value={bookingCrew} onChange={(event) => setBookingCrew(event.target.value)} className={inputClass}><option value="">Choose crew</option>{filterSelectedOptions(crewList, bookingCrewSearch, Number(bookingCrew)).map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select></Field><Field label="Search sessions"><input value={bookingSessionSearch} onChange={(event) => setBookingSessionSearch(event.target.value)} placeholder="Search session titles" className={inputClass} /></Field><Field label="Link to a session (optional)"><select value={bookingSession} onChange={(event) => setBookingSession(event.target.value)} className={inputClass}><option value="">Independent outing</option>{filterSelectedOptions(sessions.filter((session) => session.id === Number(bookingSession) || (session.status === 'scheduled' && utcDate(session.session_date) > new Date())), bookingSessionSearch, Number(bookingSession), (session) => session.title).map((session) => <option key={session.id} value={session.id}>{session.title} · {dateText(session.session_date)}</option>)}</select></Field>{!bookingSession && <div className="grid gap-3 sm:grid-cols-2"><Field label="Start"><input type="datetime-local" required value={starts} onChange={(event) => setStarts(event.target.value)} className={inputClass} /></Field><Field label="Expected return"><input type="datetime-local" required value={ends} onChange={(event) => setEnds(event.target.value)} className={inputClass} /></Field></div>}<p className="text-xs text-slate-400">A linked reservation follows the session's start and duration. All crew members must be assigned to that session.</p><button disabled={busy} className={buttonClass}>{busy ? 'Reserving…' : 'Reserve boat'}</button>
    </form></FormModal>}
    {damageForm && <FormModal busy={busy} title="Report equipment damage" onClose={() => setDamageForm(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); run(async () => { await api.operation('/damage', 'POST', { equipment_id: Number(damageEquipment), severity, description }); setDamageForm(false); }, 'Damage report recorded.'); }}>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}<Field label="Equipment"><select required value={damageEquipment} onChange={(event) => setDamageEquipment(event.target.value)} className={inputClass}><option value="">Choose equipment</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Severity"><select value={severity} onChange={(event) => setSeverity(event.target.value)} className={inputClass}><option value="advisory">Advisory — equipment may still be used</option><option value="grounded">Grounded — prevent booking and launch</option></select></Field><Field label="Describe the damage"><textarea required minLength={3} maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></Field><button disabled={busy} className={buttonClass}>{busy ? 'Submitting…' : 'Submit damage report'}</button>
    </form></FormModal>}
    {resolving != null && <FormModal busy={busy} title="Record repair" onClose={() => setResolving(null)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); run(async () => { await api.operation(`/damage/${resolving}/resolve`, 'POST', { resolution }); setResolving(null); }, 'Repair recorded.'); }}>{error && <p role="alert" className="text-sm text-rose-200">{error}</p>}<Field label="Work performed and return-to-service notes"><textarea required minLength={3} maxLength={2000} value={resolution} onChange={(event) => setResolution(event.target.value)} className={inputClass} /></Field><button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : 'Resolve report'}</button></form></FormModal>}
    {lifecycle && selected && <FormModal busy={busy} title={lifecycle + ' session'} onClose={() => setLifecycle('')}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); run(async () => { await api.operation(`/sessions/${selected.id}/lifecycle`, 'POST', { action: lifecycle, reason, ...(lifecycle === 'reschedule' ? { session_date: new Date(newDate).toISOString(), duration_minutes: duration } : {}) }); setLifecycle(''); }, 'Session updated and affected members notified.', lifecycle === 'cancel' ? { title: 'Cancel this session?', message: 'Participants will be notified and linked boat reservations will be released.', confirmLabel: 'Cancel session', danger: true } : undefined); }}>{error && <p role="alert" className="text-sm text-rose-200">{error}</p>}{lifecycle === 'reschedule' && <><Field label="New date and time"><input type="datetime-local" required value={newDate} onChange={(event) => setNewDate(event.target.value)} className={inputClass} /></Field><Field label="Duration (minutes)"><input type="number" min="1" max="1440" required value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={inputClass} /></Field></>}<Field label="Reason (visible to participants)"><textarea required minLength={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} /></Field><p className="text-xs text-slate-400">Cancellation releases linked reservations. Rescheduling checks people and boat conflicts. Restoring a session does not automatically restore cancelled reservations.</p><button disabled={busy} className={buttonClass}>{busy ? 'Updating…' : 'Confirm ' + lifecycle}</button></form></FormModal>}
  </div>;
};
