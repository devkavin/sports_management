"""Credential regressions: real hashing, no database or email connections."""
from pathlib import Path
import bcrypt
import pytest
from app.core import security


def test_database_module_compiles_before_application_startup():
    source = Path(__file__).parents[1] / 'app/core/database.py'
    compile(source.read_bytes(), str(source), 'exec')


def test_new_hash_uses_argon2id_and_verifies_every_utf8_byte():
    first = 'é' * 36 + 'A'
    other = 'é' * 36 + 'B'
    hashed = security.get_password_hash(first)
    assert hashed.startswith('$argon2id$')
    assert security.verify_password(first, hashed)
    assert not security.verify_password(other, hashed)


def test_new_hash_accepts_long_passphrases_without_bcrypt_truncation():
    first = 'a long memorable passphrase ' * 4
    hashed = security.get_password_hash(first)
    assert security.verify_password(first, hashed)
    assert not security.verify_password(first[:-1] + '!', hashed)


def test_new_hash_normalizes_unicode_without_trimming_spaces():
    hashed = security.get_password_hash(' café and a quiet river ')
    assert security.verify_password(' cafe\u0301 and a quiet river ', hashed)
    assert not security.verify_password('café and a quiet river', hashed)


def test_existing_short_bcrypt_password_remains_valid():
    hashed = bcrypt.hashpw(b'old-password', bcrypt.gensalt(rounds=4)).decode()
    assert security.verify_password('old-password', hashed)
    assert not security.verify_password('wrong-password', hashed)


def test_ambiguous_legacy_bcrypt_suffix_is_not_accepted():
    prefix = ('é' * 36).encode()
    hashed = bcrypt.hashpw(prefix, bcrypt.gensalt(rounds=4)).decode()
    assert not security.verify_password('é' * 36 + 'A', hashed)
    assert not security.verify_password('é' * 36 + 'B', hashed)
    assert not security.verify_password('é' * 36, hashed)
    assert security.legacy_password_requires_reset('é' * 36 + 'A', hashed)


def test_legacy_password_is_flagged_for_safe_rehash_after_success():
    hashed = bcrypt.hashpw(b'old-password', bcrypt.gensalt(rounds=4)).decode()
    assert security.password_needs_rehash(hashed)
    assert not security.password_needs_rehash(security.get_password_hash('NewPassword123!'))


@pytest.mark.parametrize('password', ['wrong', '', 'A' * 20000])
def test_invalid_password_or_hash_never_authenticates(password):
    assert not security.verify_password(password, 'not-a-password-hash')
