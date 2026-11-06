import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// Pagina "Abbonamento" (solo titolare): piano attuale, piani disponibili, pulsante di pagamento.

test('il titolare vede il suo piano e i piani disponibili', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/dati');
  await page.getByRole('link', { name: 'Abbonamento' }).click();

  // Il testo dipende dal piano attuale di Gomme Rossi (prova o pilota)
  await expect(
    page.getByText(/Prova gratuita|La prova è finita|Gratuito per tutta la durata del pilota/),
  ).toBeVisible();
  const piani = page.getByRole('region', { name: 'Piani disponibili' });
  await expect(piani.getByText('29 €/mese', { exact: true })).toBeVisible();
  await expect(piani.getByText('49 €/mese', { exact: true })).toBeVisible();

  // Nel db della CI Gomme Rossi è in prova: scelta del piano e pulsante attivo. Le Edge Functions non
  // girano: il clic dà l'errore generico, in un riquadro con il focus.
  await expect(page.getByRole('radio', { name: 'Starter — 29 €/mese' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Pro — 49 €/mese' })).not.toBeChecked();
  await page.getByRole('radio', { name: 'Pro — 49 €/mese' }).check();
  const attiva = page.getByRole('button', { name: "Attiva l'abbonamento" });
  await expect(attiva).toBeEnabled();
  await attiva.click();
  const errore = page.getByRole('alert');
  await expect(errore).toHaveText('Non riusciamo ad aprire il pagamento. Riprova tra poco.');
  await expect(errore).toBeFocused();
  await expect(attiva).toBeEnabled();
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
  await expect(page.getByRole('button', { name: 'Salva dati' })).toBeVisible();
  await expect(page.locator('form').getByRole('link', { name: 'Abbonamento' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abbonamento', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Abbonamento', exact: true }).click();
  await expect(page).toHaveURL(/\/officina\/abbonamento$/);
});
