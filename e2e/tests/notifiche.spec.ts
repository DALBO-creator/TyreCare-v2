import { expect, test, type Page } from '@playwright/test';
import { accedi, chiedi, entra, nuovoAccountCliente, prossimoFeriale, unico } from './aiuti';

// Notifiche (Fase 5): a ogni cambio di stato di una prenotazione chi deve saperlo riceve una notifica.
// Il contatore nella navigazione si aggiorna in tempo reale (Supabase Realtime), senza ricaricare.

/** Voce "Notifiche" della navigazione (il nome comprende "N notifiche da leggere"). */
const voceNotifiche = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link', {
    name: /^Notifiche/,
  });

// Il testo per il lettore di schermo è nascosto: il browser ci può mettere uno spazio davanti
const DA_LEGGERE = /^Notifiche ?, 1 notifica da leggere$/;

test('richiesta e conferma avvisano officina e cliente', async ({ page, browser }) => {
  const targa = `N${unico().slice(-7)}`;

  // Officina: si parte con tutte le notifiche lette (gli altri test ne lasciano tante)
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/notifiche');
  await expect(page.getByRole('heading', { name: 'Notifiche' })).toBeVisible();
  await page.goto('/appuntamenti');
  await expect(voceNotifiche(page)).toHaveAccessibleName(/^Notifiche$/);

  // La cliente chiede un appuntamento: il titolare lo vede arrivare senza ricaricare la pagina
  const cliente = await entra(browser, await nuovoAccountCliente('Nadia'));
  const indirizzo = await chiedi(cliente, { targa, giorno: prossimoFeriale(), fascia: 'Mattina' });
  await expect(voceNotifiche(page)).toHaveAccessibleName(DA_LEGGERE);

  await voceNotifiche(page).click();
  const nuova = page.getByRole('link', { name: /^Nuova: Nuova richiesta di appuntamento/ });
  await expect(nuova).toHaveCount(1);
  await expect(nuova).toContainText('Nadia Prova · Cambio gomme stagionale');
  // Aperta la pagina, il contatore si azzera
  await expect(voceNotifiche(page)).toHaveAccessibleName(/^Notifiche$/);

  // Dalla notifica all'appuntamento: conferma con l'ora
  await nuova.click();
  await expect(page).toHaveURL(new RegExp(indirizzo.replace('?', '\\?')));
  await page.getByLabel(/^Ora/).fill('10:15');
  await page.getByLabel('Messaggio per il cliente (facoltativo)').fill('Porti il libretto');
  await page.getByRole('button', { name: 'Conferma appuntamento' }).click();
  await expect(page.getByText('Appuntamento confermato.')).toBeVisible();

  // Cliente: la conferma arriva, con l'ora e il messaggio dell'officina
  await expect(voceNotifiche(cliente)).toHaveAccessibleName(DA_LEGGERE);
  await voceNotifiche(cliente).click();
  const conferma = cliente.getByRole('link', { name: /^Nuova: Appuntamento confermato/ });
  await expect(conferma).toContainText('Gomme Rossi S.n.c. ti aspetta');
  await expect(conferma).toContainText('ore 10:15');
  await expect(conferma).toContainText('«Porti il libretto»');
  await conferma.click();
  await expect(cliente.getByRole('heading', { name: /ore 10:15/ })).toBeVisible();
  await expect(voceNotifiche(cliente)).toHaveAccessibleName(/^Notifiche$/);
});

test('aprire un appuntamento segna come lette le sue notifiche', async ({ page, browser }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/notifiche');
  await expect(page.getByRole('heading', { name: 'Notifiche' })).toBeVisible();

  const cliente = await entra(browser, await nuovoAccountCliente('Olga'));
  const indirizzo = await chiedi(cliente, {
    targa: `N${unico().slice(-7)}`,
    giorno: prossimoFeriale(1),
    fascia: 'Pomeriggio',
  });
  await page.goto('/appuntamenti');
  await expect(voceNotifiche(page)).toHaveAccessibleName(DA_LEGGERE);

  // Aperta dall'elenco degli appuntamenti, non dalle notifiche
  await page.goto(indirizzo);
  await expect(page.getByRole('button', { name: 'Conferma appuntamento' })).toBeVisible();
  await expect(voceNotifiche(page)).toHaveAccessibleName(/^Notifiche$/);
});

test('dopo la richiesta la pagina invita ad attivare gli avvisi, una volta sola', async ({
  browser,
}) => {
  const cliente = await entra(browser, await nuovoAccountCliente('Pia'));
  // Nei test il service worker è bloccato e Chromium senza finestra nega le notifiche: si finge un
  // telefono con l'app installata su cui non si è ancora scelto (avvisi spenti, permesso da chiedere)
  await cliente.addInitScript(() => {
    const finto = { pushManager: { getSubscription: () => Promise.resolve(null) } };
    navigator.serviceWorker.getRegistration = () =>
      Promise.resolve(finto as unknown as ServiceWorkerRegistration);
    Object.defineProperty(Notification, 'permission', { get: () => 'default' });
  });
  const indirizzo = await chiedi(cliente, {
    targa: `N${unico().slice(-7)}`,
    giorno: prossimoFeriale(2),
    fascia: 'Mattina',
  });
  const invito = cliente.getByRole('heading', { name: 'Vuoi sapere subito quando risponde?' });
  await expect(invito).toBeVisible();
  await expect(
    cliente.getByRole('button', { name: 'Avvisami su questo dispositivo' }),
  ).toBeVisible();

  // Riaprendo l'appuntamento l'invito non c'è più (resta la pagina Notifiche)
  await cliente.goto(indirizzo);
  await expect(cliente.getByText('In attesa di risposta')).toBeVisible();
  await expect(invito).toHaveCount(0);
});
