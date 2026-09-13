# Runtime pre-release web verification — 11-13 September 2026

Target: `https://web-funghi-index.pages.dev`

The checks below used only disposable accounts and temporary mailboxes. No
existing account was changed, no deletion token was confirmed, no private GPX
was removed, and no email address, password, session, or one-time token was
written to this repository or included in the test output.

## Result

The Auth callbacks, public account routes, lifecycle state transitions, export,
and two-account RLS/Storage isolation passed. The GPX blocker found on 11
September was corrected by the backend and the complete archive flow passed on
13 September after backend fix `8d63055`. AND-REL-001 is complete.

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
- PASS — a disposable restricted account requested deletion verification, the
  backend pipeline delivered the one-time email, and an explicit browser click
  moved it to `deletion_pending`. GPX rows, markers, and the private Storage
  object remained inaccessible. The final deletion job was not executed.

## GPX archive follow-up — AND-REL-001

The 13 September follow-up used two new disposable accounts, two synthetic GPX
files, unique cache-busting Storage requests, and `Cache-Control: no-cache,
no-store`.

- PASS — active owner reservation, authenticated Storage upload, finalization,
  admission to `ready`, archive listing, private download, and marker save/read.
- PASS — the published map downloaded the private GPX with the user's session,
  loaded the MapLibre worker, and rendered the line, endpoint markers, and a
  porcini marker at its actual GPX point index.
- PASS — the second active account could not read the owner's GPX metadata,
  marker, profile/lifecycle fields, export job, or Storage object.
- PASS — after the second account became `restricted`, its own GPX rows and
  markers were hidden and direct Storage download was denied. Export request
  remained available as required by the rights contract.
- PASS — after explicit email confirmation changed that account to
  `deletion_pending`, direct Storage download and GPX/marker reads remained
  denied. No final account deletion was run.
- PASS — active and restricted export requests, owner-only export visibility,
  and lifecycle access RPCs showed no regression.

The web client uses authenticated
`supabase.storage.from('user-gpx').download(storage_path)` and keeps only the
temporary object URL required by a browser download, revoking it immediately.
It does not create or retain a signed GPX URL.

The earlier `permission denied for function has_current_contributor_access`
error and the restricted-account Storage leak are retained here as historical
findings; neither reproduced after the backend fixes.

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

## Release-gate conclusion

AND-REL-001 is complete. This result closes only the web GPX/archive runtime
item; other Android signing, configuration, and release-roadmap gates retain
their own evidence requirements.
