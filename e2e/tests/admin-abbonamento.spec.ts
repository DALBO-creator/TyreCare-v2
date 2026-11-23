import { expect, test } from '@playwright/test';
import { ADMIN, accedi, entra, nuovoAccountCliente, partitaIvaUnica, unico } from './aiuti';

test('l’amministratore registra un pagamento: rinnovo, installazione e note interne', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  // Un'officina nuova (in attesa): i dati del seed restano come li aspettano gli altri test
  const ragioneSociale = `Gomme Abbonamento ${unico()}`;
  await accedi(page, await nuovoAccountCliente('Ada'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  const admin = await entra(browser, ADMIN);
  await admin.goto('/admin/officine');
  const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await riga.getByRole('link', { name: `Abbonamento di ${ragioneSociale}` }).click();
  await expect(admin).toHaveURL(/\/admin\/abbonamento\?id=/);
  await expect(admin.getByRole('heading', { name: 'Abbonamento', level: 1 })).toBeVisible();

  // Rinnovo di un mese: diventa «Attivo» con una scadenza
  await admin.getByRole('button', { name: 'Rinnova di un mese' }).click();
  await admin.getByRole('button', { name: 'Sì, rinnova' }).click();
  await expect(admin.getByText(/Abbonamento rinnovato fino al/)).toBeVisible();
  await expect(admin.locator('[data-stato]')).toHaveText('Attivo');
  await expect(admin.locator('[data-scadenza]')).toBeVisible();

  // Installazione: si segna e si toglie
  await admin.getByRole('button', { name: 'Installazione pagata' }).click();
  await expect(admin.getByText('Installazione segnata come pagata.')).toBeVisible();
  await admin.getByRole('button', { name: 'Installazione non pagata' }).click();
  await expect(admin.getByText('Installazione segnata come da pagare.')).toBeVisible();

  // Modulo: importo concordato e note, che restano dopo il salvataggio
  await admin.getByLabel(/Importo concordato/).fill('90,00');
  await admin.getByLabel('Note interne').fill('Bonifico del 16/11, e2e');
  await admin.getByRole('button', { name: 'Salva l’abbonamento' }).click();
  await expect(admin.getByText('Abbonamento salvato.')).toBeVisible();
  await expect(admin.getByLabel('Note interne')).toHaveValue('Bonifico del 16/11, e2e');
  await expect(admin.getByText('Mensile · 90 €/mese')).toBeVisible();

  // Un errore del modulo resta sotto il campo
  await admin.getByLabel('Scadenza (ultimo giorno pagato)').fill('');
  await admin.getByRole('button', { name: 'Salva l’abbonamento' }).click();
  await expect(
    admin.getByText('Un abbonamento attivo ha bisogno della data di scadenza'),
  ).toBeVisible();
});
