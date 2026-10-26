import ssl
import pytest


def test_explicit_tls_mode_is_retained_without_dropping_other_options():
    from app.core.mysql_connection import mysql_connection_options
    url, options = mysql_connection_options('mysql+pymysql://user:secret@db.example/club?ssl-mode=REQUIRED&charset=utf8mb4')
    assert url.query == {'charset': 'utf8mb4'}
    assert isinstance(options['ssl'], ssl.SSLContext)
    assert options['ssl'].verify_mode == ssl.CERT_REQUIRED
    assert options['ssl'].check_hostname


def test_local_mysql_without_tls_keeps_existing_connection_options():
    from app.core.mysql_connection import mysql_connection_options
    url, options = mysql_connection_options('mysql://user:secret@db:3306/club?charset=utf8mb4')
    assert url.drivername == 'mysql+pymysql'
    assert url.query == {'charset': 'utf8mb4'}
    assert options == {'connect_timeout': 10}


@pytest.mark.parametrize('query', ['ssl-mode=WRONG', 'ssl-mode=REQUIRED&ssl_verify_cert=false', 'ssl-mode=REQUIRED&ssl_verify_identity=0'])
def test_tls_configuration_cannot_silently_disable_verification(query):
    from app.core.mysql_connection import mysql_connection_options
    with pytest.raises(ValueError):
        mysql_connection_options('mysql+pymysql://user:secret@db.example/club?' + query)


def test_conflicting_tls_modes_cannot_silently_downgrade_to_plaintext():
    from app.core.mysql_connection import mysql_connection_options
    with pytest.raises(ValueError):
        mysql_connection_options('mysql+pymysql://user:secret@db.example/club?ssl-mode=DISABLED&ssl_mode=REQUIRED')
