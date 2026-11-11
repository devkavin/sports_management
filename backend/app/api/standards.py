from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from app.api.deps import require_roles
from app.core.database import get_db
from app.models.models import User, UserRole, Exercise, Schedule, ScheduleAssignment, PerformanceEntry
from app.models.operations import AuditEvent
from app.models.standards import PerformanceStandard
from app.schemas.standards import StandardCreate, StandardUpdate, StandardArchive, StandardOut, StandardEvaluation
from app.services.standards import select_audience, evaluate_athlete

router = APIRouter(prefix="/standards", tags=["standards"])
staff = require_roles([UserRole.ADMIN, UserRole.COACH, UserRole.TRAINER])
editor = require_roles([UserRole.ADMIN, UserRole.COACH])


def ensure_editor(user):
    if user.role not in (UserRole.ADMIN, UserRole.COACH):
        raise HTTPException(403, "Only coaches and administrators may manage standards")


def ensure_version(standard, version):
    if standard.version != version:
        raise HTTPException(409, "This standard changed. Reload before saving.")


def scoped_standard(db, user, standard_id):
    standard = db.query(PerformanceStandard).filter(PerformanceStandard.id == standard_id,
        PerformanceStandard.club_id == user.club_id).first()
    if standard is None:
        raise HTTPException(404, "Standard not found")
    return standard


def validate_references(db, user, payload):
    exercise = db.query(Exercise).filter(Exercise.id == payload.exercise_id,
        Exercise.club_id == user.club_id, Exercise.is_active == True).first()
    if exercise is None:
        raise HTTPException(400, "Choose an active exercise in your club")
    if payload.athlete_ids:
        found = {row.id for row in db.query(User).filter(User.id.in_(payload.athlete_ids),
            User.club_id == user.club_id, User.role == UserRole.ATHLETE, User.is_active == True).all()}
        if found != set(payload.athlete_ids):
            raise HTTPException(400, "Choose active athletes in your club")
    if payload.schedule_ids:
        found = {row.id for row in db.query(Schedule).filter(Schedule.id.in_(payload.schedule_ids),
            Schedule.club_id == user.club_id, Schedule.is_active == True).all()}
        if found != set(payload.schedule_ids):
            raise HTTPException(400, "Choose active schedules in your club")


def persist(db, user, standard, action, before=None):
    try:
        db.flush()
        after = StandardOut.model_validate(standard).model_dump(mode="json")
        db.add(AuditEvent(club_id=user.club_id, actor_id=user.id, action=action,
            entity="performance_standard", entity_id=standard.id, details={"before": before, "after": after}))
        db.commit()
        db.refresh(standard)
    except StaleDataError:
        db.rollback()
        raise HTTPException(409, "This standard changed. Reload before saving.")
    return standard


@router.get("", response_model=list[StandardOut])
def list_standards(current_user: User = Depends(staff), db: Session = Depends(get_db)):
    return db.query(PerformanceStandard).filter(PerformanceStandard.club_id == current_user.club_id).order_by(
        PerformanceStandard.archived, PerformanceStandard.name, PerformanceStandard.id).all()


@router.post("", response_model=StandardOut, status_code=201)
def create_standard(payload: StandardCreate, current_user: User = Depends(editor), db: Session = Depends(get_db)):
    ensure_editor(current_user)
    validate_references(db, current_user, payload)
    standard = PerformanceStandard(club_id=current_user.club_id, **payload.model_dump())
    db.add(standard)
    return persist(db, current_user, standard, "standard_created")


@router.put("/{standard_id}", response_model=StandardOut)
def update_standard(standard_id: int, payload: StandardUpdate, current_user: User = Depends(editor), db: Session = Depends(get_db)):
    ensure_editor(current_user)
    standard = scoped_standard(db, current_user, standard_id)
    ensure_version(standard, payload.version)
    validate_references(db, current_user, payload)
    before = StandardOut.model_validate(standard).model_dump(mode="json")
    for key, value in payload.model_dump(exclude={"version"}).items():
        setattr(standard, key, value)
    # Explicit increment also protects no-op saves and concurrent archive actions.
    standard.version += 1
    return persist(db, current_user, standard, "standard_updated", before)


@router.post("/{standard_id}/archive", response_model=StandardOut)
def archive_standard(standard_id: int, payload: StandardArchive, current_user: User = Depends(editor), db: Session = Depends(get_db)):
    ensure_editor(current_user)
    standard = scoped_standard(db, current_user, standard_id)
    ensure_version(standard, payload.version)
    before = StandardOut.model_validate(standard).model_dump(mode="json")
    standard.archived = payload.archived
    standard.version += 1
    return persist(db, current_user, standard, "standard_archived" if payload.archived else "standard_restored", before)


@router.get("/{standard_id}/evaluations", response_model=list[StandardEvaluation])
def list_evaluations(standard_id: int, current_user: User = Depends(staff), db: Session = Depends(get_db)):
    standard = scoped_standard(db, current_user, standard_id)
    athletes = db.query(User).filter(User.club_id == current_user.club_id,
        User.role == UserRole.ATHLETE, User.is_active == True).order_by(User.full_name, User.id).all()
    assignments = []
    if standard.audience == "schedules":
        assignments = db.query(ScheduleAssignment).join(Schedule, Schedule.id == ScheduleAssignment.schedule_id).filter(
            Schedule.club_id == current_user.club_id, ScheduleAssignment.schedule_id.in_(standard.schedule_ids),
            ScheduleAssignment.assignment_type == "athlete").all()
    athletes = select_audience(standard, athletes, assignments, current_user.club_id)
    if not athletes:
        return []
    now = datetime.now(timezone.utc)
    results = db.query(PerformanceEntry).join(User, User.id == PerformanceEntry.athlete_id).filter(
        User.club_id == current_user.club_id, PerformanceEntry.athlete_id.in_([a.id for a in athletes]),
        PerformanceEntry.exercise_id == standard.exercise_id, PerformanceEntry.is_verified == True,
        PerformanceEntry.recorded_date >= (now-timedelta(days=standard.result_max_age_days)).replace(tzinfo=None),
        PerformanceEntry.recorded_date <= now.replace(tzinfo=None)).all()
    grouped = {}
    for result in results:
        grouped.setdefault(result.athlete_id, []).append(result)
    return [evaluate_athlete(standard, athlete, grouped.get(athlete.id, []), now) for athlete in athletes]
