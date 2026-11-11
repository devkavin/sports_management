# Regatta periodization migration (prepared, not executed)

Target: the MySQL database selected by the backend `DATABASE_URL` in the explicitly approved deployment environment. No database or environment has been approved for execution in this task. Do not start the backend, run `python -m app.core.migrations`, or otherwise apply migrations until the user confirms the target and proposed operations below.

Version: `0005_regatta_periodization`. For an existing database with versions 0001–0004 already recorded, the migration introspects the table, column, and foreign key and performs only missing operations. MySQL DDL commits implicitly; those checks allow a partially applied migration to resume.

Equivalent SQL for the new table and index (SQLAlchemy emits this DDL, checking table existence first):

```sql
CREATE TABLE periodization_plans (
    id INTEGER NOT NULL AUTO_INCREMENT,
    club_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    phases JSON NOT NULL,
    archived BOOL NOT NULL,
    version INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (club_id) REFERENCES clubs (id)
);
CREATE INDEX ix_periodization_plans_club_id ON periodization_plans (club_id);
```

The ORM provides description `''`, archived `false`, version `1`, and UTC timestamps on application inserts. Phases contain only explicitly entered phase windows and existing schedule references.

Exact SQL for missing competition schema elements:

```sql
ALTER TABLE competitions ADD COLUMN periodization_plan_id INTEGER NULL;
ALTER TABLE competitions ADD CONSTRAINT fk_competitions_periodization_plan
  FOREIGN KEY (periodization_plan_id) REFERENCES periodization_plans (id);
```

The migration runner also executes its existing bookkeeping operations:

```sql
SELECT GET_LOCK('sports_management_schema', 60);
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT version FROM schema_migrations;
INSERT INTO schema_migrations (version) VALUES ('0005_regatta_periodization');
SELECT RELEASE_LOCK('sports_management_schema');
```

Expected changes: create an empty reusable plans table; add a nullable foreign key to existing competitions; record migration success. Existing competitions have a NULL plan reference. Existing competition dates and other values are preserved. No backfill, fabricated plan, schedule, session, or goal is created. MySQL creates an index supporting the competition foreign key if required.

The runner applies **all** pending versions. Before approving execution, inspect `schema_migrations` read-only and review any earlier unapplied migrations separately (0003 includes a data update). On a new database, baseline metadata creation includes the new table and foreign key; version 0005 then observes them and skips duplicate DDL. Existing baseline behavior is unchanged.

API: `/periodization-plans` GET includes active and archived club plans for admin/coach/trainer; POST accepts name, description string, and 1–50 phases. Each phase accepts name, existing SchedulePhase value, inclusive ISO start_date/end_date, goals string, and schedule_ids. PUT `/{id}` requires the complete definition and positive version; POST `/{id}/archive` requires `{archived,version}`. Responses add id, club_id, archived, version, created_at, updated_at. Stale writes return 409. Every plan mutation writes a before/after audit in the same transaction.

Competition POST and PUT `/{id}` accept nullable periodization_plan_id plus existing fields. Date inputs normalize to UTC midnight; omitted end_date defaults to start_date. Output adds periodization_plan_id and periodization_plan_name. Newly selected plans must be active and belong to the club; an existing archived selection can be preserved. All phase ends must be on or before the competition start date. Plan edits validate against the earliest linked competition. No SQL has been executed as part of preparing this migration.
