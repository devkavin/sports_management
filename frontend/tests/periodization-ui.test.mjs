import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const here=resolve(dirname(fileURLToPath(import.meta.url)),'../src/components/periodization');
function load(file) {
 const path=resolve(here,file), module={exports:{}};
 const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const localRequire=name=>{
  if(name.endsWith('/services/api'))return {api:{}};
  if(name.endsWith('/common/FormPanel'))return {FormModal:({children})=>React.createElement('section',{},children),Field:({label,children})=>React.createElement('label',{},label,children),inputClass:'',buttonClass:'',smallButtonClass:''};
  if(!name.startsWith('.'))return require(name);
  const base=resolve(dirname(path),name);
  return load([base,base+'.ts',base+'.tsx'].find(existsSync));
 };
 new Function('require','module','exports',output)(localRequire,module,module.exports);
 return module.exports;
}
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
const phase={name:'Peak',phase:'race_pace_peak',start_date:'2026-11-01',end_date:'2026-11-03',goals:'Explicit coach goal',schedule_ids:[99]};
test('saved preview exposes dates, phase, goals and no automatic session claim',()=>{
 const {PlanPreview}=load('./PlanPreview.tsx');
 const markup=render(PlanPreview,{plan:{name:'Season',description:'',phases:[phase]}});
 assert.match(markup,/2026-11-01/);assert.match(markup,/2026-11-03/);assert.match(markup,/Race pace/);assert.match(markup,/Explicit coach goal/);assert.match(markup,/No schedules or sessions are created automatically/);
});
test('new editor has blank dates and goals, required fields and regatta maximum',()=>{
 const {PlanEditor}=load('./PlanEditor.tsx');
 const markup=render(PlanEditor,{schedules:[],regattaDate:'2026-12-01',onClose(){},onSaved(){}});
 assert.equal((markup.match(/type="date"/g)||[]).length,2);
 assert.equal((markup.match(/max="2026-12-01"/g)||[]).length,2);
 assert.match(markup,/value=""/);assert.match(markup,/Goals \(optional\)/);assert.doesNotMatch(markup,/Explicit coach goal/);
});
test('editing keeps unavailable selected schedule references visible and removable',()=>{
 const {PlanEditor}=load('./PlanEditor.tsx');
 const markup=render(PlanEditor,{existing:{id:1,name:'Season',description:'',phases:[phase],version:1},schedules:[],onClose(){},onSaved(){}});
 assert.match(markup,/Unavailable schedule #99/);assert.match(markup,/Remove<\/button>/);assert.match(markup,/unavailable in this window/);
});
