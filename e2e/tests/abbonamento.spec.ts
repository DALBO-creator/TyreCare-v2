import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// Pagina "Abbonamento" (solo titolare), in sola lettura: stato, prezzi e contatto. Nell'app non si paga.

test('il titolare vede lo stato, i prezzi e come rinnovare', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/dati');
  await page.getByRole('link', { name: 'Abbonamento' }).click();

  // Nel db di prova Gomme Rossi è in prova
  await expect(page.getByText(/Prova gratuita: manc|La prova gratuita è finita/)).toBeVisible();
  const prezzi = page.getByRole('region', { name: 'Prezzi' });
  await expect(prezzi.getByText('100 €/mese', { exact: true })).toBeVisible();
  await expect(prezzi.getByText('1000 €/anno', { exact: true })).toBeVisible();
  await expect(prezzi.getByText(/Installazione e avvio: 149 € una tantum/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cosa è incluso' })).toBeVisible();

  // Nessun pagamento nell'app: solo il link per scrivere a TyreCare
  const contatta = page.getByRole('link', { name: 'Scrivi a TyreCare' });
  await expect(contatta).toHaveAttribute('href', /^mailto:.+\?subject=Abbonamento/);
  await expect(page.getByRole('button')).toHaveCount(0);
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
