import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Use a non-UTC browser zone to catch sessions appearing on the wrong date.
process.env.TZ = 'Asia/Colombo';
const source = readFileSync(new URL('../src/lib/attendanceCalendar.ts', import.meta.url), 'utf8');
const dates = readFileSync(new URL('../src/lib/dateTime.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(dates + '\n' + source.replace(/^import .*;\r?\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const calendar = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('UTC sessions around midnight are grouped by the displayed local day and sorted by time', () => {
  const rows = [
    { id: 1, session_date: '2026-10-31T20:00:00' },
    { id: 2, session_date: '2026-11-01T01:00:00Z' },
    { id: 3, session_date: '2026-10-31T18:00:00Z' },
  ];
  assert.deepEqual(calendar.sessionsOnDate(rows, '2026-11-01').map(row => row.id), [1, 2]);
});

test('month grids include complete Monday-first weeks across year boundaries', () => {
  const days = calendar.calendarDays(new Date(2027, 0, 1));
  assert.equal(calendar.localDateKey(days[0]), '2026-12-28');
  assert.equal(calendar.localDateKey(days.at(-1)), '2027-01-31');
  assert.equal(days.length, 35);
});

test('calendar API range includes padding days and uses exclusive UTC end', () => {
  assert.deepEqual(calendar.calendarRange(new Date(2027, 0, 1)), {
    starts_at: '2026-12-27T18:30:00.000Z', ends_at: '2027-01-31T18:30:00.000Z',
  });
});

test('unrecorded attendance is distinct from absent and RSVP going', () => {
  assert.deepEqual(calendar.attendanceTotals([
    { rsvp: 'going', checkin: null }, { rsvp: 'unknown', checkin: 'present' },
    { rsvp: 'declined', checkin: 'excused' }, { rsvp: 'going', checkin: 'absent' },
    { rsvp: 'unknown', checkin: 'no_show' },
  ]), { assigned: 5, present: 1, absent: 1, excused: 1, no_show: 1, unrecorded: 1 });
});

test('six-week grids across daylight-saving fall-back preserve local midnights', () => {
  process.env.TZ = 'America/New_York';
  try {
    assert.deepEqual(calendar.calendarRange(new Date(2026, 10, 1)), {
      starts_at: '2026-10-26T04:00:00.000Z', ends_at: '2026-12-07T05:00:00.000Z',
    });
  } finally { process.env.TZ = 'Asia/Colombo'; }
});
