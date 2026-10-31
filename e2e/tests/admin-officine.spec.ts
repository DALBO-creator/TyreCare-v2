import { expect, test } from '@playwright/test';
import { accedi, entra, nuovoAccountCliente, unico } from './aiuti';

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

test('l’amministratore attiva e sospende un’officina; il titolare del seed non può', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ragioneSociale = `Gomme Admin ${unico()}`;

  // Un account nuovo registra la sua officina dal modulo (resta in attesa)
  await accedi(page, await nuovoAccountCliente('Marta'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  // L'amministratore la trova dal Profilo
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/profilo');
  await admin.getByRole('link', { name: /Officine da attivare/ }).click();
  await expect(admin).toHaveURL(/\/admin\/officine/);
  const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await expect(riga).toBeVisible();
  await expect(riga.getByText('In attesa', { exact: true })).toBeVisible();
  await expect(riga.getByText('Titolare: Marta Prova')).toBeVisible();

  // Attiva: prima la conferma, poi il badge cambia
  await riga.getByRole('button', { name: 'Attiva' }).click();
  const dialogo = admin.getByRole('dialog');
  await expect(
    dialogo.getByText(
      `Attivare «${ragioneSociale}»? Diventa visibile ai clienti: fallo dopo la firma del DPA.`,
    ),
  ).toBeVisible();
  await dialogo.getByRole('button', { name: 'Attiva' }).click();
  await expect(riga.getByText('Attiva', { exact: true })).toBeVisible();

  // Sospendi: l'officina resta SOSPESA, così non è visibile agli altri test
  await riga.getByRole('button', { name: 'Sospendi' }).click();
  await expect(
    admin.getByRole('dialog').getByText(`Sospendere «${ragioneSociale}»? Non sarà più visibile`),
  ).toBeVisible();
  await admin.getByRole('dialog').getByRole('button', { name: 'Sospendi' }).click();
  await expect(riga.getByText('Sospesa', { exact: true })).toBeVisible();

  // Il titolare di Gomme Rossi non è amministratore
  const titolare = await entra(browser, 'titolare@tyrecare.test');
  await titolare.goto('/admin/officine');
  await expect(titolare.getByText("Pagina riservata all'amministratore.")).toBeVisible();
});

test('l’amministratore mette un’officina nuova sul piano Officina pilota', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ragioneSociale = `Gomme Piano ${unico()}`;

  await accedi(page, await nuovoAccountCliente('Marta'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/admin/officine');
  const riga = () => admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await expect(riga()).toBeVisible();

  // Parte con il piano di prova (Starter); la metto sul piano pilota e dopo il ricaricamento c'è ancora
  await expect(riga().getByText('Piano: Starter')).toBeVisible();
  await riga().getByLabel('Piano').selectOption({ label: 'Officina pilota' });
  await riga().getByRole('button', { name: 'Salva' }).click();
  await expect(riga().getByText('Piano: Officina pilota')).toBeVisible();
  await admin.reload();
  await expect(riga().getByText('Piano: Officina pilota')).toBeVisible();
  await expect(riga().getByLabel('Piano')).toHaveValue('PILOTA');

  // L'officina resta SOSPESA, così non è visibile agli altri test
  await riga().getByRole('button', { name: 'Attiva' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Attiva' }).click();
  await expect(riga().getByText('Attiva', { exact: true })).toBeVisible();
  await riga().getByRole('button', { name: 'Sospendi' }).click();
  await expect(
    admin.getByRole('dialog').getByText(`Sospendere «${ragioneSociale}»? Non sarà più visibile`),
  ).toBeVisible();
  await admin.getByRole('dialog').getByRole('button', { name: 'Sospendi' }).click();
  await expect(riga().getByText('Sospesa', { exact: true })).toBeVisible();
});
