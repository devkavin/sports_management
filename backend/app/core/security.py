from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import jwt
import bcrypt
import unicodedata
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerificationError, InvalidHashError
from app.core.config import settings

# OWASP's Argon2id baseline: 19 MiB, two passes, one lane. Per-hash random
# salts and parameters are encoded by argon2-cffi in the resulting hash.
password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1, type=Type.ID)
MAX_LOGIN_BYTES = 4096  # Bound attacker-controlled hashing input, not new-password policy.


def legacy_password_requires_reset(password: str, hashed_password: str) -> bool:
    return hashed_password.startswith(('$2a$', '$2b$', '$2y$')) and len(password.encode('utf-8')) >= 72


def password_needs_rehash(hashed_password: str) -> bool:
    if not isinstance(hashed_password, str):
        return False
    if hashed_password.startswith(('$2a$', '$2b$', '$2y$')):
        return True
    try:
        return password_hasher.check_needs_rehash(hashed_password)
    except (InvalidHashError, ValueError):
        return False

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not isinstance(plain_password, str) or not isinstance(hashed_password, str):
        return False
    try:
        encoded = plain_password.encode('utf-8')
        if len(encoded) > MAX_LOGIN_BYTES:
            return False
        if hashed_password.startswith(('$2a$', '$2b$', '$2y$')):
            # Existing hashes used raw UTF-8. Do not normalize legacy inputs or
            # accept a truncated suffix that cannot be authenticated securely.
            return not legacy_password_requires_reset(plain_password, hashed_password) and bcrypt.checkpw(encoded, hashed_password.encode('ascii'))
        return password_hasher.verify(hashed_password, unicodedata.normalize('NFC', plain_password))
    except (VerificationError, InvalidHashError, ValueError, TypeError, UnicodeError):
        return False

def get_password_hash(password: str) -> str:
    if len(password.encode('utf-8')) > MAX_LOGIN_BYTES:
        raise ValueError('Password is too long')
    return password_hasher.hash(unicodedata.normalize('NFC', password))

def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None, token_version: int = 0) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "ver": token_version}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
