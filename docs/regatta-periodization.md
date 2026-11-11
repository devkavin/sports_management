# Regatta dates and periodization plans

The regatta editor now explicitly labels the competition date. A single-day event uses that date for both stored date bounds; multi-day events can enable and enter a separate end date. Existing date windows remain intact. Competition cards display the date(s), linked plan name and an edit action. Dates are represented as calendar dates at UTC midnight and displayed without moving them to a previous/next day.

Periodization plans are optional. The regatta editor provides a searchable selector and a **Create plan** button using the shared phase editor in a nested dialog. Creating a plan selects it immediately; canceling the plan editor preserves the unsaved regatta draft. The plan is saved separately, so abandoning the regatta afterward does not delete a plan already created. A late list response cannot remove newly saved plans or overwrite a newer locally accepted version.

The same planner is available above the existing taxonomy manager in **Coach → Periodization & Taxonomy**. Taxonomy branches remain organizational; they are not treated as dated phases. Saved plans can be searched, previewed, edited, archived and restored. Edits require the current version so simultaneous changes do not silently overwrite each other.

Each plan contains one to fifty dated phases. Coaches choose the existing phase categories (base endurance, strength build, race pace/peak, taper/recovery), enter phase names, dates and optional goals, and can link existing active schedules that fit the phase's date window. Dates are inclusive and phases cannot overlap. The preview sorts phases by their real dates and displays their proportional duration and gaps. No phase dates, goals, schedules or sessions are fabricated or created automatically.

All phases must finish on or before the linked regatta date. The API checks this both when linking/editing a regatta and when editing a plan already linked to competitions. Creating or changing references checks club ownership. Archived plans cannot be newly linked, but existing links can be preserved when editing an event. Archiving retains historical references. Selected unavailable schedule links remain visible and removable.

## Deployment and verification

Deploy frontend and backend together. Migration `0005_regatta_periodization` is required. It creates an empty plans table and adds a nullable plan link to competitions, preserving existing dates and inserting no sample plans. Normal backend startup applies pending migrations; **the migration was prepared but not executed**. Review [the exact SQL, target and effects](regatta-periodization-migration.md) before approving execution. Earlier pending migrations must be reviewed too.

Automated checks: 61 frontend tests, frontend TypeScript, and 145 backend tests pass; 16 MySQL integration cases are skipped. Tests cover single/multi-day dates, invalid date/distance inputs, phase overlaps, schedule ownership/windows, regatta deadlines, permissions, stale writes, audits, previews, removable unavailable links and stale list responses. Browser fixture checks verified nested plan editing/discard protection with the parent draft preserved; backend requests were disabled. Real MySQL persistence, transaction locking and migration execution were not exercised. No database changes, backend startup, Docker commands or production builds were run.
