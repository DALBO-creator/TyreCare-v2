import { expect, test, type Browser, type Page } from '@playwright/test';
import { OFFICINA, accedi, nuovoAccountCliente, prossimoFeriale, unico } from './aiuti';

// Prenotazioni (Fase 4): il cliente chiede un appuntamento con giorno e fascia, l'officina conferma
// con l'ora, propone un altro orario o rifiuta. Ogni test usa un cliente nuovo (al massimo 3 richieste
// in attesa per officina: con un cliente fisso i test ripetuti si bloccherebbero).

const SERVIZIO = 'Cambio gomme stagionale';

/** Un browser separato, già entrato con l'account indicato. */
async function entra(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await accedi(page, email);
  return page;
}

/** Il cliente chiede un appuntamento a Gomme Rossi; restituisce l'indirizzo della prenotazione. */
async function chiedi(
  page: Page,
  { targa, giorno, fascia }: { targa: string; giorno: string; fascia: 'Mattina' | 'Pomeriggio' },
): Promise<string> {
  await page.goto('/officine');
  await page.getByRole('link', { name: new RegExp(OFFICINA) }).click();
  await page.getByRole('link', { name: 'Chiedi un appuntamento' }).click();
  await page.getByLabel('Servizio').selectOption({ label: SERVIZIO });
  await page.getByLabel('Targa').fill(targa);
  await page.getByLabel('Giorno').fill(giorno);
  await page.getByLabel(fascia).check();
  await page.getByLabel('Il tuo telefono').fill('340 1234567');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page).toHaveURL(/\/appuntamento\?id=/);
  await expect(page.getByText(`Richiesta inviata a ${OFFICINA}`)).toBeVisible();
  await expect(page.getByText('In attesa di risposta')).toBeVisible();
  return new URL(page.url()).pathname + new URL(page.url()).search;
}

test("richiesta, conferma con l'ora e annullamento del cliente", async ({ page, browser }) => {
  const targa = `P${unico().slice(-7)}`;
  const giorno = prossimoFeriale();
  const cliente = await entra(browser, await nuovoAccountCliente('Laura'));
  const indirizzo = await chiedi(cliente, { targa, giorno, fascia: 'Mattina' });

  // Officina: la richiesta è tra quelle da confermare
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/appuntamenti');
  const daConfermare = page.getByRole('region', { name: 'Da confermare' });
  await daConfermare.getByRole('link', { name: new RegExp(targa.slice(-5)) }).click();
  await page.getByLabel(/^Ora/).fill('09:30');
  await page.getByLabel('Messaggio per il cliente (facoltativo)').fill('Ti aspettiamo');
  await page.getByRole('button', { name: 'Conferma appuntamento' }).click();
  await expect(page.getByText('Appuntamento confermato.')).toBeVisible();
  await expect(page.getByText('Confermato', { exact: true })).toBeVisible();

  // Nel calendario dell'officina: il giorno chiesto, di mattina, alle 9:30
  await page.goto(`/appuntamenti/calendario?giorno=${giorno}`);
  const mattina = page.getByRole('region', { name: 'Mattina' });
  await expect(
    mattina.getByRole('link', { name: new RegExp(`9:30.*${targa.slice(-5)}`) }),
  ).toBeVisible();

  // Cliente: vede l'ora e il messaggio, poi annulla
  await cliente.goto(indirizzo);
  await expect(cliente.getByRole('heading', { name: /ore 9:30/ })).toBeVisible();
  await expect(cliente.getByText('Ti aspettiamo')).toBeVisible();
  await cliente.getByRole('button', { name: "Annulla l'appuntamento" }).click();
  await cliente.getByRole('dialog').getByRole('button', { name: 'Sì, annulla' }).click();
  await expect(cliente.getByText('Appuntamento annullato.')).toBeVisible();
  await expect(cliente.getByText('Annullato', { exact: true })).toBeVisible();
});

test("l'officina propone un altro orario e il cliente accetta", async ({ page, browser }) => {
  const targa = `P${unico().slice(-7)}`;
  const cliente = await entra(browser, await nuovoAccountCliente('Marta'));
  const indirizzo = await chiedi(cliente, { targa, giorno: prossimoFeriale(), fascia: 'Mattina' });

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto(indirizzo);
  await page.getByRole('link', { name: 'Proponi un altro orario' }).click();
  await page.getByLabel('Giorno').fill(prossimoFeriale(1));
  await page.getByLabel('Ora').fill('15:00');
  await page.getByRole('button', { name: 'Invia la proposta' }).click();
  await expect(page.getByText('Proposta inviata al cliente.')).toBeVisible();
  await expect(page.getByText('In attesa del cliente')).toBeVisible();

  await cliente.goto(indirizzo);
  await expect(cliente.getByText('Nuovo orario proposto')).toBeVisible();
  await cliente.getByRole('button', { name: 'Accetta il nuovo orario' }).click();
  await expect(cliente.getByText('Appuntamento confermato.')).toBeVisible();
  await expect(cliente.getByRole('heading', { name: /ore 15:00/ })).toBeVisible();
});

test("l'officina rifiuta la richiesta con un messaggio", async ({ page, browser }) => {
  const targa = `P${unico().slice(-7)}`;
  const cliente = await entra(browser, await nuovoAccountCliente('Nina'));
  const indirizzo = await chiedi(cliente, {
    targa,
    giorno: prossimoFeriale(),
    fascia: 'Pomeriggio',
  });

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto(indirizzo);
  await page.getByRole('link', { name: 'Rifiuta la richiesta' }).click();
  await page
    .getByLabel('Motivo per il cliente (facoltativo)')
    .fill('Quel giorno siamo al completo');
  await page.getByRole('button', { name: 'Rifiuta la richiesta' }).click();
  await expect(page.getByText('Richiesta rifiutata.')).toBeVisible();

  await cliente.goto(indirizzo);
  await expect(cliente.getByText('Non accettato')).toBeVisible();
  await expect(cliente.getByText('Quel giorno siamo al completo')).toBeVisible();
});

test('il titolare gestisce il catalogo; il cliente vede solo i servizi prenotabili', async ({
  page,
  browser,
}) => {
  const nome = `Servizio ${unico()}`;
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/servizi');
  await page.getByRole('link', { name: 'Nuovo servizio' }).click();
  await page.getByLabel('Nome del servizio').fill(nome);
  await page.getByLabel('Prezzo da (facoltativo)').fill('39,90');
  await page.getByRole('button', { name: 'Salva servizio' }).click();
  await expect(page.getByText('Servizio salvato.')).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`${nome}.*da 39,90 €`) })).toBeVisible();

  const cliente = await entra(browser, 'cliente@tyrecare.test');
  await cliente.goto('/officine');
  await cliente.getByRole('link', { name: new RegExp(OFFICINA) }).click();
  await expect(cliente.getByRole('link', { name: `Prenota ${nome}` })).toBeVisible();
  // "Deposito gomme" del seed non è prenotabile
  await expect(cliente.getByText('Deposito gomme')).toHaveCount(0);

  // Non più prenotabile → sparisce per il cliente; poi si elimina
  await page.getByRole('link', { name: new RegExp(nome) }).click();
  await page.getByLabel("Prenotabile dall'app").uncheck();
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText('Servizio aggiornato.')).toBeVisible();
  await cliente.reload();
  await expect(cliente.getByText(nome)).toHaveCount(0);

  await page.getByRole('link', { name: new RegExp(nome) }).click();
  await page.getByRole('button', { name: 'Elimina servizio' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina servizio' }).click();
  await expect(page.getByText('Servizio eliminato.')).toBeVisible();
  await expect(page.getByText(nome)).toHaveCount(0);
});
