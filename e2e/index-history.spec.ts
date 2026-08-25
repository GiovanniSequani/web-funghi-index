import { expect, test, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

const visualDir = 'node_modules/.cache/visual-checks';

function pointManifest(byteLength: number) {
  return {
    contract_version: 1,
    version: 'point-v1',
    index_date: '2026-08-24',
    dataset_sha256: 'point-sha',
    rows: 1,
    cols: 1,
    origin_lat: 0,
    origin_lon: 0,
    step_deg: 0.003,
    bbox: { west: -180, south: -90, east: 180, north: 90 },
    compression: { codec: 'zlib' },
    chunk_size: { rows: 50, cols: 50 },
    chunks: [{
      row: 0, col: 0, row_offset: 0, col_offset: 0, rows: 1, cols: 1,
      path: 'point-v1/chunks/r00_c00.bin.zlib', byte_length: byteLength, raw_byte_length: 8,
    }],
    binary_layout: {
      bytes_per_cell_uncompressed: 8,
      endianness: 'little',
      layout: 'row-major interleaved cells',
      fields: [
        { name: 'porcini_score', dtype: 'float32', offset_bytes: 0, nodata: 'NaN' },
        { name: 'finferli_score', dtype: 'float32', offset_bytes: 4, nodata: 'NaN' },
      ],
    },
    labels: {},
    porcini_diagnostics: {},
  };
}

function historyManifest(byteLength: number) {
  const dates = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 6, 28 + index));
    return date.toISOString().slice(0, 10);
  });
  const missing = dates.filter((_, index) => index === 6 || index === 15);
  return {
    contract_version: 1,
    version: 'history-v1',
    index_date: dates[27],
    dataset_sha256: 'history-sha',
    dates,
    day_count: 28,
    available_dates: dates.filter((date) => !missing.includes(date)),
    missing_dates: missing,
    rows: 1,
    cols: 1,
    origin_lat: 0,
    origin_lon: 0,
    step_deg: 0.003,
    bbox: { west: -180, south: -90, east: 180, north: 90 },
    compression: { codec: 'zlib' },
    chunk_size: { rows: 50, cols: 50 },
    chunks: [{
      row: 0, col: 0, row_offset: 0, col_offset: 0, rows: 1, cols: 1,
      path: 'history-v1/chunks/r00_c00.bin.zlib', byte_length: byteLength, raw_byte_length: 224,
    }],
    binary_layout: {
      bytes_per_cell_uncompressed: 224,
      endianness: 'little',
      layout: 'row-major interleaved cells',
      fields: [
        { name: 'porcini_score', dtype: 'float32', shape: [28], nodata: 'NaN', offset_bytes: 0 },
        { name: 'finferli_score', dtype: 'float32', shape: [28], nodata: 'NaN', offset_bytes: 112 },
      ],
    },
  };
}

async function mockIndexData(page: Page) {
  const pointRaw = Buffer.alloc(8);
  pointRaw.writeFloatLE(48.5, 0);
  pointRaw.writeFloatLE(61.25, 4);
  const pointChunk = deflateSync(pointRaw);

  const historyRaw = Buffer.alloc(224);
  for (let index = 0; index < 28; index += 1) {
    const missing = index === 6 || index === 15;
    historyRaw.writeFloatLE(missing ? Number.NaN : 25 + index * 1.7, index * 4);
    historyRaw.writeFloatLE(missing ? Number.NaN : 68 - index * 1.1, 112 + index * 4);
  }
  const historyChunk = deflateSync(historyRaw);
  const history = historyManifest(historyChunk.byteLength);

  await page.route('**/storage/v1/object/public/index-data/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/index-data/current.json')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        contract_version: 1,
        version: 'point-v1',
        index_date: '2026-08-24',
        manifest_path: 'point-v1/manifest.json',
        dataset_sha256: 'point-sha',
      }) });
    }
    if (url.endsWith('/index-data/point-v1/manifest.json')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(pointManifest(pointChunk.byteLength)) });
    }
    if (url.endsWith('/index-data/point-v1/chunks/r00_c00.bin.zlib')) {
      return route.fulfill({ contentType: 'application/zlib', body: pointChunk });
    }
    return route.abort();
  });

  await page.route('**/storage/v1/object/public/index-history/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/index-history/current.json')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        contract_version: 1,
        version: 'history-v1',
        index_date: history.index_date,
        date_from: history.dates[0],
        date_to: history.dates[27],
        day_count: 28,
        manifest_path: 'history-v1/manifest.json',
        dataset_sha256: 'history-sha',
      }) });
    }
    if (url.endsWith('/index-history/history-v1/manifest.json')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(history) });
    }
    if (url.endsWith('/index-history/history-v1/chunks/r00_c00.bin.zlib')) {
      return route.fulfill({ contentType: 'application/zlib', body: historyChunk });
    }
    return route.abort();
  });
}

async function openAnalysis(page: Page, touch = false) {
  await mockIndexData(page);
  await page.goto('/');
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => element.setAttribute('data-history-map', 'original'));
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Map bounds unavailable');
  if (touch) {
    const clientX = bounds.x + bounds.width * 0.5;
    const clientY = bounds.y + bounds.height * 0.6;
    await canvas.dispatchEvent('pointerdown', {
      bubbles: true, clientX, clientY, isPrimary: true, pointerId: 1, pointerType: 'touch',
    });
    await page.waitForTimeout(650);
    await canvas.dispatchEvent('pointerup', {
      bubbles: true, clientX, clientY, isPrimary: true, pointerId: 1, pointerType: 'touch',
    });
  } else {
    await canvas.click({ button: 'right', position: { x: bounds.width * 0.55, y: bounds.height * 0.55 } });
  }
  const popup = page.locator('.coordinate-popup-card');
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Analisi indice' }).click();
  return page.getByRole('dialog', { name: 'Analisi indice' });
}

test('storico indice desktop: due linee, gap e mappa montata', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const drawer = await openAnalysis(page);
  await expect(drawer.getByRole('heading', { name: 'Andamento recente' })).toBeVisible();
  await expect(drawer.locator('.recharts-line-curve')).toHaveCount(2);
  await expect(drawer.getByText('oggi')).toBeVisible();
  await drawer.locator('.index-history-chart').focus();
  await drawer.locator('.index-history-chart').press('ArrowLeft');
  await expect(drawer.locator('.index-history-readout')).toContainText('/100');
  await expect(page.locator('[data-history-map="original"]')).toBeVisible();
  await page.screenshot({ path: visualDir + '/index-history-desktop.png', fullPage: true });
});

test('storico indice mobile: pannello pieno e grafico senza scroll orizzontale', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const drawer = await openAnalysis(page, true);
  await expect(drawer.getByRole('heading', { name: 'Andamento recente' })).toBeVisible();
  const drawerBounds = await drawer.boundingBox();
  const chartBounds = await drawer.locator('.index-history-chart').boundingBox();
  expect(drawerBounds?.width).toBeCloseTo(390, 2);
  expect(chartBounds?.width).toBeLessThanOrEqual(362);
  await expect(drawer.locator('.recharts-line-curve')).toHaveCount(2);
  await expect(page.locator('[data-history-map="original"]')).toBeVisible();
  await page.screenshot({ path: visualDir + '/index-history-mobile.png', fullPage: true });
});