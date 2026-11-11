from datetime import date, datetime, timezone
from fastapi import HTTPException
from app.schemas.periodization import PlanPhase


def utc_date(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if isinstance(value, datetime):
        return (value.astimezone(timezone.utc) if value.tzinfo else value).date()
    return value


def phase_rows(phases):
    return [p if isinstance(p, PlanPhase) else PlanPhase.model_validate(p) for p in phases]


def validate_phase_schedules(phases, schedules, club_id):
    found = {s.id: s for s in schedules if s.club_id == club_id and s.is_active}
    for phase in phase_rows(phases):
        for schedule_id in phase.schedule_ids:
            schedule = found.get(schedule_id)
            if schedule is None:
                raise HTTPException(400, "Choose active schedules in your club")
            if not (phase.start_date <= utc_date(schedule.start_date) <= utc_date(schedule.end_date) <= phase.end_date):
                raise HTTPException(400, "Linked schedules must fit inside their phase date window")


def validate_race_date(phases, start_date):
    if any(p.end_date > utc_date(start_date) for p in phase_rows(phases)):
        raise HTTPException(400, "All plan phases must finish on or before the regatta start date")
