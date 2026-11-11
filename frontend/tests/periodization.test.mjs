import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/components/periodization/planHelpers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const { validatePlan, scheduleFitsPhase, emptyPhase, timelineSegments, mergePlanSnapshots } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const phase = (start='2026-11-01', end='2026-11-03') => ({name:'Base',phase:'base_endurance',start_date:start,end_date:end,goals:'',schedule_ids:[]});

test('slow list snapshots cannot remove newly saved plans or overwrite newer versions', () => {
 const saved = [{id:1,version:2,name:'Edited plan'}, {id:2,version:1,name:'Created plan'}];
 const merged = mergePlanSnapshots([{id:1,version:1,name:'Old plan'}], saved);
 assert.deepEqual(merged.map(plan=>plan.name), ['Edited plan','Created plan']);
 assert.equal(mergePlanSnapshots([{id:1,version:3,name:'Newer server edit'}],saved)[0].name,'Newer server edit');
});
test('new phases leave dates and goals blank', () => { assert.equal(emptyPhase().start_date,''); assert.equal(emptyPhase().end_date,''); assert.equal(emptyPhase().goals,''); });
test('inclusive overlaps and impossible dates are rejected, unordered separated phases accepted', () => {
 assert.match(validatePlan({name:'Plan',description:'',phases:[phase(),phase('2026-11-03','2026-11-04')]}),/overlap/i);
 assert.match(validatePlan({name:'Plan',description:'',phases:[phase('2026-02-30','2026-03-02')]}),/date/i);
 assert.equal(validatePlan({name:'Plan',description:'',phases:[phase('2026-11-04','2026-11-05'),phase()]}),'');
});
test('phase count and regatta deadline are enforced', () => {
 assert.ok(validatePlan({name:'Plan',description:'',phases:[]}));
 assert.ok(validatePlan({name:'Plan',description:'',phases:Array.from({length:51},()=>phase())}));
 assert.match(validatePlan({name:'Plan',description:'',phases:[phase()]},'2026-11-02'),/regatta/i);
 assert.equal(validatePlan({name:'Plan',description:'',phases:[phase()]},'2026-11-03'),'');
});
test('only active schedules entirely inside inclusive phase bounds fit', () => {
 const schedule={is_active:true,start_date:'2026-11-01T00:00:00',end_date:'2026-11-03T00:00:00'};
 assert.equal(scheduleFitsPhase(schedule,phase()),true);
 assert.equal(scheduleFitsPhase({...schedule,is_active:false},phase()),false);
 assert.equal(scheduleFitsPhase({...schedule,end_date:'2026-11-04'},phase()),false);
});
test('timeline respects real duration and gaps', () => {
 const segments=timelineSegments([phase('2026-11-05','2026-11-05'),phase('2026-11-01','2026-11-02')]);
 assert.deepEqual(segments.map(s=>[s.left,s.width]),[[0,40],[80,20]]);
});
