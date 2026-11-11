import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let source = '';
try { source = readFileSync(new URL('../src/lib/tourPlacement.ts', import.meta.url), 'utf8'); } catch {}
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { tourPlacement } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
test('tour cards stay inside narrow, short, zoomed and keyboard-sized viewports', () => {
  for (const [width, height] of [[320, 568], [568, 240], [240, 320], [1280, 720]]) {
    for (const placement of ['top', 'bottom', 'left', 'right']) {
      const rect = tourPlacement({ width, height, top: 20, left: 0 }, { top: height - 20, bottom: height, left: width - 20, right: width }, placement, 500);
      assert.ok(rect.left >= 8);
      assert.ok(rect.top >= 28);
      assert.ok(rect.left + rect.width <= width - 8);
      assert.ok(rect.top + rect.maxHeight <= height + 12);
    }
  }
});
