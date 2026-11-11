import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/performanceStandards.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { parseStandardTarget, standardDefaults, formatStandardValue, standardTargetInput } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));

test('time targets convert minutes to seconds without accepting invalid seconds or signs', () => {
  assert.equal(parseStandardTarget('7:15.5', 'duration'), 435.5);
  assert.equal(parseStandardTarget('1:35.0', 'split'), 95);
  for (const value of ['1:60', '-3', 'Infinity', '0', 'abc', '1:2']) assert.equal(parseStandardTarget(value, 'duration'), null);
  assert.equal(parseStandardTarget('250', 'watts'), 250);
  assert.equal(parseStandardTarget('7:15', 'distance'), null);
});
test('default audience is club and 2k exercise selection requires real RowErg equipment', () => {
  const exercises = [{ id: 7, category: 'erg_test', default_distance_m: 2000, equipment_id: 4, is_active: true }];
  assert.equal(standardDefaults(exercises, [{ id: 4, category: 'concept2_rowerg' }]).exercise_id, 7);
  assert.equal(standardDefaults(exercises, [{ id: 4, category: 'other' }]).exercise_id, 0);
  assert.equal(standardDefaults([], []).audience, 'club');
  assert.equal(standardDefaults([], []).target_value, undefined);
});
test('target display keeps units explicit', () => {
  assert.equal(formatStandardValue(435.5, 'duration'), '7:15.5 total');
  assert.equal(formatStandardValue(95, 'split'), '1:35.0 /500m');
  assert.equal(formatStandardValue(250, 'watts'), '250 W');
});

test('editing a time requirement preserves precision instead of rounding to the display value', () => {
  assert.equal(standardTargetInput(420.04), '420.04');
  assert.equal(parseStandardTarget(standardTargetInput(420.04), 'duration'), 420.04);
  assert.equal(formatStandardValue(420.04, 'duration'), '7:00.04 total');
});
