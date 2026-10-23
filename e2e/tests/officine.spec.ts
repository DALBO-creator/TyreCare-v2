import { expect, test, type Browser, type Page } from '@playwright/test';
import { OFFICINA, accedi, nuovoAccountCliente } from './aiuti';

// Elenco officine per il cliente: "Vicino a me" ordina per distanza. Nel seed c'è una sola officina
// ATTIVA (Gomme Rossi, a Torino, con coordinate): l'ordinamento vero è provato con Vitest
// (`packages/shared/src/distanza.test.ts`); qui si verifica il flusso nel browser.

/** Un cliente nuovo, in un contesto con (o senza) il permesso di posizione. */
async function clienteInContesto(
  browser: Browser,
  opzioni: Parameters<Browser['newContext']>[0],
): Promise<Page> {
  const page = await (await browser.newContext(opzioni)).newPage();
  await accedi(page, await nuovoAccountCliente('Piero'));
  return page;
}

test('"Vicino a me" mostra la distanza nella scheda dell\'officina', async ({ browser }) => {
  // Poco a nord-est del centro di Torino (Gomme Rossi è in Via Roma 10)
  const page = await clienteInContesto(browser, {
    geolocation: { latitude: 45.08, longitude: 7.7 },
    permissions: ['geolocation'],
  });
  await page.goto('/officine');
  const scheda = page.getByRole('link', { name: new RegExp(OFFICINA) });
  await expect(scheda).toBeVisible();
  await expect(scheda).not.toContainText(/da te/);

  await page.getByRole('button', { name: 'Vicino a me' }).click();
  await expect(scheda).toContainText(/\d(,\d)? ?k?m da te/);
  await expect(page.getByRole('button', { name: 'Vicino a me' })).toBeEnabled();

  // La ricerca per testo continua a funzionare sull'elenco riordinato
  await page.getByLabel('Cerca per nome o città').fill('zzzz');
  await expect(page.getByText('Nessuna officina per «zzzz»')).toBeVisible();
  await page.getByLabel('Cerca per nome o città').fill('torino');
  await expect(scheda).toBeVisible();
});

test("senza il permesso di posizione compare un avviso e l'elenco resta com'era", async ({
  browser,
}) => {
  // Nessun `permissions`: il browser di prova nega la posizione
  const page = await clienteInContesto(browser, {});
  await page.goto('/officine');
  const scheda = page.getByRole('link', { name: new RegExp(OFFICINA) });
  await expect(scheda).toBeVisible();

  await page.getByRole('button', { name: 'Vicino a me' }).click();
  await expect(
    page.getByText(
      'Non riusciamo a sapere dove sei: controlla i permessi di posizione del browser.',
    ),
  ).toBeVisible();
  await expect(scheda).toBeVisible();
  await expect(scheda).not.toContainText(/da te/);
  await expect(page.getByRole('button', { name: 'Vicino a me' })).toBeEnabled();
});
