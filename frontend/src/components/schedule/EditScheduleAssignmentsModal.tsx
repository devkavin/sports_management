import { EditorDialog } from '../common/FormPanel';
import { useFeedback } from '../../context/FeedbackContext';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Schedule, User } from '../../types';
import { api } from '../../services/api';
import { AssignmentSelector } from './AssignmentSelector';

interface EditScheduleAssignmentsModalProps {
  schedule: Schedule | null;
  members: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export const EditScheduleAssignmentsModal: React.FC<EditScheduleAssignmentsModalProps> = ({
  schedule,
  members,
  onClose,
  onSuccess,
}) => {
  const { notify, confirm } = useFeedback();
  const [athleteIds, setAthleteIds] = useState<number[]>([]);
  const [trainerIds, setTrainerIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const sessionChecks = useMemo(() => (schedule?.sessions || []).map((session) => ({
    starts_at: session.session_date,
    duration_minutes: session.duration_minutes || 60,
  })), [schedule]);

  useEffect(() => {
    setAthleteIds(schedule?.athlete_ids || []);
    setTrainerIds(schedule?.trainer_ids || []);
  }, [schedule]);

  if (!schedule) return null;

  const save = async () => {
    if (!athleteIds.length) {
      notify('Select at least one athlete for this schedule.');
      return;
    }
    setSaving(true);
    try {
      await api.updateScheduleAssignments(schedule.id, {
        athlete_ids: athleteIds,
        trainer_ids: trainerIds,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      notify(`Unable to update assignments: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorDialog title="Manage schedule assignments" onClose={onClose} busy={saving} dirty={JSON.stringify([athleteIds, trainerIds]) !== JSON.stringify([schedule.athlete_ids || [], schedule.trainer_ids || []])} className="w-full max-w-2xl rounded-3xl outline-none">
      <div className="min-w-0 w-full space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="min-w-0 break-words">
            <h2 className="text-base font-bold text-white">Manage schedule assignments</h2>
            <p className="mt-1 text-xs text-slate-400">{schedule.name}</p>
          </div>
          <button type="button" data-editor-dismiss aria-label="Close assignments editor" onClick={onClose} className="shrink-0 rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <AssignmentSelector
          members={members}
          athleteIds={athleteIds}
          trainerIds={trainerIds}
          onAthleteIdsChange={setAthleteIds}
          onTrainerIdsChange={setTrainerIds}
          sessions={sessionChecks}
          excludeScheduleId={schedule.id}
        />

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button type="button" data-editor-dismiss onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> {saving ? 'Saving...' : 'Save assignments'}
          </button>
        </div>
      </div>
    </EditorDialog>
  );
};
