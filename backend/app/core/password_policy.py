"""New-credential policy, independent of legacy sign-in verification."""
import unicodedata
from typing import Annotated
from pydantic import AfterValidator, WithJsonSchema

MIN_PASSWORD_LENGTH = 15
MAX_PASSWORD_LENGTH = 128
# A local baseline, not an exhaustive database of compromised credentials.
COMMON_PASSWORDS = frozenset({
    'passwordpassword', 'password123456789', '123456789012345',
    '1234567890123456', 'qwertyuiopasdfgh', 'qwertyuiop123456',
    'letmeinletmeinletmein', 'iloveyouiloveyou', 'thisismypassword',
    'correcthorsebatterystaple', 'welcome123456789', 'changeme123456789',
})


def validate_new_password(value: str) -> str:
    value = unicodedata.normalize('NFC', value)
    if not MIN_PASSWORD_LENGTH <= len(value) <= MAX_PASSWORD_LENGTH:
        raise ValueError('Use 15–128 characters. Spaces and Unicode are allowed.')
    folded = value.casefold()
    if folded in COMMON_PASSWORDS or len(set(folded)) == 1:
        raise ValueError('This password is too common. Choose a unique passphrase.')
    return value


NewPassword = Annotated[
    str, AfterValidator(validate_new_password),
    WithJsonSchema({'type': 'string', 'format': 'password', 'minLength': 15, 'maxLength': 128}),
]
