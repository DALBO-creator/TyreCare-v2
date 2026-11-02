import { expect, test } from '@playwright/test';

// Informativa e termini si leggono senza account; finché sono bozze un avviso lo dice.

const AVVISO = 'Testo in bozza: la versione definitiva arriverà dopo la revisione legale.';

for (const [percorso, titolo] of [
  ['/privacy', 'Informativa sul trattamento dei dati personali — TyreCare'],
  ['/termini', 'Termini di servizio — TyreCare'],
] as const) {
  test(`senza accesso ${percorso} mostra l'avviso di bozza e il titolo`, async ({ page }) => {
    await page.goto(percorso);
    await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();
    await expect(page.getByText(AVVISO)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Torna indietro' })).toBeVisible();
  });
}

test('aperta direttamente, "Torna indietro" resta su TyreCare', async ({ page }) => {
  await page.goto('/termini');
  const indietro = page.getByRole('link', { name: 'Torna indietro' });
  await expect(indietro).toBeVisible();
  await indietro.click();
  await expect(page).toHaveURL(/\/(accedi)?$/);
  await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible();
});
