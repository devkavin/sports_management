"""Pure, explicit comparability rules for performance standards."""
from datetime import datetime, timedelta, timezone
from math import isfinite
from app.schemas.standards import StandardEvaluation


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def select_audience(standard, athletes, assignments, club_id):
    ids = None
    if standard.audience == "athletes":
        ids = set(standard.athlete_ids)
    elif standard.audience == "schedules":
        ids = {a.user_id for a in assignments if a.schedule_id in standard.schedule_ids and a.assignment_type == "athlete"}
    return [a for a in athletes if a.club_id == club_id and a.is_active and a.role == "athlete"
            and (ids is None or a.id in ids)]


def evaluate_athlete(standard, athlete, results, now=None):
    now = utc(now or datetime.now(timezone.utc))
    output = StandardEvaluation(athlete_id=athlete.id, athlete_name=athlete.full_name, status="no_result")
    if standard.archived or (standard.effective_from and now.date() < standard.effective_from) or (
            standard.effective_until and now.date() > standard.effective_until):
        output.status = "inactive"
        return output
    field = {"duration": "actual_duration_sec", "split": "avg_split_seconds",
             "watts": "avg_watts", "distance": "actual_distance_m"}[standard.metric]
    comparable = []
    for result in results:
        if result.athlete_id != athlete.id or result.exercise_id != standard.exercise_id or not result.is_verified:
            continue
        if standard.protocol_distance_m is not None and result.actual_distance_m != standard.protocol_distance_m:
            continue
        if standard.protocol_duration_sec is not None and result.actual_duration_sec != standard.protocol_duration_sec:
            continue
        value = getattr(result, field, None)
        if value is None or not isfinite(value) or value <= 0 or result.recorded_date is None:
            continue
        recorded = utc(result.recorded_date)
        if recorded > now or recorded < now-timedelta(days=standard.result_max_age_days):
            continue
        if standard.effective_from and recorded.date() < standard.effective_from:
            continue
        if standard.effective_until and recorded.date() > standard.effective_until:
            continue
        comparable.append((recorded, result.id, result, value))
    if not comparable:
        return output
    recorded, _, result, value = max(comparable, key=lambda row: (row[0], row[1]))
    meets = (lambda threshold: value <= threshold) if standard.comparison == "at_most" else (lambda threshold: value >= threshold)
    output.status = "stretch" if standard.stretch_value is not None and meets(standard.stretch_value) else "meets" if meets(standard.target_value) else "below"
    output.value, output.result_id, output.recorded_date = value, result.id, recorded
    return output
