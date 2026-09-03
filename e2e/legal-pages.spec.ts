import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1280, height: 850 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(viewport.name + ': documenti legali pubblici e responsive', async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/termini');
    await expect(page.getByRole('heading', { name: /Termini di utilizzo/ }).first()).toBeVisible();
    await expect(page.getByText('Versione 0.2')).toBeVisible();
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/privacy');
    await expect(page.getByRole('heading', { name: /Informativa privacy/ }).first()).toBeVisible();
    const documentWidth = await page.locator('.legal-page').evaluate((element) => element.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewport.width);
  });
}