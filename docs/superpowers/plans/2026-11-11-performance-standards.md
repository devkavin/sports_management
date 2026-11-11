# Performance standards implementation plan

Goal: Let coaches manage named requirements with sensible starting selections and optional targeting and protocol controls.

Architecture: A club-scoped standards table and API store explicit exercise/protocol/metric requirements. A dedicated responsive editor replaces the two-field-only experience while preserving the old chart references separately. Evaluations use verified, comparable results only. Default audience is all active club athletes; optional audiences are selected athletes or existing schedule rosters. No invented squads, demographic categories, or target values.

Constraints: No Docker, builds, SQLite, database mutations, seeds, migrations or backend startup during implementation. Prepare a versioned migration and document that normal backend startup applies it; obtain confirmation before executing any database operation. No commits requested.

- [x] Backend: model, schema validation, club-scoped coach/admin CRUD, archive/restore, evaluation with explicit distance or duration protocol, date and freshness checks, audit, optimistic update protection. Add DB-free tests for validation, comparability, boundaries, audience and permissions.
- [x] Frontend: standards types/API; searchable standards list and responsive create/edit dialog. Default club audience and a real 2k RowErg exercise when available. Protocol and metric selectors, optional stretch target, effective dates, freshness, searchable audiences; blank target values, summary preview, clear statuses, save/error/loading and dirty guards. Keep reference settings labeled separately.
- [x] Verify: frontend tests and TypeScript; backend DB-free suite with integration DB disabled; review security/date/metric behavior; document migration and limitations.

Interface: /standards GET and POST; /standards/{id} PUT; /standards/{id}/archive POST with {archived:boolean, version:number}; /standards/{id}/evaluations GET. Payload: name, exercise_id, metric (duration|split|watts|distance), comparison (at_most|at_least), target_value, stretch_value nullable, protocol_distance_m nullable, protocol_duration_sec nullable (exactly one), audience (club|athletes|schedules), athlete_ids [], schedule_ids [], effective_from ISO date nullable, effective_until ISO date nullable, result_max_age_days default90, notes. Responses include id, version, archived and timestamps. Evaluations include athlete_id, athlete_name, status (meets|below|stretch|no_result|inactive), value nullable, result_id nullable, recorded_date nullable. Frontend units seconds, /500m seconds, watts, metres; time strings are input convenience only.

## Verification and review

Final verification: 44 frontend tests passed; TypeScript no-emit passed; 120 backend tests passed, 16 MySQL integration tests skipped with TEST_DATABASE_URL disabled. No migrations, database state changes, backend startup, Docker commands or builds were executed.

Independent review found target precision loss, hidden inactive selections and unsupported fractional/overflow numerical inputs. All fixed in one pass with failing regression tests before fixes; the complete suites then passed. Threshold inputs preserve precision, DOUBLE storage is prepared, selected unavailable athletes remain removable, protocol distance is integral and numeric inputs are bounded. Actual MySQL persistence, concurrent transactions and live-browser acceptance were not exercised.
