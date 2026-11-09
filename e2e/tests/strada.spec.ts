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

test('se l’annullo fallisce la pagina mostra ancora la richiesta e il dialogo l’errore', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = await nuovoAccountCliente('Gino');
  const contesto = await browser.newContext();
  const page = await contesto.newPage();
  try {
    await accedi(page, email);
    // Nessuna officina del seed offre il servizio: la richiesta aperta e l'annullo rifiutato sono finti
    const descrizione = `Gomma a terra ${unico()}`;
    const riga = {
      id: '00000000-0000-4000-8000-000000000220',
      stato: 'APERTA',
      descrizione,
      scade_il: new Date(Date.now() + 3600_000).toISOString(),
      accettata_il: null,
      targa: null,
      officina: null,
    };
    let letture = 0;
    await page.route('**/rest/v1/richieste_strada?*', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      letture++;
      const oggetto = (await route.request().headerValue('accept'))?.includes('vnd.pgrst.object');
      return route.fulfill({ json: oggetto ? riga : [riga] });
    });
    await page.route('**/rest/v1/rpc/annulla_richiesta_strada', (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'RICHIESTA_NON_DISPONIBILE', code: 'P0001' },
      }),
    );
    await page.goto('/strada');

    const stato = page.getByRole('heading', { name: "Stiamo cercando un'officina vicina" });
    const annulla = page.getByRole('button', { name: 'Annulla la richiesta' });
    await expect(stato).toBeVisible();
    await expect(page.getByText(descrizione)).toBeVisible();

    await annulla.click();
    const dialogo = page.getByRole('dialog');
    const prima = letture;
    await dialogo.getByRole('button', { name: 'Annulla la richiesta' }).click();
    await expect(
      dialogo.getByText(
        'Questa richiesta non è più disponibile: è già stata chiusa, annullata o è scaduta.',
      ),
    ).toBeVisible();
    // Dopo l'errore la pagina sotto rilegge lo stato (disegna() riparte e riaccende il timer):
    // se smettesse di aggiornarsi nessuna GET nuova partirebbe
    await expect.poll(() => letture, { timeout: 12_000 }).toBeGreaterThan(prima);

    // Chiuso il dialogo, la pagina sotto mostra lo stato vero, non il caricamento
    await dialogo.getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(stato).toBeVisible();
    await expect(page.getByText(descrizione)).toBeVisible();
    await expect(annulla).toBeEnabled();
    // Il vecchio pulsante è stato sostituito dal ridisegno: il focus va sul nuovo, non si perde sul body
    await expect(page.locator('[data-annulla]')).toBeFocused();
  } finally {
    await contesto.close();
  }
});
