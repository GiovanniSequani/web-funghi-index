import { expect, test } from '@playwright/test';

test('mantiene il sito classico e pubblica i metadati della web app', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Funghi Tracker');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');

  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({
    id: '/',
    name: 'Funghi Tracker',
    short_name: 'Funghi Tracker',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });

  for (const path of ['/apple-touch-icon.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/favicon.png']) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});