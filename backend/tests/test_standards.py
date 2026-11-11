"""Performance standard rules; no database connections or writes."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace as R

import pytest
from fastapi import HTTPException
from pydantic import ValidationError


def payload(**changes):
    values = dict(name="2k standard", exercise_id=1, metric="duration", comparison="at_most",
                  target_value=420, protocol_distance_m=2000, protocol_duration_sec=None)
    values.update(changes)
    return values


@pytest.mark.parametrize("changes", [
    {"target_value": 0}, {"target_value": float("nan")}, {"target_value": float("inf")},
    {"protocol_distance_m": 2000.5}, {"target_value": 1e100}, {"protocol_duration_sec": 1e100, "protocol_distance_m": None, "metric": "watts", "comparison": "at_least"},
    {"protocol_distance_m": None}, {"protocol_duration_sec": 600},
    {"comparison": "at_least"}, {"stretch_value": 430},
    {"metric": "distance"}, {"metric": "reps"}, {"name": "  "},
    {"audience": "athletes"}, {"athlete_ids": [2]},
    {"effective_from": "2026-02-02", "effective_until": "2026-02-01"},
])
def test_invalid_standard_rejected(changes):
    from app.schemas.standards import StandardCreate
    with pytest.raises(ValidationError):
        StandardCreate(**payload(**changes))


def standard(**changes):
    values = payload(stretch_value=400, audience="club", athlete_ids=[], schedule_ids=[],
                     effective_from=None, effective_until=None, result_max_age_days=90, archived=False)
    values.update(changes)
    return R(**values)


NOW = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)


def result(**changes):
    values = dict(id=1, athlete_id=2, exercise_id=1, is_verified=True, actual_distance_m=2000,
                  actual_duration_sec=420, avg_split_seconds=105, avg_watts=300, recorded_date=NOW)
    values.update(changes)
    return R(**values)


@pytest.mark.parametrize("changes", [
    {"exercise_id": 9}, {"is_verified": False}, {"actual_distance_m": 1999},
    {"actual_duration_sec": None}, {"actual_duration_sec": float("inf")},
    {"recorded_date": NOW + timedelta(seconds=1)},
    {"recorded_date": NOW - timedelta(days=90, seconds=1)},
])
def test_incomparable_results_ignored(changes):
    from app.services.standards import evaluate_athlete
    row = evaluate_athlete(standard(), R(id=2, full_name="A"), [result(**changes)], NOW)
    assert row.status == "no_result"
    assert row.result_id is None


@pytest.mark.parametrize("value,status", [(400, "stretch"), (420, "meets"), (421, "below")])
def test_latest_result_and_inclusive_thresholds(value, status):
    from app.services.standards import evaluate_athlete
    row = evaluate_athlete(standard(), R(id=2, full_name="A"), [
        result(id=2, actual_duration_sec=value),
        result(id=1, recorded_date=NOW - timedelta(days=1), actual_duration_sec=390),
    ], NOW)
    assert (row.status, row.result_id, row.value) == (status, 2, value)


def test_effective_dates_and_freshness_boundary_are_inclusive_utc():
    from app.services.standards import evaluate_athlete
    athlete = R(id=2, full_name="A")
    s = standard(effective_from=date(2026, 8, 13), effective_until=NOW.date())
    assert evaluate_athlete(s, athlete, [result(recorded_date=NOW-timedelta(days=90))], NOW).status == "meets"
    s.effective_from = NOW.date() + timedelta(days=1)
    assert evaluate_athlete(s, athlete, [result()], NOW).status == "inactive"


def test_duration_protocol_and_distance_direction():
    from app.services.standards import evaluate_athlete
    from app.schemas.standards import StandardCreate
    data = StandardCreate(**payload(metric="distance", comparison="at_least", target_value=2000,
                                   stretch_value=2200, protocol_distance_m=None, protocol_duration_sec=600))
    s = standard(**data.model_dump())
    assert evaluate_athlete(s, R(id=2, full_name="A"), [result(actual_duration_sec=600, actual_distance_m=2200)], NOW).status == "stretch"
    assert evaluate_athlete(s, R(id=2, full_name="A"), [result(actual_duration_sec=601)], NOW).status == "no_result"


def test_audience_only_includes_active_club_athletes_and_actual_athlete_assignments():
    from app.services.standards import select_audience
    users = [R(id=2, club_id=1, is_active=True, role="athlete"),
             R(id=3, club_id=1, is_active=True, role="trainer"),
             R(id=4, club_id=2, is_active=True, role="athlete"),
             R(id=5, club_id=1, is_active=False, role="athlete")]
    assignments = [R(schedule_id=10, user_id=i, assignment_type=kind) for i, kind in [(2,"athlete"),(3,"trainer"),(4,"athlete"),(5,"athlete")]]
    assert [u.id for u in select_audience(standard(audience="schedules", schedule_ids=[10]), users, assignments, 1)] == [2]


def test_write_permission_and_stale_version_fail_without_mutating():
    from app.api.standards import ensure_editor, ensure_version
    for role in ["trainer", "athlete"]:
        with pytest.raises(HTTPException) as error:
            ensure_editor(R(role=role))
        assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        ensure_version(R(version=2), 1)
    assert error.value.status_code == 409


def test_update_and_archive_require_version():
    from app.schemas.standards import StandardUpdate, StandardArchive
    with pytest.raises(ValidationError):
        StandardUpdate(**payload())
    with pytest.raises(ValidationError):
        StandardArchive(archived=True)


def test_cross_club_lookup_is_scoped_and_missing_standard_is_404():
    from app.api.standards import scoped_standard
    from sqlalchemy.dialects import mysql
    class DB:
        def query(self, model):
            self.model = model
            return self
        def filter(self, *conditions):
            self.conditions = conditions
            return self
        def first(self):
            return None
    db = DB()
    with pytest.raises(HTTPException) as error:
        scoped_standard(db, R(club_id=7), 8)
    assert error.value.status_code == 404
    clauses = " ".join(str(c.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True})) for c in db.conditions)
    assert "performance_standards.club_id = 7" in clauses
    assert "performance_standards.id = 8" in clauses


def test_concurrent_save_rolls_back_and_returns_conflict():
    from app.api.standards import persist
    from sqlalchemy.orm.exc import StaleDataError
    class DB:
        rolled_back = False
        def flush(self):
            raise StaleDataError()
        def rollback(self):
            self.rolled_back = True
    db = DB()
    with pytest.raises(HTTPException) as error:
        persist(db, R(id=1, club_id=1), R(), "standard_updated")
    assert error.value.status_code == 409
    assert db.rolled_back


def test_successful_save_includes_before_and_after_in_same_transaction_audit():
    from app.api.standards import persist
    from app.models.standards import PerformanceStandard
    from app.schemas.standards import StandardCreate
    standard = PerformanceStandard(**StandardCreate(**payload()).model_dump(), id=1, club_id=7,
        archived=False, version=2, created_at=NOW, updated_at=NOW)
    class DB:
        def flush(self):
            pass
        def add(self, value):
            self.audit = value
        def commit(self):
            assert self.audit.details["after"]["version"] == 2
        def refresh(self, value):
            pass
    db = DB()
    persist(db, R(id=9, club_id=7), standard, "standard_updated", {"version": 1})
    assert db.audit.club_id == 7
    assert db.audit.actor_id == 9
    assert db.audit.details["before"] == {"version": 1}


def test_protocol_dates_and_archived_results_do_not_leak_into_active_evaluation():
    from app.services.standards import evaluate_athlete
    athlete = R(id=2, full_name="A")
    assert evaluate_athlete(standard(archived=True), athlete, [result()], NOW).status == "inactive"
    assert evaluate_athlete(standard(effective_from=NOW.date()), athlete,
        [result(recorded_date=NOW-timedelta(days=1))], NOW).status == "no_result"
    # An offset datetime is converted to UTC before date comparison.
    offset = timezone(timedelta(hours=14))
    recorded = datetime(2026, 11, 12, 0, tzinfo=offset)
    assert evaluate_athlete(standard(effective_until=NOW.date()), athlete,
        [result(recorded_date=recorded)], NOW).status == "meets"
