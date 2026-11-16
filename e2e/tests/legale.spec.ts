import { expect, test } from '@playwright/test';

// Informativa, termini e cookie policy si leggono senza account.

for (const [percorso, titolo] of [
  ['/privacy', 'Informativa sul trattamento dei dati personali — TyreCare'],
  ['/termini', 'Termini di servizio — TyreCare'],
  ['/cookie', 'Cookie policy — TyreCare'],
] as const) {
  test(`senza accesso ${percorso} mostra il titolo e i link legali`, async ({ page }) => {
    await page.goto(percorso);
    await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cookie', exact: true })).toHaveAttribute(
      'href',
      '/cookie',
    );
    await expect(page.getByRole('link', { name: 'Torna indietro' })).toBeVisible();
  });
}

test('aperta direttamente, "Torna indietro" resta su TyreCare', async ({ page }) => {
  await page.goto('/termini');
  const indietro = page.getByRole('link', { name: 'Torna indietro' });
  await expect(indietro).toBeVisible();
  await indietro.click();
  await expect(page).toHaveURL(/\/(accedi)?(\?[^#]*)?$/);
  await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible();
});
