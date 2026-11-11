from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Competition, User, UserRole
from app.schemas.schemas import CompetitionCreate, CompetitionOut
from app.api.deps import get_current_user, require_roles
from app.api.periodization import scoped_plan, ensure_editor
from app.services.periodization import validate_race_date

router = APIRouter(prefix="/competitions", tags=["competitions"])


def validate_plan(db, user, payload, existing=None):
    if payload.periodization_plan_id is None:
        return
    plan = scoped_plan(db, user, payload.periodization_plan_id, lock=True)
    if plan.archived and (existing is None or existing.periodization_plan_id != plan.id):
        raise HTTPException(400, "Choose an active periodization plan")
    validate_race_date(plan.phases, payload.start_date)

@router.get("", response_model=List[CompetitionOut])
def list_competitions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comps = db.query(Competition).filter(Competition.club_id == current_user.club_id).order_by(Competition.start_date.asc()).all()
    return comps

@router.post("", response_model=CompetitionOut)
def create_competition(
    payload: CompetitionCreate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.COACH])),
    db: Session = Depends(get_db)
):
    ensure_editor(current_user)
    validate_plan(db, current_user, payload)
    comp = Competition(
        club_id=current_user.club_id,
        **payload.model_dump()
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/{competition_id}", response_model=CompetitionOut)
def update_competition(
    competition_id: int,
    payload: CompetitionCreate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.COACH])),
    db: Session = Depends(get_db)
):
    ensure_editor(current_user)
    comp = db.query(Competition).filter(Competition.id == competition_id,
        Competition.club_id == current_user.club_id).first()
    if comp is None:
        raise HTTPException(404, "Competition not found")
    validate_plan(db, current_user, payload, comp)
    for key, value in payload.model_dump().items():
        setattr(comp, key, value)
    db.commit()
    db.refresh(comp)
    return comp

@router.delete("/{competition_id}")
def delete_competition(
    competition_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.COACH])),
    db: Session = Depends(get_db)
):
    comp = db.query(Competition).filter(Competition.id == competition_id, Competition.club_id == current_user.club_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    db.delete(comp)
    db.commit()
    return {"message": "Competition deleted successfully"}
