import pytest
from pydantic import ValidationError
from app.schemas.schemas import ClubCreate, ClubJoinRequestCreate, ClubInvitationAccept, UserCreate, LoginRequest
from app.api.account import PasswordChange, ActionInput


def new_password_inputs(password):
    return [
        (ClubCreate, dict(name='Club', code='CLUB', admin_name='Admin', admin_email='admin@example.org', admin_password=password)),
        (UserCreate, dict(email='athlete@example.org', full_name='Athlete', password=password)),
        (ClubJoinRequestCreate, dict(club_code='CLUB', full_name='Athlete', email='athlete@example.org', password=password)),
        (ClubInvitationAccept, dict(token='t' * 32, full_name='Athlete', password=password)),
        (PasswordChange, dict(current_password='old', new_password=password)),
        (ActionInput, dict(token='t' * 32, new_password=password)),
    ]


@pytest.mark.parametrize('password', ['too short', 'x' * 129, 'password123456789', 'X' * 16])
def test_every_new_password_endpoint_enforces_same_policy(password):
    for schema, values in new_password_inputs(password):
        with pytest.raises(ValidationError):
            schema(**values)


def test_new_password_policy_accepts_unicode_spaces_and_long_passphrases():
    for password in ['a quiet river flows here', '✨' * 14 + 'R', ' x ' + 'rowing ' * 16]:
        for schema, values in new_password_inputs(password):
            value = schema(**values)
            stored = getattr(value, 'admin_password', getattr(value, 'new_password', getattr(value, 'password', None)))
            assert stored == password


def test_password_length_counts_normalized_unicode_code_points():
    # 14 normalized letters are too short even though NFD has 28 code points.
    for schema, values in new_password_inputs('e\u0301' * 14):
        with pytest.raises(ValidationError): schema(**values)


def test_login_is_not_subject_to_new_password_minimum():
    assert LoginRequest(email='athlete@example.org', password='old').password == 'old'
