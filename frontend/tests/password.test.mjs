import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const path = new URL('../src/lib/password.ts', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const policy = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('new passwords use Unicode code points with inclusive 15–128 boundaries', () => {
  assert.equal(typeof policy.validateNewPassword, 'function');
  assert.match(policy.validateNewPassword('🌊'.repeat(14)), /15/);
  assert.equal(policy.validateNewPassword('🌊'.repeat(14) + 'x'), undefined);
  assert.equal(policy.validateNewPassword('🚣'.repeat(127) + 'x'), undefined);
  assert.match(policy.validateNewPassword('🚣'.repeat(128) + 'x'), /128/);
});

test('invalid password submission focuses the relevant field, not the submit button', () => {
  let focused;
  const form = { elements: { namedItem: (name) => ({ focus: () => { focused = name; } }) } };
  policy.focusNewPasswordError(form, 'new-password', { password: 'Too short', confirmation: 'Mismatch' });
  assert.equal(focused, 'new-password');
  policy.focusNewPasswordError(form, 'new-password', { confirmation: 'Mismatch' });
  assert.equal(focused, 'new-password-confirmation');
});

test('normalization preserves spaces and permits a passphrase without character mixtures', () => {
  assert.equal(policy.normalizePassword('  cafe\u0301 rowing crew  '), '  café rowing crew  ');
  assert.equal(policy.validateNewPassword('a quiet river at dawn'), undefined);
  assert.equal(policy.validateNewPassword(' '.repeat(14) + 'x'), undefined);
  assert.equal(policy.validateNewPassword('e\u0301'.repeat(14) + 'x'), undefined);
  assert.match(policy.validateNewPassword('e\u0301'.repeat(14)), /15/);
});

test('local baseline rejects common and repetitive new passwords', () => {
  assert.match(policy.validateNewPassword('passwordpassword'), /common|repetitive/i);
  assert.match(policy.validateNewPassword('aaaaaaaaaaaaaaa'), /common|repetitive/i);
  assert.match(policy.validateNewPassword('🚣'.repeat(15)), /common|repetitive/i);
});

test('confirmation compares normalized values without trimming meaningful spaces', () => {
  assert.equal(policy.validatePasswordConfirmation('a café on the river', 'a cafe\u0301 on the river'), undefined);
  assert.match(policy.validatePasswordConfirmation(' a quiet river at dawn', 'a quiet river at dawn'), /match/i);
  assert.match(policy.validatePasswordConfirmation('a quiet river at dawn', ''), /confirm/i);
});

test('submission reports password and confirmation errors before a request can run', () => {
  assert.deepEqual(policy.getNewPasswordErrors('short', 'different'), {
    password: 'Use at least 15 characters.', confirmation: 'Passwords do not match.',
  });
  assert.deepEqual(policy.getNewPasswordErrors('a quiet river at dawn', 'a quiet river at dawn'), {});
});
