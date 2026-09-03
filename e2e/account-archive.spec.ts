import { expect, test, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const visualDir = 'node_modules/.cache/visual-checks';

async function mockPublicData(page: Page, lifecycleEnabled = false) {
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
  await page.route('**/rest/v1/rpc/get_account_lifecycle_public_config', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        lifecycle_enabled: lifecycleEnabled,
        current_terms_version: lifecycleEnabled ? '0.2' : null,
        current_privacy_version: lifecycleEnabled ? '0.3' : null,
        reaccept_days: 365,
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
  await page.route('**/rest/v1/account_export_jobs**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/rest/v1/rpc/request_my_data_export', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'export-1',
        status: 'pending',
        storage_path: user.id + '/export-1.zip',
        requested_at: now,
        ready_at: null,
        expires_at: null,
        size_bytes: null,
        last_error_code: null,
        updated_at: now,
      }),
    }),
  );
  await page.route('**/rest/v1/rpc/request_my_account_deletion_verification', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ accepted: true, expires_in_minutes: 2880 }),
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
          started_at: null, ended_at: null, point_count: 4, distance_m: 8450,
          trim_start_point_index: null, trim_end_point_index: null,
          ready_at: now, created_at: now,
        },
        {
          id: 'track-2', storage_path: `${user.id}/track-2.gpx.gz`, status: 'ready',
          display_name: 'Anello del Monte', original_filename: 'monte.gpx',
          compressed_size_bytes: 524_288, uncompressed_size_bytes: 2_097_152,
          started_at: null, ended_at: null, point_count: 4, distance_m: 5100,
          trim_start_point_index: null, trim_end_point_index: null,
          ready_at: now, created_at: now,
        },
      ]),
    }),
  );
  await page.route('**/rest/v1/user_gpx_mushroom_markers**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/rest/v1/rpc/rename_my_gpx_track', async (route) => {
    const payload = route.request().postDataJSON() as { p_track_id: string; p_new_name: string };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: payload.p_track_id, display_name: payload.p_new_name }) });
  });
  await page.route('**/rest/v1/rpc/reserve_my_gpx_track', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'uploaded-track', storage_path: `${user.id}/uploaded-track.gpx.gz` }) }));
  await page.route('**/rest/v1/rpc/finalize_my_gpx_track', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'uploaded-track', display_name: 'Sentiero importato', storage_path: `${user.id}/uploaded-track.gpx.gz`, status: 'ready' }) }));
}

async function mockGpxDownloads(page: Page) {
  const xml = '<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.01" lon="11.01"/><trkpt lat="46.02" lon="11.02"/><trkpt lat="46.03" lon="11.03"/></trkseg></trk><wpt lat="46.002" lon="11.003"><name>Porcino_1</name><type>Porcino</type></wpt><wpt lat="46.004" lon="11.006"><name>Finferlo_1</name><type>Finferlo</type></wpt></gpx>';
  const body = gzipSync(Buffer.from(xml));
  await page.route('**/storage/v1/object/user-gpx/**', (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ contentType: 'application/json', body: '{}' });
    return route.fulfill({ contentType: 'application/gzip', body });
  });
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
  await expect(drawer.getByRole('heading', { name: 'I tuoi dati' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Richiedi export' }).click();
  await expect(drawer.getByText('In coda')).toBeVisible();
  await drawer.getByRole('button', { name: 'Utilizzo account' }).click();
  await expect(drawer.getByText('Tracce pronte', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Limite tracce', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Massimo per file', { exact: true })).toBeVisible();
  await expect(drawer.getByText('GPX non compresso', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Bosco del Cansiglio')).toBeVisible();
  await expect(drawer.getByText('Anello del Monte')).toBeVisible();
  await drawer.getByRole('button', { name: 'Importa GPX' }).click();
  await drawer.locator('.gpx-hidden-input').setInputFiles({
    name: 'locale.gpx', mimeType: 'application/gpx+xml',
    buffer: Buffer.from('<?xml version="1.0"?><gpx><trk><name>Nome originale</name><trkseg><trkpt lat="46" lon="11"/><trkpt lat="46.01" lon="11.01"/><trkpt lat="46.02" lon="11.02"/><trkpt lat="46.03" lon="11.03"/></trkseg></trk></gpx>'),
  });
  await drawer.getByLabel('Nome traccia').fill('Sentiero importato');
  await drawer.getByRole('button', { name: 'Salva nel cloud' }).click();
  await expect(drawer.getByText('Traccia salvata nel cloud.')).toBeVisible();
  const firstTrackRow = drawer.locator('.gpx-track-row').first();
  await firstTrackRow.getByRole('button', { name: /Altre opzioni/ }).click();
  await firstTrackRow.getByRole('menuitem', { name: 'Rinomina' }).click();
  await drawer.getByLabel('Nuovo nome').fill('Bosco rinominato');
  await drawer.getByRole('button', { name: 'Salva nome' }).click();
  await expect(drawer.getByText('Bosco rinominato')).toBeVisible();
  await expect(page.locator('.account-launcher strong')).toHaveText('mario_rossi');
  await expect(drawer.locator('.gpx-track-row').first().getByText('1', { exact: true })).toHaveCount(2);
  await drawer.getByRole('button', { name: 'Mostra sulla mappa' }).first().click();
  const routesPanel = page.getByRole('complementary', { name: 'Percorsi sulla mappa' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Nascondi dalla mappa' })).toBeVisible();
  await expect(routesPanel.getByText('Bosco rinominato')).toBeVisible();
  await drawer.getByRole('button', { name: 'Mostra sulla mappa' }).first().click();
  await expect(routesPanel.getByText('Bosco rinominato')).toBeVisible();
  await expect(routesPanel.getByText('Anello del Monte')).toBeVisible();
  await expect(routesPanel.getByText('Porcini 1').first()).toBeVisible();
  await expect(routesPanel.getByText('Finferli 1').first()).toBeVisible();
  await page.screenshot({ path: `${visualDir}/account-desktop-authenticated.png`, fullPage: true });

  const renamedRow = drawer.locator('.gpx-track-row').first();
  await renamedRow.getByRole('button', { name: /Altre opzioni/ }).click();
  await renamedRow.getByRole('menuitem', { name: 'Modifica' }).click();
  const editorPanel = page.getByRole('dialog', { name: 'Modifica percorso' });
  await expect(editorPanel).toBeVisible();
  await expect(drawer).toBeVisible();
  const editorZ = await editorPanel.evaluate((element) => Number(getComputedStyle(element).zIndex));
  const drawerZ = await drawer.evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(editorZ).toBeGreaterThan(drawerZ);
  await expect(editorPanel.getByRole('slider', { name: 'Punto marker' })).toHaveCount(0);
  await page.locator('.maplibregl-canvas').click({ position: { x: 615, y: 600 } });
  await expect(editorPanel.locator('.gpx-point-stepper output')).not.toHaveText('Nessun punto selezionato');
  await editorPanel.getByRole('button', { name: 'Finferli' }).click();
  await expect(editorPanel.getByRole('button', { name: 'Finferli' })).toHaveClass(/is-active/);
  const desktopEditorBounds = await editorPanel.boundingBox();
  expect(desktopEditorBounds?.width).toBeGreaterThanOrEqual(380);
  await editorPanel.getByRole('slider', { name: 'Inizio mantenuto' }).fill('1');
  await expect(editorPanel.getByText('3 punti mantenuti')).toBeVisible();
  await editorPanel.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(drawer).toBeVisible();
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
  await routesPanel.getByRole('button', { name: 'Modifica Bosco rinominato' }).click();
  const mobileEditor = page.getByRole('dialog', { name: 'Modifica percorso' });
  const mobileEditorBounds = await mobileEditor.boundingBox();
  expect(mobileEditorBounds?.width).toBeCloseTo(374, 2);
  expect(mobileEditorBounds?.height).toBeLessThanOrEqual(650);
  await mobileEditor.getByRole('button', { name: 'Annulla', exact: true }).click();

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
test('lifecycle ristretto: documenti e riattivazione senza accesso GPX, desktop e mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await mockPublicData(page, true);
  await mockAuthenticatedAccount(page);
  const restricted = {
    account_state: 'restricted',
    restriction_reason: 'terms_outdated',
    terms_version: '0.1',
    privacy_version: '0.2',
    current_terms_version: '0.2',
    current_privacy_version: '0.3',
    legal_notice_first_seen_at: null,
    legal_notice_privacy_version: null,
    legal_reaccept_deadline_at: '2026-10-01T00:00:00Z',
    last_meaningful_activity_at: null,
    inactivity_delete_after: null,
    full_access: false,
    needs_terms_action: true,
  };
  await page.route('**/rest/v1/rpc/get_my_account_access', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(restricted) }),
  );
  await page.route('**/rest/v1/rpc/record_my_meaningful_activity', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(restricted) }),
  );
  await page.route('**/rest/v1/rpc/record_my_legal_notice_seen', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...restricted, legal_notice_first_seen_at: '2026-09-01T08:00:00Z' }) }),
  );

  let privateArchiveRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/user_gpx_tracks')) privateArchiveRequests += 1;
  });

  await page.goto('/');
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.evaluate((element) => element.setAttribute('data-map-instance', 'restricted-original'));
  await page.getByRole('button', { name: 'Accedi o registrati' }).click();
  const drawer = page.getByRole('dialog', { name: 'Account e archivio GPX' });
  await drawer.getByLabel('Email').fill('mario@example.test');
  await drawer.getByLabel('Password').fill('password');
  await drawer.locator('.account-primary').click();

  await expect(drawer.getByText('È richiesta una nuova accettazione')).toBeVisible();
  await expect(drawer.getByText('Termini · versione 0.2')).toBeVisible();
  await expect(drawer.getByText('Privacy · versione 0.3')).toBeVisible();
  await expect(drawer.getByText(/restano disponibili anche con account sospeso/)).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Richiedi export' })).toBeVisible();
  expect(privateArchiveRequests).toBe(0);
  await expect(page.locator('[data-map-instance="restricted-original"]')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await drawer.boundingBox();
  expect(bounds?.width).toBeCloseTo(390, 2);
  expect(bounds?.height).toBeCloseTo(844, 2);
  await expect(drawer.getByRole('button', { name: 'Indietro dalla schermata account' })).toBeVisible();
  expect(privateArchiveRequests).toBe(0);
});
