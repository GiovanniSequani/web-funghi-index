# FunghiTracker web index

## Scope

This repository is the standalone FunghiTracker web map. Work here must stay
inside `D:\FunghiTracker\web-funghi-index`.

- Do not edit the mobile app or backend repository from this workspace.
- Backend pipelines own tile generation, upload, retention, and manifest
  publication. This frontend only discovers and renders already-published
  tiles.
- Preserve the existing map instance when changing controls. Layer, date,
  version, opacity, calendar, and panel interactions must not remount or
  recenter the map. Recentring is allowed only after the explicit
  `Centra posizione` action.

## Architecture

The site is a static React 19 + TypeScript application built by Vite.

- `index.html` provides `#root` and loads `src/main.tsx`.
- `src/main.tsx` mounts the single `App` component and global CSS.
- `src/App.tsx` owns the MapLibre map, controls, geolocation, tile selection,
  calendar, opacity, legend, and coordinate popup.
- `src/mapStyle.ts` defines the Esri satellite and place-label raster sources.
- `src/supabaseTiles.ts` is the only tile-discovery and tile-URL adapter.
- `src/types.ts` contains the shared layer, species, tile-set, and location
  types.
- `src/styles.css` contains the base responsive UI styling.
- `src/pointDetails/` contains the weather and terrain clients, grid formulas, decoders, concurrent loading hook, responsive drawer, charts, and their tests.
- `src/indexData/` contains the public `index-data` Storage client, manifest-driven
  binary decoder, stale-request-safe loading hook, popup summary, responsive
  analysis drawer, factor ranking, and tests.`r`n- `src/account/` contains Supabase Auth, the private GPX archive,`r`n  server-authoritative lifecycle gating, personal-data export and account`r`n  deletion flows, restricted/deletion UI, and related tests.
- `src/legal/` contains the bundled legal documents and the public `/termini`
  and `/privacy` pages. Lifecycle acceptance is enabled only when backend and
  bundled versions match exactly.
- `docs/account-lifecycle.md` documents rollout fallback, RPC boundaries, and
  fail-closed access behavior.
- `public/_headers` is copied into `dist/` for hosts that support the
  Cloudflare-style headers file.
- Cloudflare direct routes rely on Pages native SPA fallback: keep both
  `public/_redirects` and a top-level `public/404.html` absent. Rewriting client
  routes to `/index.html` makes Pages canonicalize them to `/` before React can
  inspect the pathname.
- `vercel.json` mirrors the security headers for Vercel.
- `dist/` and `.env*` are generated/local state and are not committed.

There is no client-side router and no server runtime. The browser directly
contacts public Supabase Storage and Esri tile endpoints.

## Commands

Use the Windows command shims in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run preview
```

- `npm.cmd run dev` starts Vite on `0.0.0.0`.
- `npm.cmd run build` is the required verification. It runs
  `tsc --noEmit` followed by `vite build` and writes `dist/`.
- `npm.cmd run preview` serves the production build locally.
- `npm.cmd test` runs the Vitest unit and hook suite.
- `npm.cmd run test:e2e` runs responsive and state checks in Edge through Playwright.
- There is currently no separate lint script. Do not claim lint passed.
- The production bundle currently triggers Vite's large-chunk warning; it is a
  warning, not a build failure.

Before handing off a change, run:

```powershell
npm.cmd run build
git status --short --branch
```

## Environment and external services

The supported public environment variables are:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
```

`src/supabaseTiles.ts` accepts only an HTTPS `*.supabase.co` origin, removes a
trailing slash, and otherwise uses the checked-in default Supabase project
URL. Both Vite variables are browser-visible public configuration. Never add a
service-role key, database password, or private token.

Cloudflare Pages must define both public variables in its production build
environment. Vite embeds them at build time, and `vite.config.ts` deliberately
fails production builds when either value is missing or invalid. Saving a
variable therefore requires a new deployment before the browser can use it.

The deployed CSP must allow:

- Supabase under `img-src` and `connect-src`;
- Esri ArcGIS hosts under `img-src` and `connect-src`;
- `blob:` workers for MapLibre.

Keep `public/_headers` and `vercel.json` aligned when changing these origins or
policies.

## Tile contract

`tile_sets.json` in the public Supabase `tiles` bucket is the source of truth.
Do not replace it with recursive Storage listing: listing the large PNG object
tree previously caused Supabase `544 DatabaseTimeout` failures.

Manifest URL:

```text
https://<project-ref>.supabase.co/storage/v1/object/public/tiles/tile_sets.json
```

Expected payload:

```json
{
  "tileSets": [
    {
      "date": "2026-07-22",
      "version": "1"
    }
  ]
}
```

Contract details:

- `tileSets` must be an array.
- `date` and `version` must be strings.
- Dates may use either `YYYY-MM-DD` or `YYYY_MM_DD`, but a single date must use
  the same separator throughout.
- `version` is one or more decimal digits.
- Invalid entries are ignored; an empty valid result is an error.
- Valid entries are sorted by date descending, then numeric version
  descending. The first entry becomes the current dataset.
- The manifest request uses `cache: no-store` plus a timestamp query parameter.
- Manifest failure is visible in the UI. The hard-coded default tile set is
  display/error fallback state, not an alternative discovery mechanism.

Raster URL template:

```text
https://<project-ref>.supabase.co/storage/v1/object/public/tiles/<date>_v<version>/<species>/{z}/{x}/{y}.png
```

Raster requirements:

- species directories are exactly `porcini` and `finferli`;
- tiles are public 256 px PNG files;
- the path order is `{z}/{x}/{y}.png`;
- supported index zooms are `3..13`;
- the bucket must permit anonymous reads and cross-origin browser requests.

The backend must publish all tile objects before adding a set to
`tile_sets.json`, and must update the manifest when retention deletes a set.
Frontend changes must remain compatible with that publication order.

## Index-data contract

The public Supabase `index-data` bucket is read through immutable manifests:

1. fetch `current.json` without Storage listing;
2. fetch the exact versioned `manifest_path`;
3. reject coordinates outside the manifest bbox before grid clamping;
4. fetch only the exact chunk path declared for the selected cell;
5. validate compressed/raw lengths and SHA-256 when Web Crypto is available;
6. decompress zlib and decode little-endian fields using only manifest offsets,
   dtypes, scales, nodata values, labels, formulas, and thresholds.

Versioned manifests and chunks may use browser/CDN caching. A changed current
version invalidates the in-memory manifest and chunk caches.

## Deployment

### Current state

As verified on 2026-07-24:

- branch `main` tracks `origin/main` at `f882df3`;
- the repository is public and its default branch is `main`;
- GitHub reports `has_pages: false`;
- `https://giovannisequani.github.io/web-funghi-index/` returns 404;
- the repository homepage points to
  `https://web-funghi-index.pages.dev/`, which currently returns 200;
- no `.github/workflows` deployment workflow is committed.

The Cloudflare Pages project configuration lives outside this repository.
The compatible settings are build command `npm.cmd run build` (or
`npm run build` on Linux), output directory `dist`, and `main` as the
production branch.

### GitHub Pages

GitHub Pages is not currently configured. Before enabling project Pages at
`/web-funghi-index/`, both of these repository changes are required:

1. Set Vite's production `base` to `/web-funghi-index/` (or derive it from the
   deployment environment). The current default `/` base is suitable for the
   Cloudflare root domain but not for GitHub project Pages.
2. Add a GitHub Actions Pages workflow that installs with `npm ci`, builds,
   uploads `dist/` with `actions/upload-pages-artifact`, and deploys with
   `actions/deploy-pages`. The workflow needs `pages: write` and
   `id-token: write`, and the repository Pages source must be GitHub Actions.

Use the official Pages actions and pin current supported major versions when
the workflow is created. Do not commit `dist/` or deploy from an ad-hoc branch.

GitHub Pages ignores both `public/_headers` and `vercel.json`; it cannot apply
the current CSP and other response headers from these files. Treat that as an
explicit hosting trade-off and re-check MapLibre, Supabase, Esri, geolocation,
and clipboard behavior on the final HTTPS Pages URL.

If a custom domain or a user-site root is chosen instead, decide the final URL
first and set Vite `base` accordingly. Do not guess the base path.

## Git discipline

- The canonical remote is
  `https://github.com/GiovanniSequani/web-funghi-index.git`.
- Keep generated `dist/`, dependencies, local `.env` files, logs, and
  TypeScript build metadata untracked.
- Inspect the worktree before editing and preserve unrelated user changes.
- Do not change app/backend files, tile data, Supabase objects, GitHub
  settings, or deployment settings unless the user explicitly asks.
- Do not add a Pages workflow and claim deployment is complete without also
  verifying the repository Pages setting and the live URL.
