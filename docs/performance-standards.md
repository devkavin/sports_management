# Coach performance standards

Open **Coach → Conditions → Performance standards**. Create named standards, search them by name or exercise, edit, duplicate, archive and restore. View athlete results from each standard. Two coaches saving simultaneously receive a conflict instead of silently overwriting each other; refresh and reopen the standard to use its latest version.

## Starting selections

The audience defaults to all active club athletes. When an active exercise is explicitly configured as a 2k erg test using real Concept2 RowErg equipment, the editor selects it. Otherwise coaches choose a real exercise from the searchable library. Required and stretch targets are always blank on new standards. The initial test protocol is 2000 metres; this is a selectable test distance, never an invented athlete result or requirement.

## Controls

- Choose a fixed-distance or fixed-duration protocol, including custom distances/durations. Changing protocol or metric clears target inputs to avoid treating a time as watts or a distance.
- Fixed-distance tests support total time, split per 500 metres, and average watts. Timed tests support distance and average watts. Lower time/split meets the requirement; higher distance/watts meets it. Unsupported metrics such as reps and lifting load are not offered without a comparable strength-test protocol.
- Enter time as seconds or `M:SS.s`; other targets use watts/metres. Stretch targets are optional and must be strictly more demanding. The preview explains the exact condition before saving.
- Audience options are all active club athletes, selected athletes, or selected schedule rosters. Athlete and schedule selectors have search. Roster audiences follow current athlete assignments; trainer assignments are excluded. There is no invented demographic or squad membership inferred from names or exercise labels.
- More options include inclusive effective dates in UTC, maximum result age (90 days initially), and coach notes. Each standard is evaluated independently; a targeted standard does not silently override a club-wide one.

## Honest evaluation

Results must be verified, belong to the exact exercise and athlete, and record the exact protocol distance/duration. The latest comparable result within the age limit and effective-date window is evaluated. Future results, non-finite or non-positive metric values and mismatched protocols are excluded. Statuses distinguish meeting the required or stretch target, falling below it, missing comparable data and an inactive standard. Missing data is never treated as a failed test. Existing chart references are preserved separately and do not become requirements automatically.

Standards and result evaluation are available to club staff; edits are restricted to coaches and administrators. This change adds the coach management interface. It does not publish athletes' evaluations to other athletes or turn requirements into automatic crew-selection decisions.

## Deployment

Deploy both frontend and backend. Migration `0004_performance_standards` is required. Normal backend startup automatically runs pending migrations. It has **not** been executed during implementation. Review [the exact migration SQL and effects](performance-standards-migration.md) and approve the target MySQL environment before asking the agent to start the backend or run migration/integration commands. No new library dependencies are needed.
