import { expect, test } from '@playwright/test';
import { accedi, nuovoAccountCliente, partitaIvaUnica, unico } from './aiuti';

test('un’officina nuova vede i "Primi passi" e il titolare può nasconderli', async ({ page }) => {
  test.setTimeout(180_000);

  await accedi(page, await nuovoAccountCliente('Livia'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(`Gomme Primi ${unico()}`);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  // Officina nuova: niente posizione, orari, servizi né clienti
  await expect(page.getByRole('heading', { name: 'Primi passi' })).toBeVisible();
  await expect(page.getByText('0 di 5 fatti')).toBeVisible();

  await page.getByRole('button', { name: 'Nascondi' }).click();
  await expect(page.getByRole('heading', { name: 'Primi passi' })).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

  await page.reload();
  await expect(page.getByText('Officina in attesa')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Primi passi' })).toBeHidden();
});
