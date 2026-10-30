import { expect, test } from '@playwright/test';
import { accedi, nuovoAccountCliente, unico } from './aiuti';

/** Partita IVA italiana valida e unica: 10 cifre dall'orologio e dal caso, più la cifra di controllo. */
function partitaIvaUnica(): string {
  const dieci =
    Date.now().toString().slice(-7) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let c = Number(dieci[i]);
    if (i % 2 === 1) c = c * 2 > 9 ? c * 2 - 9 : c * 2;
    somma += c;
  }
  return dieci + String((10 - (somma % 10)) % 10);
}

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

  await page.reload();
  await expect(page.getByText('Officina in attesa')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Primi passi' })).toBeHidden();
});
