# Performance standards migration (prepared, not executed)

Target: the MySQL database selected by the backend `DATABASE_URL` in the environment the user explicitly approves. No target database has been selected or changed during this implementation.

Version `0004_performance_standards` creates only `performance_standards`, its club index and its foreign keys. It inserts no standards, invents no target values and does not convert the existing chart-reference settings. The migration runner also records `0004_performance_standards` in `schema_migrations`. Existing standards changes are audited in the existing `audit_events` table.

Normal backend startup calls `run_migrations()` and applies pending versions. **Do not start the backend, run integration tests, or run this migration before obtaining explicit approval for the selected database and all pending operations.** If earlier versions are pending, review them separately: they may modify existing data. No database-bound verification, startup, Docker operation, seed or migration was executed here.

After approval, the command is run from `backend`:

```powershell
python -m app.core.migrations
```

The proposed MySQL DDL for version 0004 is:

```sql
CREATE TABLE performance_standards (
    id INTEGER NOT NULL AUTO_INCREMENT,
    club_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    exercise_id INTEGER NOT NULL,
    metric VARCHAR(16) NOT NULL,
    comparison VARCHAR(16) NOT NULL,
    target_value DOUBLE NOT NULL,
    stretch_value DOUBLE,
    protocol_distance_m INTEGER,
    protocol_duration_sec DOUBLE,
    audience VARCHAR(16) NOT NULL,
    athlete_ids JSON NOT NULL,
    schedule_ids JSON NOT NULL,
    effective_from DATE,
    effective_until DATE,
    result_max_age_days INTEGER NOT NULL,
    notes TEXT,
    archived BOOL NOT NULL,
    version INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(club_id) REFERENCES clubs (id),
    FOREIGN KEY(exercise_id) REFERENCES exercises (id)
);
CREATE INDEX ix_performance_standards_club_id ON performance_standards (club_id);
INSERT INTO schema_migrations (version) VALUES ('0004_performance_standards');
```

The runner uses the existing schema advisory lock and creates the migration ledger if absent. Table creation is idempotent (`checkfirst=True`). MySQL DDL commits implicitly. Rollback would require a separately approved destructive operation; none is prepared or executed automatically.

## API and evaluation behavior

- `/api/v1/standards`: staff GET returns all club standards including archives; coach/admin POST creates a standard.
- `/api/v1/standards/{id}`: coach/admin PUT fully replaces editable fields and requires the current `version`.
- `/api/v1/standards/{id}/archive`: coach/admin POST `{archived, version}` archives or restores; version conflicts return 409.
- `/api/v1/standards/{id}/evaluations`: staff GET evaluates active club athletes in the specified audience. Athletes cannot read or change standards through these routes.
- Metrics use seconds, split seconds per 500m, watts and metres. Duration/split require `at_most` with distance protocol; distance requires `at_least` with duration protocol. Watts allows either protocol with `at_least`. Protocol distance or duration must be explicitly supplied, exactly one, positive and finite. Stretch is optional and strictly more demanding than target.
- Numeric requirements are bounded at 1,000,000,000 to reject unsupported magnitudes. Distance protocols use whole metres, matching recorded distance storage. Thresholds and duration protocols use DOUBLE precision; editor inputs retain the stored precision on save.
- Evaluations use the latest fresh verified result for the exact exercise and exact protocol, with positive finite selected metric. Unknown or mismatched results are omitted; no best-result substitution, derived target or exercise-name inference occurs.
- Effective dates include both endpoints in UTC, and results must fall in that window. Freshness includes the exact age boundary; future results are excluded. Inactive standards return `inactive` for their audience. Missing comparable results return `no_result` with empty value/result/date fields.
- Club audiences contain active club athletes. Athlete audiences use the selected active club athletes. Schedule audiences use actual `ScheduleAssignment` rows with assignment type `athlete`, intersected with active club athletes; trainer assignments never count.

Validation, evaluation, permissions, scoping, stale-update behavior and audit transaction behavior are verified without database access. MySQL DDL execution and live HTTP persistence require separately approved database testing.
