import { expect, test } from '@playwright/test';
import { accedi, entra, nuovoAccountCliente, partitaIvaUnica, unico } from './aiuti';

test('ingresso di un’officina nuova: richiesta, avviso all’amministratore, attivazione, avviso al titolare', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ragioneSociale = `Gomme Ingresso ${unico()}`;

  // 1. Un utente nuovo registra la sua officina: resta in attesa
  const email = await nuovoAccountCliente('Elena');
  await accedi(page, email);
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText('Richiesta inviata: intanto puoi preparare la tua officina.'),
  ).toBeVisible();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  // 2. L'amministratore trova l'avviso in /notifiche (l'elenco è dal più recente; più officine dei
  //    test hanno lo stesso titolo, quindi si sceglie la riga con la ragione sociale unica)
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/notifiche');
  const avviso = admin.locator('.tc-notifica').filter({ hasText: ragioneSociale });
  await expect(avviso).toBeVisible();
  await expect(avviso).toContainText('Nuova officina da attivare');
  await expect(avviso).toContainText(`${ragioneSociale} (Torino) chiede di usare TyreCare.`);

  // 3. La attiva da /admin/officine
  await admin.goto('/admin/officine');
  const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await expect(riga).toBeVisible();
  await expect(riga.locator('.tc-stato')).toHaveText('In attesa');
  await riga.getByRole('button', { name: 'Attiva' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Attiva' }).click();
  await expect(riga.locator('.tc-stato')).toHaveText('Attiva');

  // 4. Il titolare, rientrato (pagina ricaricata), vede l'avviso e la home dell'officina attiva
  await page.goto('/notifiche');
  const benvenuto = page.locator('.tc-notifica').filter({ hasText: ragioneSociale });
  await expect(benvenuto).toBeVisible();
  await expect(benvenuto).toContainText('La tua officina è attiva');
  await expect(benvenuto).toContainText(
    `${ragioneSociale} ora è visibile ai clienti: puoi caricare i tuoi dati.`,
  );

  await page.goto('/');
  await expect(page.getByText(`Area officina · ${ragioneSociale}`)).toBeVisible();
  await expect(page.getByText('Officina in attesa')).toHaveCount(0);

  // Sospendi: l'officina resta SOSPESA, così non è visibile agli altri test (db condiviso)
  await admin.goto('/admin/officine');
  const rigaAttiva = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await rigaAttiva.getByRole('button', { name: 'Sospendi' }).click();
  await expect(
    admin.getByRole('dialog').getByText(`Sospendere «${ragioneSociale}»? Non sarà più visibile`),
  ).toBeVisible();
  await admin.getByRole('dialog').getByRole('button', { name: 'Sospendi' }).click();
  await expect(rigaAttiva.locator('.tc-stato')).toHaveText('Sospesa');
});
