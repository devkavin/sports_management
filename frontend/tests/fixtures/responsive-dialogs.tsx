// Manual layout fixture served by Vite only. No data is sent to the backend.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { FeedbackProvider } from '../../src/context/FeedbackContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { NavigationProvider } from '../../src/context/NavigationContext';
import { FormModal, Field, inputClass, buttonClass } from '../../src/components/common/FormPanel';
import { LogPerformanceModal } from '../../src/components/performance/LogPerformanceModal';
import { CreateScheduleModal } from '../../src/components/schedule/CreateScheduleModal';
import { ScheduleSessionModal } from '../../src/components/schedule/ScheduleSessionModal';
import { StandardEditor } from '../../src/components/coach/PerformanceStandards';
import type { Exercise, Schedule, TrainingSession } from '../../src/types';

window.fetch = async () => { throw new Error('Layout fixture: network requests disabled'); };
const exercise = { id: 1, club_id: 1, name: 'Layout fixture — long exercise protocol name to check wrapping', category: 'erg_test', primary_metric: 'split_500m', default_distance_m: 2000, is_active: true } as Exercise;
const session = { id: 1, title: 'Layout fixture — a long training session title that must stay visible', exercises: [{ id: 1, exercise_id: 1, sets: 3, target_distance_m: 2000, target_stroke_rate: 28 }] } as TrainingSession;
const schedule = { id: 1, name: 'Layout fixture', start_date: '2027-01-01T00:00:00', end_date: '2027-01-01T23:59:00', sessions: [], athlete_ids: [], trainer_ids: [] } as Schedule;
const frame = new URLSearchParams(location.search).get('frame');
function Example() {
  const noop = () => {};
  if (frame === 'performance') return <LogPerformanceModal isOpen exercises={[exercise]} initialSession={session} onClose={noop} onSuccess={noop} />;
  if (frame === 'schedule') return <CreateScheduleModal isOpen exercises={[exercise]} competitions={[]} members={[]} onClose={noop} onSuccess={noop} />;
  if (frame === 'session') return <ScheduleSessionModal schedule={schedule} exercises={[exercise]} onClose={noop} onSuccess={noop} />;
  if (frame === 'standard') return <StandardEditor exercises={[exercise]} equipment={[]} members={[]} schedules={[]} onClose={noop} onSaved={noop} />;
  return <FormModal title="Layout fixture — a very long popup title that needs to wrap without hiding the close button" onClose={noop}><form className="space-y-4">{Array.from({ length: 24 }, (_, i) => <Field key={i} label={`Field ${i + 1}`}><input className={inputClass} placeholder="Layout-only input" /></Field>)}<button type="button" className={buttonClass}>Final action is reachable</button></form></FormModal>;
}
function Gallery() {
  const [scenario, setScenario] = useState('performance');
  return <main className="space-y-4 p-4"><h1 className="text-xl font-bold">Dialog layout QA — backend disabled</h1><label>Fixture <select className={inputClass} value={scenario} onChange={event => { setScenario(event.target.value); }}>{['performance', 'form', 'schedule', 'session', 'standard'].map(value => <option key={value}>{value}</option>)}</select></label><div className="flex flex-wrap items-start gap-6">{[[320, 568], [568, 320], [375, 667], [1024, 600]].map(([width, height]) => <section key={`${width}×${height}`}><h2>{width}×{height}</h2><iframe title={`${width}×${height} ${scenario}`} src={`?frame=${scenario}`} width={width} height={height} className="mt-2 border border-slate-600" /></section>)}</div></main>;
}
createRoot(document.getElementById('root')!).render(frame ? <FeedbackProvider><AuthProvider><NavigationProvider><Example /></NavigationProvider></AuthProvider></FeedbackProvider> : <Gallery />);
