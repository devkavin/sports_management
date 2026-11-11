import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
let role = 'admin';
function load(relative) {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), relative);
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  cache.set(path, module.exports);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => {
    if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { id: 1, role } }) };
    if (name.endsWith('/FeedbackContext')) return { useFeedback: () => ({ notify() {}, confirm() {} }), useUnsavedChanges() {} };
    if (name.endsWith('/AccessibleDialog')) return { AccessibleDialog: ({ children }) => React.createElement('section', {}, children) };
    if (name.endsWith('/NavigationContext')) return { useNavigation: () => ({ destination: { revision: 0 } }) };
    if (name.endsWith('/services/api')) return { api: {} }; // SSR does not run effects or make requests.
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(path), name);
    return load([base, base + '.ts', base + '.tsx'].find(existsSync));
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  cache.set(path, module.exports);
  return module.exports;
}

const { AttendanceCalendar } = load('../src/components/operations/AttendanceCalendar.tsx');
const props = {
  month: new Date(2026, 10, 1), selectedDate: null, loading: false, error: '',
  sessions: [{ id: 91, title: 'Morning water session', session_date: new Date(2026, 10, 9, 6).toISOString(), status: 'scheduled', duration_minutes: 60 }],
  onMonthChange() {}, onSelectDate() {}, onRetry() {},
};

test('calendar creation initializes both date fields to the selected local date', () => {
  const { CreateScheduleModal } = load('../src/components/schedule/CreateScheduleModal.tsx');
  const html = renderToStaticMarkup(React.createElement(CreateScheduleModal, {
    isOpen: true, initialDate: new Date(2027, 0, 3), competitions: [], exercises: [], members: [], onClose() {}, onSuccess() {},
  }));
  assert.equal((html.match(/type="date"[^>]*value="2027-01-03"/g) || []).length, 2);
});

test('standard creation starts club-wide with blank target and exposes optional audience choices', () => {
  const { StandardEditor } = load('../src/components/coach/PerformanceStandards.tsx');
  const html = renderToStaticMarkup(React.createElement(StandardEditor, {
    exercises: [], equipment: [], members: [], schedules: [], onClose() {}, onSaved() {},
  }));
  assert.match(html, /selected="" value="club"|value="club" selected=""/);
  assert.match(html, /Selected schedule rosters/);
  assert.match(html, /Selected athletes/);
  assert.match(html, /More options: dates, result age and notes/);
  assert.match(html, /Enter a target to preview/);
  assert.match(html, /Create a test exercise in Exercise library first/);
});

test('standard editor keeps deactivated audience selections visible for removal', () => {
  const { StandardEditor } = load('../src/components/coach/PerformanceStandards.tsx');
  const existing = { id: 1, version: 1, name: 'Test', exercise_id: 1, metric: 'duration', comparison: 'at_most', target_value: 420.04,
    stretch_value: null, protocol_distance_m: 2000, protocol_duration_sec: null, audience: 'athletes', athlete_ids: [3], schedule_ids: [],
    effective_from: null, effective_until: null, result_max_age_days: 90, notes: '', archived: false };
  const html = renderToStaticMarkup(React.createElement(StandardEditor, { existing,
    exercises: [], equipment: [], schedules: [], members: [{ id: 3, full_name: 'Inactive athlete', role: 'athlete', is_active: false }], onClose() {}, onSaved() {},
  }));
  assert.match(html, /Inactive athlete/);
  assert.match(html, /value="420.04"/);
});

test('regatta creation labels the race date and offers reusable plan creation', () => {
  const { CompetitionEditor } = load('../src/components/coach/CompetitionEditor.tsx');
  const html = renderToStaticMarkup(React.createElement(CompetitionEditor, { schedules: [], onClose() {}, onSaved() {} }));
  assert.match(html, /Regatta date \(date of the competition\)/);
  assert.match(html, /This competition spans multiple days/);
  assert.match(html, /Periodization plan/);
  assert.match(html, /Create plan/);
  assert.doesNotMatch(html, /Competition end date/);
});

test('editing a multi-day regatta retains its explicit race date and end date', () => {
  const { CompetitionEditor } = load('../src/components/coach/CompetitionEditor.tsx');
  const html = renderToStaticMarkup(React.createElement(CompetitionEditor, { schedules: [],
    competition: { id: 5, name: 'Race', competition_type: 'sprint_regatta', target_distance_m: 2000, start_date: '2027-02-11T00:00:00', end_date: '2027-02-13T00:00:00' }, onClose() {}, onSaved() {},
  }));
  assert.match(html, /Competition end date/);
  assert.match(html, /value="2027-02-11"/);
  assert.match(html, /value="2027-02-13"/);
});

test('calendar exposes dates as keyboard accessible buttons with session counts and real titles', () => {
  const html = renderToStaticMarkup(React.createElement(AttendanceCalendar, props));
  assert.match(html, /aria-label="Monday, November 9, 2026, 1 session"/);
  assert.match(html, /Morning water session/);
  assert.match(html, /aria-label="Previous month"/);
  assert.match(html, /aria-label="Next month"/);
});

test('day selection and month navigation send local dates without UTC conversion', () => {
  let selected, month;
  const tree = AttendanceCalendar({ ...props, onSelectDate: key => { selected = key; }, onMonthChange: value => { month = value; } });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    React.Children.forEach(node.props?.children, visit);
  }
  visit(tree);
  nodes.find(node => node.props?.['aria-label'] === 'Monday, November 9, 2026, 1 session').props.onClick();
  assert.equal(selected, '2026-11-09');
  nodes.find(node => node.props?.['aria-label'] === 'Previous month').props.onClick();
  assert.equal(month.getFullYear(), 2026);
  assert.equal(month.getMonth(), 9);
});

test('failed calendar requests display retry rather than implying an empty calendar', () => {
  const html = renderToStaticMarkup(React.createElement(AttendanceCalendar, { ...props, sessions: [], error: 'Connection unavailable' }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Retry calendar/);
  assert.match(html, /disabled="" aria-label="Monday, November 9/);
});

test('admins and coaches receive the same calendar view; athletes and trainers retain their register', () => {
  const { OperationsDashboard } = load('../src/components/operations/OperationsDashboard.tsx');
  for (role of ['admin', 'coach']) {
    const html = renderToStaticMarkup(React.createElement(OperationsDashboard));
    assert.match(html, /Sessions and attendance calendar/);
    assert.match(html, /List view/);
  }
  for (role of ['athlete', 'trainer']) {
    const html = renderToStaticMarkup(React.createElement(OperationsDashboard));
    assert.doesNotMatch(html, /Sessions and attendance calendar/);
    assert.match(html, /Choose a session/);
  }
});
