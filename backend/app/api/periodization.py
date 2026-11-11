from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from app.api.deps import require_roles
from app.core.database import get_db
from app.models.models import Competition, Schedule, User, UserRole
from app.models.operations import AuditEvent
from app.models.periodization import PeriodizationPlan
from app.schemas.periodization import PlanCreate, PlanUpdate, PlanArchive, PlanOut
from app.services.periodization import validate_phase_schedules, validate_race_date

router = APIRouter(prefix="/periodization-plans", tags=["periodization-plans"])
staff = require_roles([UserRole.ADMIN, UserRole.COACH, UserRole.TRAINER])
editor = require_roles([UserRole.ADMIN, UserRole.COACH])


def ensure_editor(user):
    if user.role not in (UserRole.ADMIN, UserRole.COACH):
        raise HTTPException(403, "Only coaches and administrators may manage periodization plans")


def ensure_version(plan, version):
    if plan.version != version:
        raise HTTPException(409, "This plan changed. Reload before saving.")


def scoped_plan(db, user, plan_id, lock=False):
    query = db.query(PeriodizationPlan).filter(PeriodizationPlan.id == plan_id,
        PeriodizationPlan.club_id == user.club_id)
    if lock:
        query = query.with_for_update()
    plan = query.first()
    if plan is None:
        raise HTTPException(404, "Periodization plan not found")
    return plan


def validate_references(db, user, payload, plan_id=None):
    ids = {i for p in payload.phases for i in p.schedule_ids}
    schedules = db.query(Schedule).filter(Schedule.id.in_(ids), Schedule.club_id == user.club_id,
        Schedule.is_active == True).all() if ids else []
    validate_phase_schedules(payload.phases, schedules, user.club_id)
    if plan_id is not None:
        # Plan row is locked before this read; competition writes acquire the same lock.
        earliest = db.query(Competition).filter(Competition.club_id == user.club_id,
            Competition.periodization_plan_id == plan_id).order_by(Competition.start_date).first()
        if earliest is not None:
            validate_race_date(payload.phases, earliest.start_date)


def persist(db, user, plan, action, before=None):
    try:
        db.flush()
        after = PlanOut.model_validate(plan).model_dump(mode="json")
        db.add(AuditEvent(club_id=user.club_id, actor_id=user.id, action=action,
            entity="periodization_plan", entity_id=plan.id, details={"before": before, "after": after}))
        db.commit()
        db.refresh(plan)
    except StaleDataError:
        db.rollback()
        raise HTTPException(409, "This plan changed. Reload before saving.")
    return plan


@router.get("", response_model=list[PlanOut])
def list_plans(current_user: User = Depends(staff), db: Session = Depends(get_db)):
    return db.query(PeriodizationPlan).filter(PeriodizationPlan.club_id == current_user.club_id).order_by(
        PeriodizationPlan.archived, PeriodizationPlan.name, PeriodizationPlan.id).all()


@router.post("", response_model=PlanOut, status_code=201)
def create_plan(payload: PlanCreate, current_user: User = Depends(editor), db: Session = Depends(get_db)):
    ensure_editor(current_user)
    validate_references(db, current_user, payload)
    plan = PeriodizationPlan(club_id=current_user.club_id, **payload.model_dump(mode="json"))
    db.add(plan)
    return persist(db, current_user, plan, "plan_created")


@router.put("/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, payload: PlanUpdate, current_user: User = Depends(editor), db: Session = Depends(get_db)):
    ensure_editor(current_user)
    plan = scoped_plan(db, current_user, plan_id, lock=True)
    ensure_version(plan, payload.version)
    validate_references(db, current_user, payload, plan_id)
    before = PlanOut.model_validate(plan).model_dump(mode="json")
    for key, value in payload.model_dump(mode="json", exclude={"version"}).items():
        setattr(plan, key, value)
    plan.version += 1
    return persist(db, current_user, plan, "plan_updated", before)


@router.post("/{plan_id}/archive", response_model=PlanOut)
def archive_plan(plan_id: int, payload: PlanArchive, current_user: User = Depends(editor), db: Session = Depends(get_db)):
    ensure_editor(current_user)
    plan = scoped_plan(db, current_user, plan_id, lock=True)
    ensure_version(plan, payload.version)
    before = PlanOut.model_validate(plan).model_dump(mode="json")
    plan.archived = payload.archived
    plan.version += 1
    return persist(db, current_user, plan, "plan_archived" if payload.archived else "plan_restored", before)
