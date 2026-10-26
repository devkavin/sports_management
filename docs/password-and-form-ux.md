# Password and form UX update

## User-facing behavior

All app password fields now have independently accessible Show/Hide controls,
masked by default, with correct current/new-password autocomplete and a Caps Lock
hint. Pasting and password-manager generation are allowed. Invited account email
is read-only but exposed as the username field for password managers.

New passwords are confirmed when registering a club, requesting membership,
accepting any role's invitation, changing a password, or resetting one. Sign-in
and current-password verification do not ask for a second entry. Mismatches and
new-password requirements are shown at the inputs; failed validation focuses the
relevant field before sending a request. Passwords/reveal state are removed when
dialogs close or credentials are successfully changed.

New passwords use 15–128 Unicode code points, normalized to NFC. Spaces are
significant, not trimmed. No uppercase/digit/symbol mixtures are forced. A small
local blocklist rejects common and single-character repetitive choices. This is
a baseline, not exhaustive screening against breached passwords. The server
enforces the same policy across every credential-creation endpoint.

The policy follows [NIST's single-factor password guidance](https://pages.nist.gov/800-63-4/sp800-63b.html).
It is not a claim that the entire app is NIST-certified: production authentication
also needs deployment-level HTTPS, abuse/rate-limit controls and operational review.

## Existing accounts and hashing migration

- New/changed/reset passwords use Argon2id with a unique random salt, 19 MiB memory,
  two iterations and one lane, meeting the [OWASP baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Existing shorter bcrypt credentials remain usable, even below the new minimum.
  Successful login upgrades them to Argon2id under a row lock, checking that the
  password and token version did not change concurrently. Failed logins do not
  change account records. No bulk reset or destructive database migration occurs.
- Legacy bcrypt inputs of **72 or more UTF-8 bytes** require password recovery.
  The previous implementation discarded bytes beyond 72; its hashes cannot prove
  which suffix was originally supplied. Accepting or silently upgrading such an
  input would preserve that ambiguity. The login message directs users to Forgot
  password without revealing whether the email exists.
- Configure and test SMTP recovery before rolling this out to affected accounts.
  Password changes and recovery still invalidate other authentication tokens.
- Validation responses omit rejected input values and exception context, preventing
  password/token echoing in API errors. Do not add password logging to proxy/APM
  middleware. Keep secrets out of screenshots and logs.

Install updated backend requirements when rebuilding; argon2-cffi is now required.
The temporary dependency installation used for local verification did not modify
the global Python environment. Local/MySQL integration commands remain in
[the operations guide](club-operations.md).

## Shared UX behavior

App browser alerts have been replaced by readable live feedback. Confirmations
describe the consequence of archiving, revoking, cancelling or changing access.
Long editors warn before discarding unsaved work, including navigation/unload;
pending saves block navigation/closure. Sign-out uses the same guard. Busy forms
disable repeat submissions and retain visible progress/errors; login requests no
longer unmount their own dialog. Identity changes remount dashboard state.

The shared dialog follows [WAI-ARIA modal guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
named dialogs, keyboard containment, topmost-only Escape, inert background,
reference-counted scroll locking, focus restoration and nested confirmations.
Feedback is rendered inside the active dialog so it is not hidden behind it.
Booking crew and session searches are independent and retain selected choices.

## Startup and MySQL TLS

The duplicate connect_args keyword preventing backend startup is removed. MySQL
URL parsing now preserves options following ssl-mode instead of dropping them.
Explicit TLS requests and cloud MySQL use verified certificates and hostnames;
TLS is never made to work by disabling verification. For a private provider CA,
set CA_CERT_PATH to a trusted file available inside the backend, or provide
ssl_ca in DATABASE_URL. The existing backend/ca.pem fallback is supported.

For containers, CA_CERT_PATH must name a container path, not a Windows host path.
The Compose environment passes this variable through, but the certificate must be
included/mounted separately. Restart/rebuild using your normal deployment process;
no Docker/compose or production build was executed by the implementation work.

## Verification scope

DB-free hashing, validation, login migration, startup parsing, rendered component,
modal lifecycle and helper checks were run, plus non-emitting TypeScript checks.
The isolated MySQL integration tests skip without TEST_DATABASE_URL. Live browser
and screen-reader interaction, actual MySQL/TLS handshakes and SMTP delivery still
need deployment acceptance testing. No real accounts or outbound mail were used.
