# Account lifecycle frontend

This document describes the web enforcement of the FunghiTracker contributor
account lifecycle. The backend contracts remain authoritative.

## Entry points

- src/account/useAccountLifecycle.ts loads public lifecycle configuration and
  the authenticated account access state.
- src/account/lifecycleClient.ts is the only adapter for lifecycle RPCs.
- src/account/AccountLifecyclePanel.tsx renders restricted, terms-action,
  security, inactivity, and deletion-pending states.
- src/legal/ contains the bundled legal documents and public /termini and
  /privacy pages.
- src/account/AccountArchiveDrawer.tsx gates every archive load and action on
  the server-provided full_access result.

The map remains mounted while account panels change state. Lifecycle updates
clear private archive state when access is lost but do not change map camera,
zoom, bearing, or pitch.

## Backend authority and fail-closed behavior

When lifecycle is enabled, the browser never derives access from the JWT,
profile metadata, or local checkboxes. It calls get_my_account_access and
allows GPX archive operations only when the response contains full_access:
true. Missing, invalid, or failed access responses remain limited.

get_account_lifecycle_public_config controls rollout. A missing RPC (PGRST202,
PostgreSQL 42883, or equivalent schema-cache error) is treated as the legacy
deployment and preserves the current archive behavior. A present API with
lifecycle_enabled: false also preserves legacy behavior. Other configuration
failures are not downgraded to legacy access.

The frontend calls record_my_legal_notice_seen only after the exact bundled
documents are visible. Acceptance/refusal sends exact versions and source web.
Meaningful activity is recorded only for interactive login, foreground
session, or an explicit account action.

A lifecycle-enabled registration sends the username, current Terms and Privacy
versions, acceptance flags, and source web. It does not reuse the legacy
raw-GPX research consent as an access condition.

## Legal documents

Bundled versions are Terms 0.2 and Privacy 0.3, copied from the current
authoritative product documents. Their draft/not-effective banners remain
visible. Acceptance is disabled if the versions requested by the backend do
not exactly match the bundled versions.

Cloudflare SPA fallbacks for /termini and /privacy are declared in
public/_redirects.

## Restricted and deletion states

Restricted accounts can read the legal documents, accept or refuse the current
versions when permitted by the backend, refresh account state, contact support,
or sign out. They cannot load profile/archive rows, Storage objects, markers,
or GPX actions.

Deletion-pending and security-restricted accounts are not offered autonomous`r`nreactivation. When the account-rights APIs are available, restricted users can`r`nrequest export and deletion without regaining GPX archive access. The UI never`r`npresents deletion as completed before the backend actually completes it.

## Verification

Run npm.cmd test, npm.cmd run build, and npm.cmd run test:e2e.

Unit coverage includes legacy rollout fallback, fail-closed access,
server-exact RPC arguments, lifecycle signup metadata, document version
matching, terms notice timing, and deletion-pending UI.
