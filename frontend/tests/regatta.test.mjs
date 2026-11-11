import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let source = '';
try { source = readFileSync(new URL('../src/lib/regatta.ts', import.meta.url), 'utf8'); } catch {}
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { regattaPayload } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
const draft = { name: ' Club race ', location: ' Lake ', distance: '2000', date: '2027-02-11', multiDay: false, endDate: '', planId: null, notes: '' };
test('single-day regattas save the selected calendar date as both UTC date bounds', () => {
  const data = regattaPayload(draft);
  assert.equal(data.start_date, '2027-02-11T00:00:00.000Z');
  assert.equal(data.end_date, data.start_date);
  assert.equal(data.name, 'Club race');
  assert.equal(data.periodization_plan_id, null);
});
test('multi-day regattas preserve an explicit end date and selected plan', () => {
  const data = regattaPayload({ ...draft, multiDay: true, endDate: '2027-02-13', planId: 9 });
  assert.equal(data.end_date, '2027-02-13T00:00:00.000Z');
  assert.equal(data.periodization_plan_id, 9);
});
test('invalid dates, inverted windows and fractional distances are rejected before saving', () => {
  for (const changes of [{ date: '2027-02-29' }, { date: '0001-01-01' }, { date: '' }, { multiDay: true, endDate: '2027-02-10' }, { distance: '2000.5' }, { name: ' ' }]) {
    assert.throws(() => regattaPayload({ ...draft, ...changes }));
  }
});
