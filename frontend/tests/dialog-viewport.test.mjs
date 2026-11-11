import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let source = '';
try { source = readFileSync(new URL('../src/lib/dialogViewport.ts', import.meta.url), 'utf8'); } catch {}
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { mountDialogViewport } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));

test('dialog tracks the visible viewport when the keyboard opens or the viewport pans', () => {
  const viewport = Object.assign(new EventTarget(), { width: 320, height: 568, offsetTop: 0, offsetLeft: 0 });
  const host = Object.assign(new EventTarget(), { innerWidth: 320, innerHeight: 568, visualViewport: viewport });
  const values = {};
  const cleanup = mountDialogViewport({ style: { setProperty(name, value) { values[name] = value; } } }, host);
  assert.equal(values['--dialog-viewport-height'], '568px');
  viewport.height = 260; viewport.offsetTop = 42;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(values['--dialog-viewport-height'], '260px');
  assert.equal(values['--dialog-viewport-top'], '42px');
  viewport.offsetLeft = 5; viewport.dispatchEvent(new Event('scroll'));
  assert.equal(values['--dialog-viewport-left'], '5px');
  cleanup(); viewport.height = 100; viewport.dispatchEvent(new Event('resize'));
  assert.equal(values['--dialog-viewport-height'], '260px');
});

test('browsers without VisualViewport use window dimensions and update on rotation', () => {
  const host = Object.assign(new EventTarget(), { innerWidth: 320, innerHeight: 568, visualViewport: null });
  const values = {};
  const cleanup = mountDialogViewport({ style: { setProperty(name, value) { values[name] = value; } } }, host);
  host.innerWidth = 568; host.innerHeight = 320; host.dispatchEvent(new Event('resize'));
  assert.equal(values['--dialog-viewport-width'], '568px');
  assert.equal(values['--dialog-viewport-height'], '320px');
  cleanup();
});
