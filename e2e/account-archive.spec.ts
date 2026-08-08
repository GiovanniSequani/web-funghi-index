import { expect, test, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const visualDir = 'node_modules/.cache/visual-checks';

async function mockPublicData(page: Page) {
  await page.route('**/storage/v1/object/public/tiles/tile_sets.json**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        tileSets: [
          { date: '2026-08-06', version: '2' },
          { date: '2026-08-06', version: '1' },
          { date: '2026-08-05', version: '1' },
        ],
      }),
    }),
  );
  await page.route('**/rest/v1/gpx_archive_config**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        singleton_id: 1,
        max_tracks_per_user: 50,
        max_compressed_bytes: 10_485_760,
        max_uncompressed_bytes: 52_428_800,
        terms_version: '2026-08-06',
        privacy_version: '2026-08-06',
        research_consent_version: '2026-08-06',
        updated_at: '2026-08-06T00:00:00Z',
      }),
    }),
  );
}

async function mockAuthenticatedAccount(page: Page) {
  const now = new Date().toISOString();
  const payload = Buffer.from(JSON.stringify({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: '9656ae68-e657-42b0-8f15-c956b6c4d55d',
    role: 'authenticated',
  })).toString('base64url');
  const accessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.test-signature`;
  const user = {
    id: '9656ae68-e657-42b0-8f15-c956b6c4d55d',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mario@example.test',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { username: 'mario_rossi' },
    identities: [],
    created_at: now,
    updated_at: now,
  };

  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'test-refresh-token',
        user,
      }),
    }),
  );
  await page.route('**/rest/v1/user_profiles**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: user.id,
        username: 'mario_rossi',
        terms_version: '2026-08-06',
        privacy_version: '2026-08-06',
        raw_gpx_research_consent: true,
        raw_gpx_research_consent_version: '2026-08-06',
      }),
    }),
  );
  await page.route('**/rest/v1/user_gpx_tracks**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'track-1', storage_path: `${user.id}/track-1.gpx.gz`, status: 'ready',
          display_name: 'Bosco del Cansiglio', original_filename: 'cansiglio.gpx',
          compressed_size_bytes: 1_048_576, uncompressed_size_bytes: 3_145_728,
          started_at: null, ended_at: null, point_count: 1240, distance_m: 8450,
          ready_at: now, created_at: now,
        },
        {
          id: 'track-2', storage_path: `${user.id}/track-2.gpx.gz`, status: 'ready',
          display_name: 'Anello del Monte', original_filename: 'monte.gpx',
          compressed_size_bytes: 524_288, uncompressed_size_bytes: 2_097_152,
          started_at: null, ended_at: null, point_count: 780, distance_m: 5100,
          ready_at: now, created_at: now,
        },
      ]),
    }),
  );
}

async function mockGpxDownloads(page: Page) {
  const xml = '<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.01" lon="11.02"/></trkseg></trk><wpt lat="46.002" lon="11.003"><name>Porcino_1</name><type>Porcino</type></wpt><wpt lat="46.004" lon="11.006"><name>Finferlo_1</name><type>Finferlo</type></wpt></gpx>';
  const body = gzipSync(Buffer.from(xml));
  await page.route('**/storage/v1/object/user-gpx/**', (route) => route.fulfill({ contentType: 'application/gzip', body }));
}
async function assertNavigationBelowProfile(page: Page) {
  const launcher = page.locator('.account-launcher');
  const navigation = page.locator('.maplibregl-ctrl-top-right');
  const launcherBounds = await launcher.boundingBox();
  const navigationBounds = await navigation.boundingBox();
  expect(launcherBounds).not.toBeNull();
  expect(navigationBounds).not.toBeNull();
  expect(navigationBounds!.y).toBeGreaterThanOrEqual(launcherBounds!.y + launcherBounds!.height + 8);
}

test('desktop anonimo: profilo sopra MapLibre, pannello indice semplificato e mappa stabile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await mockPublicData(page);
  await page.goto('/');
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => element.setAttribute('data-map-instance', 'account-original'));

  await expect(page.locator('.account-launcher strong')).toHaveText('ACCEDI');
  await assertNavigationBelowProfile(page);
  const controlPanel = page.locator('#index-control-panel');
  await expect(controlPanel.getByText('2 date in archivio')).toBeVisible();
  await expect(controlPanel.getByText('Path', { exact: true })).toHaveCount(0);
  await expect(controlPanel.getByText('Mappa', { exact: true })).toHaveCount(0);
  await expect(controlPanel.getByText('Posizione', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Accedi o registrati' }).click();
  const drawer = page.getByRole('dialog', { name: 'Account e archivio GPX' });
  await expect(drawer).toBeVisible();
  const bounds = await drawer.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(449);
  expect(bounds?.width).toBeLessThanOrEqual(500);
  await expect(drawer.getByText('Archivio personale')).toBeVisible();
  await expect(drawer.getByText('Download immediato')).toBeVisible();
  await expect(drawer.getByText('Controllo dei dati')).toBeVisible();

  await drawer.getByRole('tab', { name: 'Registrati' }).click();
  await expect(drawer.getByText('Versione 2026-08-06', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${visualDir}/account-desktop-anonymous.png`, fullPage: true });

  await drawer.getByRole('button', { name: 'Chiudi account e archivio' }).click();
  await expect(page.locator('[data-map-instance="account-original"]')).toBeVisible();
});

test('desktop autenticato: username, limiti e tracce hanno una gerarchia chiara', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await mockPublicData(page);
  await mockAuthenticatedAccount(page);
  await mockGpxDownloads(page);
  await page.goto('/');
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.evaluate((element) => element.setAttribute('data-map-instance', 'profile-original'));

  await page.getByRole('button', { name: 'Accedi o registrati' }).click();
  const drawer = page.getByRole('dialog', { name: 'Account e archivio GPX' });
  await drawer.getByLabel('Email').fill('mario@example.test');
  await drawer.getByLabel('Password').fill('password');
  await drawer.locator('.account-primary').click();

  await expect(drawer.getByRole('heading', { name: 'mario_rossi' })).toBeVisible();
  await expect(drawer.getByText('mario@example.test')).toBeVisible();
  await drawer.getByRole('button', { name: 'Utilizzo account' }).click();
  await expect(drawer.getByText('Tracce pronte', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Limite tracce', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Massimo per file', { exact: true })).toBeVisible();
  await expect(drawer.getByText('GPX non compresso', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Bosco del Cansiglio')).toBeVisible();
  await expect(drawer.getByText('Anello del Monte')).toBeVisible();
  await expect(page.locator('.account-launcher strong')).toHaveText('mario_rossi');
  await expect(drawer.locator('.gpx-track-row').first().getByText('1', { exact: true })).toHaveCount(2);
  await drawer.getByRole('button', { name: 'Mostra sulla mappa' }).first().click();
  const routesPanel = page.getByRole('complementary', { name: 'Percorsi sulla mappa' });
  await expect(routesPanel.getByText('Bosco del Cansiglio')).toBeVisible();
  await page.getByRole('button', { name: /Apri il profilo/ }).click();
  await drawer.getByRole('button', { name: 'Mostra sulla mappa' }).nth(1).click();
  await expect(routesPanel.getByText('Bosco del Cansiglio')).toBeVisible();
  await expect(routesPanel.getByText('Anello del Monte')).toBeVisible();
  await page.getByRole('button', { name: /Apri il profilo/ }).click();
  await page.screenshot({ path: `${visualDir}/account-desktop-authenticated.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDrawerBounds = await drawer.boundingBox();
  expect(mobileDrawerBounds?.width).toBeCloseTo(390, 2);
  expect(mobileDrawerBounds?.height).toBeCloseTo(844, 2);
  await page.screenshot({ path: `${visualDir}/account-mobile-authenticated.png`, fullPage: true });

  await drawer.getByRole('button', { name: 'Indietro dalla schermata account' }).click();
  const authenticatedLauncherBounds = await page.locator('.account-launcher').boundingBox();
  expect(authenticatedLauncherBounds?.width).toBeLessThanOrEqual(42);
  await expect(page.locator('.account-launcher-copy')).toBeHidden();
  await assertNavigationBelowProfile(page);
  await expect(page.locator('[data-map-instance="profile-original"]')).toBeVisible();
});

test('mobile: launcher compatto e drawer a schermo intero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPublicData(page);
  await page.goto('/');
  await expect(page.locator('.account-launcher strong')).toHaveText('ACCEDI');
  const launcherBounds = await page.locator('.account-launcher').boundingBox();
  expect(launcherBounds?.width).toBeLessThanOrEqual(100);
  await assertNavigationBelowProfile(page);

  await page.getByRole('button', { name: 'Accedi o registrati' }).click();
  const drawer = page.getByRole('dialog', { name: 'Account e archivio GPX' });
  const bounds = await drawer.boundingBox();
  expect(bounds?.width).toBeCloseTo(390, 2);
  expect(bounds?.height).toBeCloseTo(844, 2);
  await expect(drawer.getByRole('button', { name: 'Indietro dalla schermata account' })).toBeVisible();
  await expect(drawer.getByText('Il tuo spazio FunghiTracker')).toBeVisible();
  await page.screenshot({ path: `${visualDir}/account-mobile.png`, fullPage: true });
});