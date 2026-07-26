import { expect, test, type Page } from '@playwright/test';

const visualDir = 'node_modules/.cache/visual-checks';

async function openDetails(page: Page, relativeX = 0.55, relativeY = 0.55) {
  await page.goto('/');
  const map = page.locator('.map-canvas');
  await expect(map.locator('.maplibregl-canvas')).toBeVisible();
  const bounds = await map.boundingBox();
  if (!bounds) throw new Error('Map bounds unavailable');

  await map.click({
    button: 'right',
    position: { x: bounds.width * relativeX, y: bounds.height * relativeY },
  });
  const popup = page.locator('.coordinate-popup-card');
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Mostra dettagli' }).click();
  await expect(page.getByRole('dialog', { name: 'Dettagli del punto' })).toBeVisible();
}
async function longPressMap(page: Page, relativeX = 0.5, relativeY = 0.62) {
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Map canvas bounds unavailable');
  const clientX = bounds.x + bounds.width * relativeX;
  const clientY = bounds.y + bounds.height * relativeY;

  await canvas.dispatchEvent('pointerdown', {
    bubbles: true,
    clientX,
    clientY,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
  });
  await page.waitForTimeout(650);
  await canvas.dispatchEvent('pointerup', {
    bubbles: true,
    clientX,
    clientY,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
  });
  await canvas.dispatchEvent('click', {
    bubbles: true,
    clientX,
    clientY,
  });
}


test('desktop largo: serie completa, giorno mancante, tooltip e mappa stabile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    element.setAttribute('data-map-instance', 'original');
  });

  const map = page.locator('.map-canvas');
  const bounds = await map.boundingBox();
  if (!bounds) throw new Error('Map bounds unavailable');
  await map.click({
    button: 'right',
    position: { x: bounds.width * 0.55, y: bounds.height * 0.55 },
  });
  await page.getByRole('button', { name: 'Mostra dettagli' }).click();

  const drawer = page.getByRole('dialog', { name: 'Dettagli del punto' });
  await expect(drawer.getByRole('heading', { name: 'Terreno' })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Temperature' })).toBeVisible();
  await expect(drawer.getByText(/Giorni mancanti:/)).toBeVisible();
  const drawerBounds = await drawer.boundingBox();
  expect(drawerBounds?.width).toBeGreaterThanOrEqual(449);
  expect(drawerBounds?.width).toBeLessThanOrEqual(500);

  const firstChart = drawer.locator('.weather-chart-frame').first();
  await firstChart.focus();
  const initialDate = await drawer.locator('#selected-day-title').textContent();
  await firstChart.press('ArrowLeft');
  await expect(drawer.locator('#selected-day-title')).not.toHaveText(initialDate ?? '');
  await firstChart.hover({ position: { x: 190, y: 80 } });
  await expect(drawer.locator('.weather-tooltip')).toHaveCount(4);
  await expect(drawer.locator('.weather-tooltip').first()).toBeVisible();

  await page.screenshot({ path: `${visualDir}/desktop-wide.png`, fullPage: true });
  await drawer.getByRole('button', { name: 'Chiudi dettagli del punto' }).click();
  await expect(drawer).toBeHidden();
  await expect(page.locator('[data-map-instance="original"]')).toBeVisible();
});

test('desktop compatto mantiene mappa visibile e drawer entro 500 px', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 760 });
  await openDetails(page);
  const drawer = page.getByRole('dialog', { name: 'Dettagli del punto' });
  const drawerBounds = await drawer.boundingBox();
  expect(drawerBounds?.width).toBeGreaterThanOrEqual(449);
  expect(drawerBounds?.width).toBeLessThanOrEqual(500);
  const mapBounds = await page.locator('.map-canvas').boundingBox();
  expect(mapBounds?.width).toBe(900);
  await page.screenshot({ path: `${visualDir}/desktop-compact.png`, fullPage: true });
});

test('mobile usa un pannello a schermo intero e navigazione touch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await longPressMap(page);
  const popup = page.locator('.coordinate-popup-card');
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Mostra dettagli' }).click();
  const drawer = page.getByRole('dialog', { name: 'Dettagli del punto' });
  const drawerBounds = await drawer.boundingBox();
  expect(drawerBounds?.width).toBeCloseTo(390, 2);
  expect(drawerBounds?.height).toBeCloseTo(844, 2);
  await expect(drawer.getByRole('button', { name: 'Chiudi dettagli del punto' })).toBeVisible();

  await expect(drawer.getByRole('heading', { name: 'Temperature' })).toBeVisible();
  const chart = drawer.locator('.weather-chart-frame').first();
  const before = await drawer.locator('#selected-day-title').textContent();
  await chart.tap({ position: { x: 80, y: 70 } });
  await expect(drawer.locator('#selected-day-title')).not.toHaveText(before ?? '');
  await page.screenshot({ path: `${visualDir}/mobile.png`, fullPage: true });
});

test('stato loading indipendente per le due sorgenti', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.route('**/rest/v1/public_weather_state**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.abort('timedout');
  });
  await page.route('**/storage/v1/object/public/terrain/current.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.abort('timedout');
  });
  await openDetails(page);
  await expect(page.getByText('Caricamento ultimi 20 giorni…')).toBeVisible();
  await expect(page.getByText('Caricamento dati del terreno…')).toBeVisible();
  await page.screenshot({ path: `${visualDir}/loading.png`, fullPage: true });
});

test('errore di rete mostra entrambe le sorgenti e il pulsante Riprova', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.route('**/rest/v1/public_weather_state**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/storage/v1/object/public/terrain/current.json', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await openDetails(page);
  await expect(page.getByRole('button', { name: 'Riprova' })).toBeVisible();
  await expect(page.getByText(/Stato meteo non disponibile/)).toBeVisible();
  await expect(page.getByText(/Versione terreno non disponibile/)).toBeVisible();
  await page.screenshot({ path: `${visualDir}/network-error.png`, fullPage: true });
});

test('punto fuori copertura non viene clampato sulle celle di bordo', async ({ page }) => {
  const dates = Array.from({ length: 20 }, (_, index) => `2026-07-${String(index + 1).padStart(2, '0')}`);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.route('**/rest/v1/public_weather_state**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ current_version: 'test' }]),
    }),
  );
  await page.route('**/rest/v1/public_weather_datasets**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        version: 'test',
        dates,
        available_day_count: 20,
        missing_dates: [],
        rows: 84,
        cols: 117,
        bbox: { west: 0, south: 0, east: 1, north: 1 },
        origin_lat: 0,
        origin_lon: 0,
        step_deg: 0.018,
        variables: {},
      }]),
    }),
  );
  await page.route('**/storage/v1/object/public/terrain/current.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        contract_version: 1,
        dataset_sha256: 'test',
        manifest_path: 'test/manifest.json',
        version: 'test',
      }),
    }),
  );
  await page.route('**/storage/v1/object/public/terrain/test/manifest.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 'test',
        rows: 500,
        cols: 700,
        step_deg: 0.003,
        origin_lat: 0,
        origin_lon: 0,
        bbox: { west: 0, south: 0, east: 1, north: 1 },
        chunk_size: { rows: 50, cols: 50 },
        chunks: [],
      }),
    }),
  );
  await openDetails(page);
  await expect(page.getByText('Il punto è fuori dalla copertura meteorologica.')).toBeVisible();
  await expect(page.getByText('Il punto è fuori dalla copertura del terreno.')).toBeVisible();
  await page.screenshot({ path: `${visualDir}/outside-coverage.png`, fullPage: true });
});
