# Runtime pre-release web verification — 11 September 2026

Target: `https://web-funghi-index.pages.dev`

The checks below used only disposable accounts and temporary mailboxes. No
existing account was changed, no deletion token was confirmed, no private GPX
was removed, and no email address, password, session, or one-time token was
written to this repository or included in the test output.

## Result

The Auth callbacks, public account routes, lifecycle state transitions, and RLS
isolation for profiles and exports passed. The GPX archive is **blocked in the
production backend** for authenticated active accounts by a database permission
error described below. This runtime check therefore does not approve the GPX
archive for release.

## Auth and callbacks

- PASS — signup, confirmation email, login, persisted session, logout, password
  recovery, password update, and login with the new password.
- PASS — confirmation links target only `/auth/confirm`; recovery links target
  only `/auth/recovery`.
- PASS — both flows require an explicit click before OTP verification.
- PASS — the one-time token is supplied in the URL fragment, not the query.
- PASS — the fragment is removed before the first React render.
- PASS — the token was absent from local storage, session storage, cookies,
  browser console messages, and browser request URLs.

## Isolation and account states

Two distinct disposable authenticated accounts were checked in separate browser
contexts.

- PASS — each account could read its own profile and lifecycle state.
- PASS — filtering `user_profiles` with the other account ID returned no rows.
- PASS — each account could read only its own export job; filtering by the other
  account's export job ID returned no rows.
- PASS — active access reported `full_access=true`.
- PASS — explicit refusal moved the account to restricted access with
  `full_access=false`; accepting the current documents restored active access.
- PASS — the restricted UI exposed legal/account-rights actions without
  rendering the private archive contents.
- PASS — export requests were accepted for active and restricted disposable
  accounts, consistently with the published account-rights contract.
- PASS — a deletion-verification email could be requested after explicit UI
  confirmation. The one-time link was deliberately not opened, so no deletion
  was scheduled or completed.
- NOT EXECUTED — `deletion_pending` was not created at runtime because reaching
  that state requires confirming the irreversible deletion flow. Its frontend
  behavior remains covered by the automated test suite.

## GPX archive blocker

Both active disposable accounts received the following backend response while
loading their own archive:

```text
permission denied for function has_current_contributor_access
```

This occurs before the frontend can upload or read an account's own GPX data.
Consequently, owner access and cross-account isolation for GPX rows, marker
rows, and private Storage objects could not be exercised end to end. Profile,
lifecycle, and export isolation do not show the same failure.

The error points to database function execution/policy configuration. It must
be corrected and redeployed by the backend/Supabase owner, then the two-account
GPX runtime checks must be repeated. The web frontend must not bypass or hide
this server-side authorization gate.

## Public routes and response headers

Direct browser navigation rendered the expected React page, without redirecting
to the map, for:

- `/termini/`
- `/privacy/`
- `/account-e-dati/`
- `/elimina-account/`

Direct HTTPS responses for `/`, all four public routes, `/auth/confirm`, and
`/auth/recovery` included HSTS. Both Auth callbacks and both
`/elimina-account` URL variants returned `Cache-Control: no-store` and
`Referrer-Policy: no-referrer`. Normal public pages retained their non-sensitive
cache/referrer policy.

## Follow-up release gate

1. Grant the intended authenticated role access to the backend helper used by
   the GPX RLS policies, without weakening row ownership checks.
2. Repeat own-account archive load/upload/download and cross-account row,
   marker, and Storage denial checks with two new disposable accounts.
3. Keep deletion confirmation outside this non-destructive pre-release check;
   validate `deletion_pending` only in an explicitly approved disposable-account
   cleanup exercise.
