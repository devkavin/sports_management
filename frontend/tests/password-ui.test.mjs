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
function load(relative) {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), relative);
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  cache.set(path, module.exports);
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const localRequire = (name) => {
    if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { full_name: 'River Coach', email: 'coach@example.com' } }) };
    if (name.endsWith('/FeedbackContext')) return { useUnsavedChanges: () => {} };
    if (name.endsWith('/services/api')) return { api: {} };
    if (name.endsWith('/common/FormPanel')) return {
      FormModal: ({ title, children }) => React.createElement('section', { 'aria-label': title }, children),
      Panel: ({ children }) => React.createElement('section', {}, children),
      Field: ({ label, children }) => React.createElement('label', {}, label, children),
      inputClass: '', buttonClass: '',
    };
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(path), name);
    return load([base, base + '.ts', base + '.tsx'].find((candidate) => existsSync(candidate)));
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  cache.set(path, module.exports);
  return module.exports;
}
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props));

test('sign in keeps one masked current-password field and no new-password policy', () => {
  const { AuthModal } = load('../src/components/auth/AuthModal.tsx');
  const markup = render(AuthModal, { isOpen: true, onClose() {} });
  assert.equal((markup.match(/type="password"/g) || []).length, 1);
  assert.match(markup, /autoComplete="current-password"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.doesNotMatch(markup, /minlength|Confirm new password/i);
});

test('club registration provides two new-password fields with accessible controls', () => {
  const { AuthModal } = load('../src/components/auth/AuthModal.tsx');
  const markup = render(AuthModal, { isOpen: true, initialMode: 'register', onClose() {} });
  assert.equal((markup.match(/autoComplete="new-password"/g) || []).length, 2);
  assert.match(markup, /Confirm new password/);
  assert.match(markup, /15–128 characters/);
});

test('account settings separates existing passwords from the confirmed new password', () => {
  const { AccountSettings } = load('../src/components/auth/AccountSettings.tsx');
  const markup = render(AccountSettings);
  assert.equal((markup.match(/autoComplete="current-password"/g) || []).length, 2);
  assert.equal((markup.match(/autoComplete="new-password"/g) || []).length, 2);
  assert.match(markup, /Weight \(kg\), optional/);
});

test('password recovery asks for confirmation while email confirmation asks for no password', () => {
  const { AccountRecovery } = load('../src/components/auth/AccountSettings.tsx');
  const reset = render(AccountRecovery, { action: 'password_reset', token: 'reset', onClose() {} });
  assert.equal((reset.match(/autoComplete="new-password"/g) || []).length, 2);
  const email = render(AccountRecovery, { action: 'email_change', token: 'email', onClose() {} });
  assert.doesNotMatch(email, /type="password"/);
});

test('new-password errors are linked to each input after submit and clear on corrected values', () => {
  const { NewPasswordFields } = load('../src/components/common/PasswordField.tsx');
  const props = { id: 'test-password', password: 'short', confirmation: 'different', submitted: true, onPasswordChange() {}, onConfirmationChange() {} };
  const markup = render(NewPasswordFields, props);
  assert.equal((markup.match(/aria-invalid="true"/g) || []).length, 2);
  assert.match(markup, /aria-describedby="test-password-hint test-password-error"/);
  assert.match(markup, /id="test-password-confirmation-error"/);
  assert.match(markup, /Passwords do not match/);
  const corrected = render(NewPasswordFields, { ...props, password: 'a quiet river at dawn', confirmation: 'a quiet river at dawn' });
  assert.doesNotMatch(corrected, /aria-invalid|Passwords do not match/);
  assert.equal((corrected.match(/type="button"/g) || []).length, 2);
});
