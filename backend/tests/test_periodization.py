"""Periodization validation and persistence rules, with no database access."""
from datetime import datetime, timezone
from types import SimpleNamespace as R
import pytest
from pydantic import ValidationError
from fastapi import HTTPException


def phase(**changes):
    data = dict(name="Base", phase="base_endurance", start_date="2026-01-01",
                end_date="2026-01-31", goals="", schedule_ids=[])
    data.update(changes)
    return data


@pytest.mark.parametrize("changes", [dict(name=" "), dict(phases=[]), dict(phases=[phase()]*51),
    dict(phases=[phase(end_date="2025-01-01")]), dict(phases=[phase(start_date="0999-01-01")]), dict(phases=[phase(phase="fake")]),
    dict(phases=[phase(), phase(start_date="2026-01-31", end_date="2026-02-01")])])
def test_invalid_plans_rejected(changes):
    from app.schemas.periodization import PlanCreate
    data = dict(name="Season", phases=[phase()]); data.update(changes)
    with pytest.raises(ValidationError):
        PlanCreate(**data)


def test_phases_sorted_and_no_invented_values():
    from app.schemas.periodization import PlanCreate
    plan = PlanCreate(name=" Season ", phases=[phase(start_date="2026-02-01", end_date="2026-02-28"), phase()])
    assert plan.name == "Season"
    assert str(plan.phases[0].start_date) == "2026-01-01"
    assert plan.description == plan.phases[0].goals == ""
    assert plan.phases[0].schedule_ids == []


def test_versions_required():
    from app.schemas.periodization import PlanUpdate, PlanArchive
    with pytest.raises(ValidationError):
        PlanUpdate(name="Season", phases=[phase()])
    with pytest.raises(ValidationError):
        PlanArchive(archived=True)


@pytest.mark.parametrize("changes", [dict(name=" "), dict(target_distance_m=0),
    dict(end_date="2025-01-01"), dict(periodization_plan_id=-1), dict(target_distance_m=2147483648),
    dict(start_date="0999-01-01")])
def test_invalid_competition_rejected(changes):
    from app.schemas.schemas import CompetitionCreate
    data = dict(name="Race", start_date="2026-02-01", end_date="2026-02-01", target_distance_m=2000)
    data.update(changes)
    with pytest.raises(ValidationError):
        CompetitionCreate(**data)


def test_competition_dates_normalize_utc_and_default_single_day():
    from app.schemas.schemas import CompetitionCreate
    race = CompetitionCreate(name="Race", start_date="2026-02-02T02:00:00+05:30", target_distance_m=2000)
    assert race.start_date == datetime(2026, 2, 1)
    assert race.end_date == race.start_date


def test_permissions_and_version_conflicts():
    from app.api.periodization import ensure_editor, ensure_version
    for role in ("trainer", "athlete"):
        with pytest.raises(HTTPException) as exc:
            ensure_editor(R(role=role))
        assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:
        ensure_version(R(version=2), 1)
    assert exc.value.status_code == 409


def test_schedule_bounds_and_race_bounds():
    from app.services.periodization import validate_phase_schedules, validate_race_date
    from app.schemas.periodization import PlanCreate
    p = PlanCreate(name="Season", phases=[phase(schedule_ids=[2])])
    valid = R(id=2, club_id=1, is_active=True, start_date=datetime(2026,1,1), end_date=datetime(2026,1,31,23))
    validate_phase_schedules(p.phases, [valid], 1)
    for invalid in (R(**(vars(valid) | dict(club_id=9))), R(**(vars(valid) | dict(is_active=False))),
                    R(**(vars(valid) | dict(end_date=datetime(2026,2,1))))):
        with pytest.raises(HTTPException):
            validate_phase_schedules(p.phases, [invalid], 1)
    with pytest.raises(HTTPException):
        validate_phase_schedules(p.phases, [], 1)
    validate_race_date(p.phases, datetime(2026,1,31))
    with pytest.raises(HTTPException):
        validate_race_date(p.phases, datetime(2026,1,30))


def test_missing_plan_scopes_tenant():
    from app.api.periodization import scoped_plan
    from sqlalchemy.dialects import mysql
    class DB:
        def query(self, model): return self
        def filter(self, *conditions): self.conditions = conditions; return self
        def first(self): return None
    db=DB()
    with pytest.raises(HTTPException) as exc: scoped_plan(db, R(club_id=7), 8)
    assert exc.value.status_code == 404
    sql = " ".join(str(c.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds":True})) for c in db.conditions)
    assert "periodization_plans.club_id = 7" in sql
    assert "periodization_plans.id = 8" in sql


def test_stale_save_rollback():
    from app.api.periodization import persist
    from sqlalchemy.orm.exc import StaleDataError
    class DB:
        rolled_back=False
        def flush(self): raise StaleDataError()
        def rollback(self): self.rolled_back=True
    db=DB()
    with pytest.raises(HTTPException) as exc: persist(db, R(id=1,club_id=1), R(), "plan_updated")
    assert exc.value.status_code == 409 and db.rolled_back


def test_saved_audit_contains_before_after_and_same_transaction():
    from app.api.periodization import persist
    from app.models.periodization import PeriodizationPlan
    now = datetime(2026,1,1)
    plan = PeriodizationPlan(id=3, club_id=7, name="Season", description="", phases=[phase()],
        archived=False, version=2, created_at=now, updated_at=now)
    class DB:
        def flush(self): pass
        def add(self, value): self.audit=value
        def commit(self): assert self.audit.details["after"]["version"] == 2
        def refresh(self, value): pass
    db=DB()
    assert persist(db, R(id=9,club_id=7), plan, "plan_updated", {"version":1}) is plan
    assert db.audit.actor_id == 9 and db.audit.club_id == 7
    assert db.audit.details["before"] == {"version":1}


def test_plan_edits_validate_earliest_linked_race():
    from app.api.periodization import validate_references
    from app.schemas.periodization import PlanCreate
    p=PlanCreate(name="Season", phases=[phase()])
    class DB:
        def query(self, model): return self
        def filter(self, *conditions): self.conditions=conditions; return self
        def order_by(self, field): self.order=field; return self
        def first(self): return R(start_date=datetime(2026,1,30))
    db=DB()
    with pytest.raises(HTTPException) as exc: validate_references(db,R(club_id=7),p,3)
    assert exc.value.status_code == 400
    assert db.order.key == "start_date"
    assert "competitions.club_id" in str(db.conditions[0])


def test_competition_archived_plan_preservation_and_new_selection(monkeypatch):
    from app.api import competitions
    from app.schemas.schemas import CompetitionCreate
    plan=R(id=3, archived=True, phases=[phase()])
    monkeypatch.setattr(competitions,"scoped_plan",lambda *args,**kwargs:plan)
    payload=CompetitionCreate(name="Race", start_date="2026-02-01", target_distance_m=2000,periodization_plan_id=3)
    competitions.validate_plan(None,R(club_id=1),payload,R(periodization_plan_id=3))
    for existing in (None,R(periodization_plan_id=2)):
        with pytest.raises(HTTPException) as exc: competitions.validate_plan(None,R(club_id=1),payload,existing)
        assert exc.value.status_code == 400
    plan.archived=False
    payload.start_date=datetime(2026,1,15)
    with pytest.raises(HTTPException): competitions.validate_plan(None,R(club_id=1),payload)


def test_competition_update_missing_is_tenant_scoped_and_permission_checked():
    from app.api.competitions import update_competition
    from app.schemas.schemas import CompetitionCreate
    class DB:
        def query(self, model): return self
        def filter(self,*conditions): self.conditions=conditions; return self
        def first(self): return None
    db=DB()
    p=CompetitionCreate(name="Race",start_date="2026-02-01",target_distance_m=2000)
    with pytest.raises(HTTPException) as exc: update_competition(3,p,R(role="coach",club_id=7),db)
    assert exc.value.status_code == 404
    assert "competitions.club_id" in str(db.conditions[1])
    with pytest.raises(HTTPException) as exc: update_competition(3,p,R(role="athlete",club_id=7),db)
    assert exc.value.status_code == 403


def test_plan_routes_enforce_staff_read_and_editor_writes_without_lifespan():
    from app.api.periodization import staff, editor, router
    with pytest.raises(HTTPException) as exc: staff(R(role="athlete"))
    assert exc.value.status_code == 403
    assert staff(R(role="trainer")).role == "trainer"
    with pytest.raises(HTTPException) as exc: editor(R(role="trainer"))
    assert exc.value.status_code == 403
    for route in router.routes:
        current_user = next(d for d in route.dependant.dependencies if d.name == "current_user")
        assert current_user.call is (staff if "GET" in route.methods else editor)
