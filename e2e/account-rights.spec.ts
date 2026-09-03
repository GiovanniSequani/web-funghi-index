import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1280, height: 850 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(viewport.name + ': richiesta pubblica non enumerativa e responsive', async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.route('**/rest/v1/rpc/request_external_account_deletion', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ accepted: true }) }),
    );
    await page.goto('/elimina-account');
    await page.getByLabel('Email account').fill('utente@example.test');
    await page.getByRole('button', { name: 'Invia richiesta' }).click();
    await expect(page.getByRole('status')).toContainText('Se la richiesta può essere elaborata');
    const shellWidth = await page.locator('.deletion-page-shell').evaluate((element) => element.scrollWidth);
    expect(shellWidth).toBeLessThanOrEqual(viewport.width);
  });
}

test('callback: fragment rimosso, conferma esplicita e token inviato una sola volta', async ({ page }) => {
  const token = 'a'.repeat(64);
  let calls = 0;
  await page.route('**/rest/v1/rpc/confirm_account_deletion', async (route) => {
    calls += 1;
    expect(route.request().postDataJSON()).toEqual({ p_verification_token: token });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ confirmed: true, job_id: 'deletion-1' }),
    });
  });

  await page.goto('/elimina-account#token=' + token);
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  expect(calls).toBe(0);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Conferma eliminazione definitiva' }).click();
  await expect(page.getByText('Richiesta confermata')).toBeVisible();
  expect(calls).toBe(1);
});

for (const scenario of ['token scaduto', 'token già usato']) {
  test(scenario + ': risposta sicura e nuovo link', async ({ page }) => {
    await page.route('**/rest/v1/rpc/confirm_account_deletion', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'verification token is invalid or expired' }),
      }),
    );
    await page.goto('/elimina-account#token=' + 'b'.repeat(64));
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Conferma eliminazione definitiva' }).click();
    await expect(page.getByRole('alert')).toContainText('scaduto oppure è già stato usato');
    await expect(page.getByRole('link', { name: 'Richiedi un nuovo link' })).toBeVisible();
  });
}

test('errore di rete pubblico: messaggio chiaro e nessuna falsa conferma', async ({ page }) => {
  await page.route('**/rest/v1/rpc/request_external_account_deletion', (route) => route.abort('failed'));
  await page.goto('/elimina-account');
  await page.getByLabel('Email account').fill('utente@example.test');
  await page.getByRole('button', { name: 'Invia richiesta' }).click();
  await expect(page.getByRole('alert')).toContainText('Errore di rete');
  await expect(page.getByRole('status')).toHaveCount(0);
});