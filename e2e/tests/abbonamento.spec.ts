import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// Pagina "Abbonamento" (solo titolare): piano attuale, piani disponibili, pulsante non ancora attivo.

test('il titolare vede il suo piano e i piani disponibili', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/dati');
  await page.getByRole('link', { name: 'Abbonamento' }).click();

  // Il testo dipende dal piano attuale di Gomme Rossi (prova o pilota)
  await expect(
    page.getByText(/Prova gratuita|La prova è finita|Gratuito per tutta la durata del pilota/),
  ).toBeVisible();
  await expect(page.getByText('29 €/mese')).toBeVisible();
  await expect(page.getByText('49 €/mese')).toBeVisible();
  await expect(page.getByRole('button', { name: "Attiva l'abbonamento" })).toBeDisabled();
  await expect(
    page.getByText('Il pagamento online arriva a breve: per ora scrivici con «Invia un commento».'),
  ).toBeVisible();
});

test("l'operatore non vede l'abbonamento", async ({ page }) => {
  await accedi(page, 'operatore@tyrecare.test');
  await page.goto('/officina/abbonamento');
  await expect(page.getByText("Solo il titolare vede l'abbonamento.")).toBeVisible();
});

test('il link "Abbonamento" sta fuori dal modulo dei dati e porta alla pagina', async ({
  page,
}) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/dati');
  await expect(page.locator('form').getByRole('link', { name: 'Abbonamento' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abbonamento', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Abbonamento', exact: true }).click();
  await expect(page).toHaveURL(/\/officina\/abbonamento$/);
});
