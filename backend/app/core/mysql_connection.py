"""Translate MySQL URL TLS options without discarding connection parameters."""
from pathlib import Path
import ssl
from sqlalchemy.engine import make_url


def mysql_connection_options(raw_url: str, ca_cert_path: str | None = None):
    url = make_url(raw_url)
    if url.drivername == 'mysql':
        url = url.set(drivername='mysql+pymysql')
    if url.get_backend_name() != 'mysql':
        raise ValueError('This application requires a MySQL DATABASE_URL')
    query = dict(url.query)
    mode, alias = query.pop('ssl-mode', None), query.pop('ssl_mode', None)
    if mode and alias and mode.upper() != alias.upper():
        raise ValueError('Conflicting MySQL TLS modes; specify ssl-mode only once')
    mode = mode or alias
    mode = mode.upper() if mode else None
    if mode not in (None, 'DISABLED', 'PREFERRED', 'REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY'):
        raise ValueError('Unsupported MySQL ssl-mode; use REQUIRED or VERIFY_IDENTITY for verified TLS')
    explicit_ssl = query.pop('ssl', None)
    if explicit_ssl not in (None, 'true', 'false', '1', '0'):
        raise ValueError('Use ssl-mode=REQUIRED to enable MySQL TLS')
    ca = query.pop('ssl_ca', None) or ca_cert_path
    cert, key = query.pop('ssl_cert', None), query.pop('ssl_key', None)
    verify_cert = query.pop('ssl_verify_cert', None)
    verify_identity = query.pop('ssl_verify_identity', None)
    for setting in (verify_cert, verify_identity):
        if setting is not None and str(setting).lower() not in ('true', '1'):
            raise ValueError('MySQL TLS certificate and hostname verification cannot be disabled')
    cloud = bool(url.host and url.host.endswith('.aivencloud.com'))
    requested = mode not in (None, 'DISABLED') or explicit_ssl in ('true', '1') or any((ca, cert, key, verify_cert, verify_identity)) or cloud
    if mode == 'DISABLED' and requested:
        raise ValueError('MySQL ssl-mode=DISABLED conflicts with the TLS configuration')
    options = {'connect_timeout': 10}
    if requested:
        bundled_ca = Path(__file__).parents[2] / 'ca.pem'
        cafile = ca or (str(bundled_ca) if bundled_ca.is_file() else None)
        context = ssl.create_default_context(cafile=cafile)
        if cert or key:
            if not cert or not key:
                raise ValueError('Both ssl_cert and ssl_key are required for a client certificate')
            context.load_cert_chain(certfile=cert, keyfile=key)
        options['ssl'] = context
    return url.set(query=query), options
