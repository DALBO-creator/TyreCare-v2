import { expect, test } from '@playwright/test';
import {
  OFFICINA,
  accedi,
  chiedi,
  entra,
  nuovoAccountCliente,
  prossimoFeriale,
  unico,
} from './aiuti';

// Prenotazioni (Fase 4): il cliente chiede un appuntamento con giorno e fascia, l'officina conferma
// con l'ora, propone un altro orario o rifiuta. Ogni test usa un cliente nuovo (al massimo 3 richieste
// in attesa per officina: con un cliente fisso i test ripetuti si bloccherebbero).

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

test('dal garage "Prenota" apre il modulo con il veicolo già scelto', async ({ page }) => {
  // Giulia (seed): la Panda è da Gomme Rossi (attiva, prenotabile) e da Pneus Express (in attesa)
  await accedi(page, 'cliente@tyrecare.test');
  await page.goto('/garage/veicolo?targa=AB123CD');
  const officine = page.getByRole('region', { name: 'Le tue officine' });
  await expect(officine.getByRole('link', { name: 'Prenota' })).toHaveCount(1);
  await expect(
    officine.getByRole('article').filter({ hasText: 'Pneus Express' }).getByRole('link', {
      name: 'Prenota',
    }),
  ).toHaveCount(0);

  // Il posteriore sinistro è sotto il limite: l'avviso porta anche al modulo
  await expect(page.getByRole('link', { name: 'Prenota la sostituzione' })).toHaveAttribute(
    'href',
    /\/prenota\?officina=.+&targa=AB123CD/,
  );

  await officine.getByRole('link', { name: 'Prenota' }).click();
  await expect(page.getByRole('heading', { name: 'Chiedi un appuntamento' })).toBeVisible();
  await expect(page.getByText(OFFICINA).first()).toBeVisible();
  await expect(page.getByLabel('Targa')).toHaveValue('AB 123 CD');
  await expect(page.getByLabel('Veicolo (facoltativo)')).toHaveValue(/Panda/);

  // "Annulla" torna alla scheda del garage
  await page.getByRole('link', { name: 'Annulla' }).click();
  await expect(page).toHaveURL(/\/garage\/veicolo\?targa=AB123CD/);
});

test("l'officina aggiunge cliente e veicolo dalla richiesta; il cliente lo trova nel garage", async ({
  page,
  browser,
}) => {
  const targa = `R${unico().slice(-7)}`;
  const cliente = await entra(browser, await nuovoAccountCliente('Sara'));
  const indirizzo = await chiedi(cliente, {
    targa,
    giorno: prossimoFeriale(),
    fascia: 'Mattina',
    veicolo: 'Alfa Romeo Giulietta',
  });

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto(indirizzo);
  await expect(page.getByText('non è ancora tra i tuoi clienti')).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi cliente e veicolo' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page).toHaveURL(/\/veicolo\?id=/);
  await expect(page.getByText('Cliente e veicolo aggiunti.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Giulietta' })).toBeVisible();

  // Ora la richiesta porta alla scheda del veicolo
  await page.goto(indirizzo);
  await expect(page.getByRole('link', { name: /Apri la scheda del veicolo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aggiungi/ })).toHaveCount(0);

  // Il cliente vede il veicolo nel suo garage, senza invito
  await cliente.goto('/');
  await expect(cliente.getByRole('link', { name: /Giulietta/ })).toBeVisible();
});
