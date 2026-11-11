# Regatta periodization implementation

Goal: Regatta form with explicit competition date, optional multi-day end and searchable reusable periodization plan selection plus in-context Create plan. Add dated phase planning above existing taxonomy manager; taxonomy remains organizational rather than misrepresented as a dated plan.

Defaults: single-day event; plan optional; phases editable with existing SchedulePhase enum, explicit inclusive ISO date bounds, name and goals, optional existing schedule links. No fabricated dates, goals or schedules. Phase windows cannot overlap and must finish on or before linked regatta dates. Linked schedules must belong to the club and fit their phase's date window.

API contract: /periodization-plans GET list including archives, POST create; /{id} PUT full update with version; /{id}/archive POST {archived,version}. Plan fields name,description string,phases [{name,phase,start_date,end_date,goals,schedule_ids:number[]}]. Responses id,club_id,archived,version,created_at,updated_at. Phases sorted chronologically by server, >=1 <=50; coach/admin writes, staff reads. Competition payload keeps start_date/end_date (regatta date/end date UTC midnight); adds nullable periodization_plan_id; output adds id and periodization_plan_name nullable. Add PUT competitions/{id} for editing. No hidden schedule/session creation.

- [x] Backend model/API/validation/migration and DB-free tests; linked competition timing checks on plan edits; tenant ownership and stale updates protected.
- [x] Shared frontend phase editor/list/selector and regatta editor with responsive labeled fields, searchable dropdowns, create-and-select, edit and archive/restore.
- [x] Integrate existing coach competition and taxonomy views; keep calendar dates compatible; tests, TypeScript, review, migration documentation.

Constraints: Preserve prior uncommitted work. No Docker/builds/SQLite/backend startup/database state changes or DB-backed tests. Prepare migration only; startup normally applies it, but do not execute without explicit approval of target and SQL. No commits.

Final verification: 61 frontend tests, frontend TypeScript and 145 backend tests pass. 16 MySQL integration tests skipped. Independent review found one list-response race hiding newly saved plans; a failing regression test was added, accepted versions are now merged with remote snapshots, and suites pass. Backend-disabled browser checks confirmed nested plan editor/discard and retained regatta draft. Actual plan persistence, MySQL concurrency and migration execution remain unverified. No database changes were executed.
