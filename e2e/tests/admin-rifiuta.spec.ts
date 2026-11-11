import { expect, test } from '@playwright/test';
import { accedi, entra, nuovoAccountCliente, partitaIvaUnica, unico } from './aiuti';

test('l’amministratore rifiuta una richiesta: la riga sparisce e l’utente riceve l’avviso', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ragioneSociale = `Gomme Rifiuto ${unico()}`;

  // Un account nuovo registra la sua officina dal modulo (resta in attesa)
  await accedi(page, await nuovoAccountCliente('Marta'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  // L'amministratore la trova e la rifiuta
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/admin/officine');
  const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await expect(riga).toBeVisible();
  await riga.getByRole('button', { name: 'Rifiuta la richiesta' }).click();
  const dialogo = admin.getByRole('dialog');
  await expect(
    dialogo.getByText(
      `Rifiuti la richiesta di «${ragioneSociale}»? L’officina verrà cancellata e chi l’ha chiesta riceverà un avviso.`,
    ),
  ).toBeVisible();
  await dialogo.getByRole('button', { name: 'Rifiuta', exact: true }).click();

  // Il focus va al titolo; solo a pagina ridisegnata si controlla che la riga non ci sia più
  await expect(admin.getByRole('heading', { level: 1, name: 'Officine' })).toBeFocused();
  await expect(riga).toHaveCount(0);

  // L'utente (contesto originale) vede l'avviso nelle notifiche
  await page.goto('/notifiche');
  await expect(page.getByText('Richiesta non accettata')).toBeVisible();
  await expect(
    page.getByText(`La richiesta per ${ragioneSociale} non è stata accettata.`),
  ).toBeVisible();
});

test('l’amministratore rifiuta una richiesta con un motivo: l’utente lo legge nell’avviso', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ragioneSociale = `Gomme Motivo ${unico()}`;

  // Un account nuovo registra la sua officina dal modulo (resta in attesa)
  await accedi(page, await nuovoAccountCliente('Marta'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  // L'amministratore la trova e la rifiuta
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/admin/officine');
  const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await expect(riga).toBeVisible();
  await riga.getByRole('button', { name: 'Rifiuta la richiesta' }).click();
  const dialogo = admin.getByRole('dialog');
  await expect(
    dialogo.getByText(
      `Rifiuti la richiesta di «${ragioneSociale}»? L’officina verrà cancellata e chi l’ha chiesta riceverà un avviso.`,
    ),
  ).toBeVisible();
  await dialogo.getByLabel('Motivo (facoltativo)').fill('Partita IVA non valida');
  await dialogo.getByRole('button', { name: 'Rifiuta', exact: true }).click();

  // Il focus va al titolo; solo a pagina ridisegnata si controlla che la riga non ci sia più
  await expect(admin.getByRole('heading', { level: 1, name: 'Officine' })).toBeFocused();
  await expect(riga).toHaveCount(0);

  // L'utente (contesto originale) vede l'avviso nelle notifiche
  await page.goto('/notifiche');
  await expect(page.getByText('Richiesta non accettata')).toBeVisible();
  await expect(
    page.getByText(
      `La richiesta per ${ragioneSociale} non è stata accettata. Motivo: Partita IVA non valida`,
    ),
  ).toBeVisible();
});
