import { expect, test } from '@playwright/test';
import { accedi, nuovoAccountCliente, unico } from './aiuti';

// Intervento su strada, lato cliente (R18): il cliente compila il modulo e invia la posizione. Nel seed
// nessuna officina offre il servizio: la richiesta non parte e il cliente lo legge subito. Il flusso
// con un'officina che accetta lo prova strada-officina.spec.ts (T144).

test('senza officine vicine il cliente legge subito che la richiesta non è partita', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = await nuovoAccountCliente('Gino');
  const contesto = await browser.newContext({
    geolocation: { latitude: 0, longitude: 0 },
    permissions: ['geolocation'],
  });
  const page = await contesto.newPage();
  try {
    await accedi(page, email);

    // Dalla home, il link sotto i veicoli
    await page.getByRole('link', { name: 'Gomma a terra? Chiedi aiuto su strada' }).click();
    await expect(page).toHaveURL(/\/strada$/);
    await expect(page.getByRole('heading', { name: 'Aiuto su strada' })).toBeVisible();
    await expect(
      page.getByText(
        "TyreCare inoltra la richiesta alle officine vicine che offrono il servizio: l'intervento lo fa e lo concorda l'officina. In pericolo chiama il 112.",
      ),
    ).toBeVisible();

    await page.getByLabel('Cosa è successo').fill(`Gomma a terra ${unico()}`);
    await page.getByLabel('Telefono', { exact: true }).fill('333 1234567');
    await page.getByRole('button', { name: 'Usa la mia posizione e invia' }).click();

    await expect(
      page.getByText(
        "Nessuna officina vicina offre l'aiuto su strada in questo momento. Chiama un soccorso stradale; in pericolo chiama il 112.",
      ),
    ).toBeVisible();
    // La richiesta non è partita: il modulo resta e non c'è nessuna richiesta in corso
    await expect(page.getByRole('button', { name: 'Usa la mia posizione e invia' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Annulla la richiesta' })).toHaveCount(0);
  } finally {
    await contesto.close();
  }
});

test('senza descrizione il campo è segnalato e non parte nessuna richiesta', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = await nuovoAccountCliente('Gina');
  const contesto = await browser.newContext({
    geolocation: { latitude: 0, longitude: 0 },
    permissions: ['geolocation'],
  });
  const page = await contesto.newPage();
  try {
    await accedi(page, email);
    await page.goto('/strada');
    await page.getByLabel('Telefono', { exact: true }).fill('333 1234567');
    await page.getByRole('button', { name: 'Usa la mia posizione e invia' }).click();

    await expect(page.getByLabel('Cosa è successo')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Scrivi cosa è successo', { exact: true })).toBeVisible();
  } finally {
    await contesto.close();
  }
});
