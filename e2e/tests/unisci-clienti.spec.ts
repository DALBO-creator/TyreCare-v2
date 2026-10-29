import { expect, test } from '@playwright/test';
import { accedi, creaCliente, creaVeicolo, unico } from './aiuti';

// "Unisci con un altro cliente" (T032): il titolare porta il veicolo di un doppione sulla scheda
// che resta; l'operatore non vede il link.

test('il titolare unisce due clienti e vede il veicolo sulla scheda rimasta', async ({ page }) => {
  const id = unico();
  const targa = `U${id.slice(-7)}`;
  await accedi(page, 'titolare@tyrecare.test');
  const primo = await creaCliente(page, { nome: 'Unisci', cognome: `Primo${id}` });
  const secondo = await creaCliente(page, { nome: 'Unisci', cognome: `Secondo${id}` });
  await creaVeicolo(page, secondo, { targa, marca: 'Fiat', modello: 'Panda' });

  await page.goto(`/cliente?id=${primo}`);
  // Un cognome lungo senza spazi non deve allargare la scheda oltre lo schermo: sul telefono la
  // vista si rimpicciolirebbe e i clic finirebbero su altri elementi. (innerWidth cresce insieme
  // alla pagina rimpicciolita, clientWidth resta la larghezza dello schermo.)
  await expect(page.getByRole('heading', { level: 1, name: `Primo${id} Unisci` })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Unisci con un altro cliente' }).click();
  await expect(page.getByText(`Resta questa scheda: Primo${id} Unisci`)).toBeVisible();
  await page.getByLabel('Cerca per nome, telefono, email o targa').fill(`Secondo${id}`);
  await page.getByRole('button', { name: new RegExp(`Secondo${id}`) }).click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText('Unire i due clienti?')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Unisci' }).click();

  await expect(page).toHaveURL(new RegExp(`/cliente\\?id=${primo}`));
  await expect(page.getByText('Clienti uniti.')).toBeVisible();
  await expect(page.getByText(targa)).toBeVisible();
});

test('l’operatore non vede il link per unire i clienti', async ({ page }) => {
  await accedi(page, 'operatore@tyrecare.test');
  await page.goto('/clienti');
  await page.locator('a[href^="/cliente?id="]').first().click();
  await expect(page.getByRole('link', { name: 'Modifica dati del cliente' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unisci con un altro cliente' })).toHaveCount(0);
});
