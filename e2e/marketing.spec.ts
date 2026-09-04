import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`${viewport.name}: home e pagine prodotto sono navigabili`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Un modello AI per lo studio dei funghi.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Esempio dell’indice su una griglia territoriale' })).toBeVisible();
    await expect(page.locator('.index-grid i')).toHaveCount(176);
    await expect(page.locator('.index-mini-analysis li.favorable')).toHaveCount(2);
    await expect(page.locator('.index-mini-analysis li.unfavorable')).toHaveCount(1);
    await expect(page.locator('.index-mini-analysis li', { hasText: 'Piogge recenti' })).toBeVisible();
    await expect(page.locator('.index-mini-analysis li', { hasText: 'Rischio di asciugamento' })).toBeVisible();
    await expect(page.locator('.site-brand-icon').first()).toHaveAttribute('src', '/icons/icon-192.png');
    await expect(page.getByText('0–100', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Apri la mappa/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Documenti legali' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');

    await page.getByRole('link', { name: 'Come funziona', exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/come-funziona/');
    await expect(page.getByRole('heading', { name: 'Come viene calcolato l’indice.' })).toBeVisible();

    await page.getByRole('link', { name: 'Archivio', exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/archivio/');
    await expect(page.getByRole('heading', { name: 'Archivio di percorsi e ritrovamenti.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Accedi o registrati/ })).toHaveAttribute('href', '/mappa/?account=1');

    await page.getByRole('link', { name: 'Home', exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  });
}

test('la mappa resta una superficie applicativa separata e apre direttamente account', async ({ page }) => {
  await page.goto('/mappa/?account=1');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Account e archivio GPX' })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi account e archivio' }).click();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});

