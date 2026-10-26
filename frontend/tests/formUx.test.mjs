import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function load(path) {
  let source;
  try { source = readFileSync(new URL(path, import.meta.url), 'utf8'); } catch { return {}; }
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
}
const ux = await load('../src/lib/formUx.ts');

test('busy editors cannot close, clean editors close without a confirmation, dirty editors wait for consent', async () => {
  let questions = 0;
  const yes = async () => { questions++; return true; };
  assert.equal(await ux.mayCloseEditor({ busy: true, dirty: true }, yes), false);
  assert.equal(await ux.mayCloseEditor({ busy: false, dirty: false }, yes), true);
  assert.equal(questions, 0);
  assert.equal(await ux.mayCloseEditor({ busy: false, dirty: true }, async () => false), false);
  assert.equal(await ux.mayCloseEditor({ busy: false, dirty: true }, yes), true);
  assert.equal(questions, 1);
});

test('browser back cancellation restores the accepted URL while waiting and commits only after approval', async () => {
  let url = '#previous', answer;
  const waiting = new Promise((resolve) => { answer = resolve; });
  const result = ux.guardBrowserNavigation('#previous', '#editing', () => waiting, (next) => { url = next; });
  assert.equal(url, '#editing');
  answer(false);
  assert.equal(await result, false);
  assert.equal(url, '#editing');
  assert.equal(await ux.guardBrowserNavigation('#next', '#editing', async () => true, (next) => { url = next; }), true);
  assert.equal(url, '#next');
});

test('search filters retain selected choices independently of the search phrase', () => {
  const crews = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
  const sessions = [{ id: 7, name: 'Morning' }, { id: 8, name: 'Evening' }];
  assert.deepEqual(ux.filterSelectedOptions(crews, 'beta', 1), crews);
  assert.deepEqual(ux.filterSelectedOptions(sessions, 'morning', 8), sessions);
  assert.deepEqual(ux.filterSelectedOptions(crews, 'missing', 1), [crews[0]]);
  assert.deepEqual(ux.filterSelectedOptions([{ id: 9, title: 'Morning' }, { id: 10, title: 'Evening' }], 'morning', 10, (item) => item.title).map((item) => item.id), [9, 10]);
});

test('request fallbacks explain recovery and never return server traces', () => {
  assert.match(ux.requestFailureMessage(0), /connection|network/i);
  assert.match(ux.requestFailureMessage(401), /sign in/i);
  assert.match(ux.requestFailureMessage(503), /try again/i);
  assert.doesNotMatch(ux.requestFailureMessage(500), /HTTP|trace/i);
});

test('modal stack gives Escape only to the top dialog and preserves order when a parent unmounts', () => {
  const stack = ux.createModalStack();
  const parent = {}, child = {};
  stack.add(parent); stack.add(child);
  assert.equal(stack.isTop(parent), false);
  assert.equal(stack.isTop(child), true);
  stack.remove(parent);
  assert.equal(stack.isTop(child), true);
  stack.remove(child);
  assert.equal(stack.size, 0);
});

// Load real component modules without a bundler. Only the browser portal transport
// is replaced for server rendering; React context and component code execute normally.
const require = createRequire(import.meta.url);
const cache = new Map();
const browserGlobals = { document: { body: {} }, window: {} };
function component(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = (name) => {
    if (name === 'react-dom') return { createPortal: (children) => children };
    if (!name.startsWith('.')) return require(name);
    const target = resolve(dirname(path), name);
    for (const extension of ['.tsx', '.ts']) { try { readFileSync(target + extension); return component(target + extension); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
    return require(target);
  };
  vm.runInNewContext(output, { require: localRequire, module, exports: module.exports, ...browserGlobals, console }, { filename: path });
  return module.exports;
}

test('real FormModal preserves its title, dialog semantics, content and disabled close contract while busy', () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const { FeedbackProvider } = component(resolve(root, '../src/context/FeedbackContext.tsx'));
  const { FormModal, Field, Panel } = component(resolve(root, '../src/components/common/FormPanel.tsx'));
  const html = renderToStaticMarkup(React.createElement(FeedbackProvider, null,
    React.createElement(FormModal, { title: 'Edit crew', busy: true, dirty: true, onClose() {} },
      React.createElement(Panel, { title: 'Crew' }, React.createElement(Field, { label: 'Name' }, React.createElement('input', { defaultValue: 'Alpha' }))))));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-label="Edit crew"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Close dialog"/);
  assert.match(html, /value="Alpha"/);
  assert.match(html, />Name<input/);
});

test('member profile saves do not ask for access confirmation unless role or access changes', () => {
  const original = { id: 1, full_name: 'Alex', role: 'athlete', is_active: true };
  assert.equal(ux.memberAccessConfirmation(original, { ...original, full_name: 'Alex Smith' }, 2), null);
  assert.match(ux.memberAccessConfirmation(original, { ...original, role: 'coach' }, 2).message, /coach/);
  assert.equal(ux.memberAccessConfirmation(original, { ...original, is_active: false }, 2).danger, true);
  assert.match(ux.memberAccessConfirmation(original, { ...original, role: 'coach' }, 1).message, /sign you out/i);
});

test('nested dialog lifecycle keeps the background inert and scroll locked until the final dialog leaves', () => {
  const events = new Map();
  const doc = { activeElement: null, body: { children: [], style: { overflow: 'auto' } }, addEventListener(name, handler) { const list = events.get(name) || new Set(); list.add(handler); events.set(name, list); }, removeEventListener(name, handler) { events.get(name)?.delete(handler); } };
  class Element {
    constructor(parent = null) { this.parent = parent; this.children = []; this.inert = false; this.style = {}; this.isConnected = true; this.hidden = false; if (parent) parent.children.push(this); }
    focus() { doc.activeElement = this; }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
    closest() { return this.inert ? this : this.parent?.closest() || null; }
    getClientRects() { return [{}]; }
    querySelectorAll() { return this.children; }
  }
  const background = new Element(); const trigger = new Element(background); const alreadyInert = new Element(); alreadyInert.inert = true;
  const parentLayer = new Element(); const parentDialog = new Element(parentLayer); const editorButton = new Element(parentDialog);
  const childLayer = new Element(); const childDialog = new Element(childLayer); const cancelButton = new Element(childDialog); const confirmButton = new Element(childDialog);
  doc.body.children = [background, alreadyInert, parentLayer]; trigger.focus();
  const globals = { document: doc, HTMLElement: Element, MutationObserver: class { observe() {} disconnect() {} } };
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/modalLifecycle.ts');
  // Fresh runtime binds this DOM model to the same production lifecycle function.
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: () => ux, ...globals });
  const { mountDialog } = module.exports;
  let parentEscapes = 0, childEscapes = 0;
  const removeParent = mountDialog(parentLayer, parentDialog, () => parentEscapes++);
  editorButton.focus(); doc.body.children.push(childLayer);
  const removeChild = mountDialog(childLayer, childDialog, () => childEscapes++);
  assert.equal(background.inert, true); assert.equal(parentLayer.inert, true); assert.equal(childLayer.inert, false);
  assert.equal(doc.body.style.overflow, 'hidden');
  for (const handler of events.get('keydown')) handler({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(parentEscapes, 0); assert.equal(childEscapes, 1);
  confirmButton.focus();
  for (const handler of events.get('keydown')) handler({ key: 'Tab', preventDefault() {}, shiftKey: false });
  assert.equal(doc.activeElement, cancelButton);
  removeChild();
  assert.equal(doc.activeElement, editorButton); assert.equal(parentLayer.inert, false); assert.equal(background.inert, true);
  assert.equal(doc.body.style.overflow, 'hidden');
  removeParent();
  assert.equal(doc.activeElement, trigger); assert.equal(background.inert, false); assert.equal(alreadyInert.inert, true);
  assert.equal(doc.body.style.overflow, 'auto');

  // Route changes can remove an editor before its confirmation unmounts.
  doc.body.children = [background, alreadyInert, parentLayer]; trigger.focus();
  const removeParentFirst = mountDialog(parentLayer, parentDialog, () => {});
  editorButton.focus(); doc.body.children.push(childLayer);
  const removeChildLast = mountDialog(childLayer, childDialog, () => {});
  removeParentFirst(); editorButton.isConnected = false;
  assert.equal(doc.activeElement, childDialog);
  removeChildLast();
  assert.equal(doc.activeElement, trigger);
});

test('real API requests explain network failures and preserve field validation without exposing server traces', async () => {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../src/services/api.ts');
  const source = readFileSync(path, 'utf8').replace('import.meta.env.VITE_API_URL', 'undefined');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let response;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: () => ux, localStorage: { getItem: () => null }, fetch: async () => { if (response instanceof Error) throw response; return response; } });
  const { api } = module.exports;
  response = new Error('Failed to fetch');
  await assert.rejects(api.getClubMembers(), /Check your network connection/i);
  response = { ok: false, status: 503, json: async () => ({ detail: 'Traceback: database_password=secret' }) };
  await assert.rejects(api.getClubMembers(), (error) => /try again/i.test(error.message) && !/Traceback|secret/.test(error.message));
  response = { ok: false, status: 403, json: async () => { throw new Error('Unexpected HTML'); } };
  await assert.rejects(api.getClubMembers(), /permission.*administrator/i);
  response = { ok: false, status: 422, json: async () => ({ detail: [{ loc: ['body', 'email'], type: 'value_error.email', msg: 'Invalid' }] }) };
  await assert.rejects(api.getClubMembers(), /Email address: Enter a valid email address/);
});
