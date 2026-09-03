# Account rights frontend

The web frontend uses only account-rights operations published by the backend contract. It does not emulate export generation, deletion, email delivery, or worker completion.

## Personal-data export

src/account/rightsClient.ts calls request_my_data_export() and reads only authenticated user rows from account_export_jobs. Ready and unexpired archives are downloaded from the private user-data-exports bucket with the current JWT; the browser never creates a public or signed URL.

The UI distinguishes queued, building, retry, ready, expired, cleaning, and unavailable states. It displays server expiry and prevents download after expiry. The description covers account/profile/legal history, GPX metadata and raw files, mushroom markers, and minimal service-email history.

## Account deletion

Authenticated users call request_my_account_deletion_verification() only after explicit confirmation. The response means that a verification message was accepted, not that deletion completed.

/elimina-account is public and calls request_external_account_deletion(p_email) with a generic response. Email links carry the one-time token as #token=...; src/account/deletionToken.ts reads it only on that route and immediately removes the fragment with history.replaceState. The token remains only in memory, is never logged or stored, and reaches confirm_account_deletion only after a user click.

Expired, invalid, and already-used tokens share the same safe message. Success means the backend deletion job is in progress; the page logs out locally without claiming that erasure is already complete.

## Access states and rollout

- Active accounts retain the archive and receive export/deletion controls.
- Restricted accounts receive rights controls but no GPX archive or private GPX Storage access.
- Deletion-pending accounts see an in-progress state and cannot self-reactivate.
- Missing or disabled rights APIs are reported as unavailable; the frontend does not fabricate successful jobs.

The map remains mounted and no rights interaction changes its camera.

## Hosting and verification

Cloudflare native SPA fallback covers /account-e-dati and /elimina-account. The build intentionally has neither a top-level 404.html nor _redirects rewrites to /index.html, so direct requests retain their pathname. The public deletion route uses Cache-Control: no-store and Referrer-Policy: no-referrer, mirrored in vercel.json.

Run npm.cmd test, npm.cmd run build, and npm.cmd run test:e2e with the account archive, account rights, and legal page specifications.

Coverage includes desktop/mobile rendering, suspended accounts, expired exports, explicit confirmation, expired/already-used tokens, logout, and network failures.
