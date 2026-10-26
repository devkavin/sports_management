from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.models import User, Club, UserRole
from app.schemas.schemas import Token, LoginRequest, ClubCreate, UserCreate, UserOut
from app.api.deps import get_current_user
from app.core.security import password_needs_rehash
import secrets

router = APIRouter(prefix="/auth", tags=["auth"])
_dummy_hash = get_password_hash(secrets.token_urlsafe(32))
LOGIN_ERROR = 'Incorrect email or password. Try again, or use Forgot password to reset it.'


def _authenticate(db, email: str, password: str):
    normalized = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized).first()
    if not user:
        verify_password(password, _dummy_hash)
        raise HTTPException(status_code=401, detail=LOGIN_ERROR)
    if not verify_password(password, user.hashed_password) or not user.is_active:
        raise HTTPException(status_code=401, detail=LOGIN_ERROR)
    if password_needs_rehash(user.hashed_password):
        old_hash, old_version = user.hashed_password, user.token_version
        fresh = db.query(User).filter(User.id == user.id).populate_existing().with_for_update().first()
        # Do not replace a reset/change that committed while bcrypt verification
        # was running. A failed attempt never mutates credentials.
        if not fresh or not fresh.is_active or fresh.hashed_password != old_hash or fresh.token_version != old_version or fresh.email.lower() != normalized:
            raise HTTPException(status_code=401, detail=LOGIN_ERROR)
        fresh.hashed_password = get_password_hash(password)
        db.commit()
        db.refresh(fresh)
        user = fresh
    return user

@router.post("/register-club", response_model=Token)
def register_club(payload: ClubCreate, db: Session = Depends(get_db)):
    normalized_email = payload.admin_email.strip().lower()
    # Check if club code or admin email exists
    existing_club = db.query(Club).filter(Club.code == payload.code.upper()).first()
    if existing_club:
        raise HTTPException(status_code=400, detail="Club code already registered. Please choose another code.")
    
    existing_user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User email already registered.")

    # 1. Create Club
    club = Club(
        name=payload.name,
        code=payload.code.upper(),
        location=payload.location,
        description=payload.description
    )
    db.add(club)
    db.flush()

    # 2. Create Club Admin
    admin_user = User(
        club_id=club.id,
        email=normalized_email,
        hashed_password=get_password_hash(payload.admin_password),
        full_name=payload.admin_name,
        role=UserRole.ADMIN
    )
    db.add(admin_user)
    db.flush()

    # New clubs start clean. Coaches build their real equipment and exercise
    # libraries in the UI; demo data is available only through an explicit action.
    db.commit()
    db.refresh(admin_user)

    # 3. Generate JWT
    access_token = create_access_token(subject=admin_user.id)
    user_out = UserOut.model_validate(admin_user)
    user_out.club_name = club.name

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_out
    )

@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = _authenticate(db, payload.email, payload.password)

    access_token = create_access_token(subject=user.id, token_version=user.token_version)
    user_out = UserOut.model_validate(user)
    if user.club:
        user_out.club_name = user.club.name

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_out
    )

@router.post("/login-form", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = _authenticate(db, form_data.username, form_data.password)
    access_token = create_access_token(subject=user.id, token_version=user.token_version)
    user_out = UserOut.model_validate(user)
    if user.club:
        user_out.club_name = user.club.name
    return Token(access_token=access_token, token_type="bearer", user=user_out)

@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    user_out = UserOut.model_validate(current_user)
    if current_user.club:
        user_out.club_name = current_user.club.name
    return user_out
