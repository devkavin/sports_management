"""Ordered, recorded, idempotent MySQL schema upgrades.

Each version is recorded only after all steps complete. MySQL DDL commits
implicitly, so steps introspect before altering and can safely resume on restart.
"""
from sqlalchemy import text, inspect
from app.core.database import Base, engine, run_additive_migrations
from app.models import models  # noqa: F401
from app.models import operations  # noqa: F401


def _baseline():
    Base.metadata.create_all(bind=engine)
    run_additive_migrations()


def _workflows():
    Base.metadata.create_all(bind=engine)
    additions = {
        "users": {"token_version": "INTEGER NOT NULL DEFAULT 0", "email_verified_at": "DATETIME NULL"},
        "training_sessions": {"status": "VARCHAR(16) NOT NULL DEFAULT 'scheduled'", "change_reason": "TEXT NULL",
            "changed_at": "DATETIME NULL", "changed_by_id": "INTEGER NULL"},
    }
    with engine.connect() as connection:
        inspector = inspect(connection)
        for table, columns in additions.items():
            present = {column['name'] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in present:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
                    connection.commit()


def _reservation_snapshots():
    with engine.connect() as connection:
        present = {column['name'] for column in inspect(connection).get_columns('equipment_reservations')}
        for name, definition in {'crew_name_snapshot': 'VARCHAR(255) NULL', 'seats_snapshot': 'JSON NULL'}.items():
            if name not in present:
                connection.execute(text(f'ALTER TABLE equipment_reservations ADD COLUMN {name} {definition}'))
                connection.commit()
        connection.execute(text('UPDATE equipment_reservations r JOIN crews c ON c.id = r.crew_id SET r.crew_name_snapshot = c.name, r.seats_snapshot = c.seats WHERE r.seats_snapshot IS NULL'))
        connection.commit()


MIGRATIONS = [("0001_baseline", _baseline), ("0002_club_workflows", _workflows), ("0003_reservation_snapshots", _reservation_snapshots)]


def run_migrations():
    if engine.dialect.name != "mysql":
        raise RuntimeError("This application and its migrations require MySQL")
    with engine.connect() as lock:
        if lock.execute(text("SELECT GET_LOCK('sports_management_schema', 60)")).scalar() != 1:
            raise RuntimeError("Could not acquire schema migration lock")
        try:
            lock.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(64) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"))
            lock.commit()
            applied = set(lock.execute(text("SELECT version FROM schema_migrations")).scalars())
            for version, upgrade in MIGRATIONS:
                if version not in applied:
                    upgrade()
                    lock.execute(text("INSERT INTO schema_migrations (version) VALUES (:version)"), {"version": version})
                    lock.commit()
        finally:
            lock.execute(text("SELECT RELEASE_LOCK('sports_management_schema')"))


if __name__ == '__main__':
    run_migrations()
