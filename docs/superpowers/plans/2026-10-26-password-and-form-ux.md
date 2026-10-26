# Password and form UX implementation plan

> **For agentic workers:** Use test-driven implementation for each task; keep the
> backend, password screens, and other form UX changes in disjoint files.

**Goal:** Implement the approved password/UX audit recommendations without Docker,
production builds, SQLite, real email delivery, or destructive database changes.

**Architecture:** Shared accessible password inputs and a shared feedback/dialog
layer replace inconsistent per-screen behavior. New credentials use Argon2id;
legacy bcrypt is verified safely and upgraded only after unambiguous successful
authentication. Server-side new-password policy is authoritative.

**Tech stack:** Existing React/TypeScript/Tailwind, FastAPI/Pydantic, SQLAlchemy,
MySQL; argon2-cffi for Argon2id. No new frontend runtime packages.

## Approved scope and design

User requested implementation of all findings in the immediately preceding audit.
Use shared components, not individual eye-icon patches. New password confirmation
applies to club creation, join/invitation acceptance, change and reset; login and
current-password verification must not ask for confirmation. Mask by default,
allow paste/autofill, provide accessible show/hide, Caps Lock hints, matching and
per-field errors, and clear sensitive state on close/success.

NIST single-factor policy: new passwords 15–128 Unicode code points, NFC normalized,
no trimming or composition rules. Reject common/repetitive passwords using a local
baseline blocklist (not a claim of exhaustive breach screening). Existing passwords
remain valid under legacy verification rules. Never truncate new hashes. Bcrypt
inputs above 72 UTF-8 bytes cannot be authenticated unambiguously; direct the user
to recovery instead of accepting a colliding suffix or silently migrating it.

Other UX: consistent inline/live feedback instead of browser alerts; accessible
stack-aware dialogs; dirty-editor close/navigation guards; confirmations for
destructive actions; independent crew/session booking search; visible progress;
network failures explained clearly. Fix duplicate connect_args startup error while
preserving existing MySQL connection configuration and using verified TLS.

## Task 1: Backend security and startup (root)

- [x] Regression tests: database module compiles; full password suffix matters;
  Unicode normalization and length bounds; common passwords; bcrypt compatibility;
  legacy long-password recovery; safe rehash and account token behavior.
- [x] Add reusable NewPassword Pydantic type; apply to every creation/change/reset
  input. Keep login/current-password fields outside new-password validation.
- [x] Add Argon2id hashing + safe bcrypt migration in both login endpoints.
- [x] Preserve MySQL configuration; remove duplicate keyword and unsafe TLS fallback.
- [x] Run full backend suite without production DB access; document migration rules.

## Task 2: Password UI (password_ui worker)

- [x] Create frontend/src/lib/password.ts policy helpers and behavioral tests.
- [x] Create common/PasswordField.tsx and NewPasswordFields with label/id/name,
  autocomplete, show/hide button, matching errors and Caps Lock support.
- [x] Integrate AuthModal, MembershipAccessModal, AccountSettings/Recovery only;
  use FormModal optional dirty/busy props supplied by the UX task.
- [x] Add accessible labels, per-form feedback and progress. Clear secrets on
  close/success. Preserve entered non-sensitive fields on recoverable errors.
- [x] Run node tests and TypeScript without builds.

## Task 3: Shared form UX (form_ux worker)

- [x] Implement shared feedback and asynchronous confirmation context; wire provider
  and navigation discard guard. Export useUnsavedChanges(dirty) for account settings.
- [x] FormModal retains existing exports and adds optional dirty/busy props; modal
  focus/escape/scroll/inert handling must support nested dialogs and restore focus.
- [x] Replace app browser alert/confirm calls with actionable notifications/dialogs.
  Add dirty guards to long editors and confirmation to member-access and booking
  cancellation actions. Do not edit password screens owned by Task 2.
- [x] Separate booking crew/session searches; preserve selected options.
- [x] Add behavioral tests, run TypeScript and node tests.

## Review focus / verification

Unicode code points versus UTF-16; no reset of existing passwords solely because
minimum length changed; no ambiguous bcrypt suffix accepted; no stale credentials
rehash race; nested dialogs must not close underlying editors; success must not
trigger a discard warning; pending requests must prevent duplicate destructive
actions; keyboard/autofill/paste must remain usable. Test relevant boundaries in
the owning task, then run the complete focused suites and a read-only code review.
Live MySQL, mail delivery, and browser acceptance remain separately reported.

## Verification result

76 backend checks passed; 16 isolated MySQL tests skipped without a test database.
28 frontend checks and non-emitting TypeScript passed. ORM mappings, OpenAPI and
Git whitespace checks passed. Read-only review findings (pending account navigation
and TLS URL parsing) were corrected and regression-tested. No Docker/compose or
production builds, live browser checks, database/TLS handshakes or SMTP deliveries
were performed.
