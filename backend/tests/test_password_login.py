from datetime import datetime
from types import SimpleNamespace as Record
import bcrypt
import pytest
from fastapi import HTTPException
import json
import inspect
from fastapi.exceptions import RequestValidationError
from app.api.auth import login, login_form
from app.core.security import get_password_hash
from app.models.models import UserRole
from app.schemas.schemas import LoginRequest


def member(hashed, version=0):
    return Record(id=7, club_id=1, email='athlete@example.org', full_name='Athlete',
        hashed_password=hashed, token_version=version, role=UserRole.ATHLETE,
        is_active=True, created_at=datetime(2026, 1, 1), weight_kg=None,
        height_cm=None, side_preference=None, avatar_url=None, club=Record(name='Club'))


class LoginDB:
    def __init__(self, user, fresh=None): self.user = user; self.fresh = fresh or user; self.locked = False; self.committed = False
    def query(self, *args): return self
    def filter(self, *args): return self
    def populate_existing(self): return self
    def with_for_update(self): self.locked = True; return self
    def first(self): return self.fresh if self.locked else self.user
    def commit(self): self.committed = True
    def refresh(self, user): pass


@pytest.mark.parametrize('form', [False, True])
def test_legacy_login_rehashes_without_forcing_new_minimum(form):
    user = member(bcrypt.hashpw(b'old-password', bcrypt.gensalt(rounds=4)).decode())
    db = LoginDB(user)
    result = login_form(Record(username=user.email, password='old-password'), db) if form else login(LoginRequest(email=user.email, password='old-password'), db)
    assert result.user.id == 7
    assert user.hashed_password.startswith('$argon2id$')
    assert db.committed and db.locked
    assert user.token_version == 0


def test_login_rehash_does_not_overwrite_a_concurrent_password_change():
    old = member(bcrypt.hashpw(b'old-password', bcrypt.gensalt(rounds=4)).decode())
    new = member(get_password_hash('ChangedPassword123!'), version=1)
    db = LoginDB(old, new)
    with pytest.raises(HTTPException) as error:
        login(LoginRequest(email=old.email, password='old-password'), db)
    assert error.value.status_code == 401
    assert not db.committed
    assert new.token_version == 1


def test_login_failure_offers_recovery_without_exposing_account_existence():
    for user in [None, member(bcrypt.hashpw(b'X' * 72, bcrypt.gensalt(rounds=4)).decode())]:
        with pytest.raises(HTTPException) as error:
            login(LoginRequest(email='athlete@example.org', password='X' * 73), LoginDB(user))
        assert error.value.status_code == 401
        assert 'Forgot password' in error.value.detail


def test_validation_response_does_not_echo_passwords():
    # Exercise the application's registered validation-error HTTP boundary;
    # no lifespan, database, background worker or mail provider is started.
    from app.main import app
    error = RequestValidationError([{'loc': ('body', 'admin_password'), 'msg': 'Choose a unique passphrase',
        'type': 'value_error', 'input': 'password123456789', 'ctx': {'secret': 'private'}}])
    response = app.exception_handlers[RequestValidationError](None, error)
    if inspect.iscoroutine(response):
        # The handler is pure serialization and must not suspend for I/O.
        # Driving it directly avoids Windows event-loop socket-pair creation in
        # a network-restricted test sandbox.
        try:
            response.send(None)
        except StopIteration as completed:
            response = completed.value
    assert response.status_code == 422
    assert b'password123456789' not in response.body
    assert all('input' not in item and 'ctx' not in item for item in json.loads(response.body)['detail'])
