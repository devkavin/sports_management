"""Calendar query contract; compile real SQLAlchemy queries without a DB connection."""
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session, Query
from app.api.operations import sessions
from app.models.models import UserRole


def calendar_query(monkeypatch, role=UserRole.ADMIN, **window):
    captured = []
    monkeypatch.setattr(Query, 'all', lambda query: captured.append(query.statement) or [])
    with Session() as db:
        sessions(user=SimpleNamespace(id=12, club_id=7, role=role), db=db, **window)
    return captured[0].compile()


def test_calendar_range_is_utc_half_open_and_not_truncated_to_latest_500(monkeypatch):
    query = calendar_query(monkeypatch,
        starts_at=datetime(2026, 11, 1, tzinfo=timezone(timedelta(hours=5, minutes=30))),
        ends_at=datetime(2026, 12, 1, tzinfo=timezone.utc))
    sql = str(query)
    assert 'training_sessions.session_date >=' in sql
    assert 'training_sessions.session_date <' in sql
    assert datetime(2026, 10, 31, 18, 30) in query.params.values()
    assert 7 in query.params.values()
    assert 'LIMIT' not in sql


@pytest.mark.parametrize('window', [
    {'starts_at': datetime(2026, 11, 1)},
    {'ends_at': datetime(2026, 12, 1)},
    {'starts_at': datetime(2026, 12, 1), 'ends_at': datetime(2026, 11, 1)},
    {'starts_at': datetime(2026, 1, 1), 'ends_at': datetime(2027, 1, 1)},
])
def test_invalid_or_unbounded_calendar_ranges_are_rejected_before_query(monkeypatch, window):
    with pytest.raises(HTTPException) as error:
        calendar_query(monkeypatch, **window)
    assert error.value.status_code == 422


@pytest.mark.parametrize('role', [UserRole.TRAINER, UserRole.ATHLETE])
def test_date_filter_keeps_non_manager_assignment_permissions(monkeypatch, role):
    query = calendar_query(monkeypatch, role, starts_at=datetime(2026, 11, 1), ends_at=datetime(2026, 12, 1))
    assert 'schedule_assignments.user_id' in str(query)
    assert 'training_sessions.trainer_id' in str(query)
    assert 12 in query.params.values()


def test_unfiltered_list_keeps_existing_limit(monkeypatch):
    query = calendar_query(monkeypatch)
    assert 'LIMIT' in str(query)
    assert 500 in query.params.values()


def test_six_week_local_calendar_may_span_extra_hour_at_dst_fall_back(monkeypatch):
    # America/New_York's November 2026 grid: Oct 26 midnight to Dec 7 midnight.
    query = calendar_query(monkeypatch,
        starts_at=datetime(2026, 10, 26, 4, tzinfo=timezone.utc),
        ends_at=datetime(2026, 12, 7, 5, tzinfo=timezone.utc))
    assert 'LIMIT' not in str(query)
