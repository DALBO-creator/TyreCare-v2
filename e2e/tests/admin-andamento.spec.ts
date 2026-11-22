import { expect, test } from '@playwright/test';
import { entra } from './aiuti';

test('l’amministratore vede l’andamento del pilota; il cliente no', async ({ browser }) => {
  test.setTimeout(180_000);

  // L'amministratore lo trova dal Profilo, sotto «Errori dell'app»
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/profilo');
  await admin.getByRole('link', { name: 'Andamento del pilota' }).click();
  await expect(admin).toHaveURL(/\/admin\/andamento/);
  await expect(
    admin.getByRole('heading', { name: 'Andamento del pilota', level: 1 }),
  ).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Gomme Rossi' })).toBeVisible();
  await expect(admin.getByLabel('Periodo')).toHaveValue('questa');
  await expect(admin.getByRole('button', { name: 'Copia i numeri' })).toBeVisible();

  // Cambiando periodo la carta resta (i numeri si ricaricano)
  await admin.getByLabel('Periodo').selectOption('30giorni');
  await expect(admin.getByRole('heading', { name: 'Gomme Rossi' })).toBeVisible();

  // Il cliente vede il messaggio riservato, non i numeri
  const cliente = await entra(browser, 'cliente@tyrecare.test');
  await cliente.goto('/admin/andamento');
  await expect(cliente.getByText("Pagina riservata all'amministratore.")).toBeVisible();
  await expect(cliente.getByRole('heading', { name: 'Gomme Rossi' })).toHaveCount(0);
});

test('«Copia i numeri» mette negli appunti una riga per officina', async ({ browser }) => {
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await admin.goto('/admin/andamento');
  // Senza la carta le righe sono vuote e comparirebbe «Non ci sono numeri da copiare.»
  await expect(admin.getByRole('heading', { name: 'Gomme Rossi' })).toBeVisible();

  await admin.getByRole('button', { name: 'Copia i numeri' }).click();
  await expect(admin.getByText('Numeri copiati.')).toBeVisible();
  const testo = await admin.evaluate(() => navigator.clipboard.readText());

  // I numeri dipendono dal seed e dagli altri e2e: si prova il formato, non i valori
  const data = '\\d{4}-\\d{2}-\\d{2}';
  const schema = (nome: string, flag = '') =>
    new RegExp(
      `^${nome} \\(dal ${data} al ${data}\\): clienti \\d+, collegati \\d+, con notifiche \\d+; ` +
        'inviti creati \\d+; controlli inseriti \\d+, importati \\d+; ' +
        'richieste di appuntamento \\d+; aiuto su strada \\d+$',
      flag,
    );
  expect(testo).toMatch(schema('Gomme Rossi[^(]*?', 'm'));
  // Una riga per officina: ogni riga del testo ha lo stesso schema
  const righe = testo.split('\n');
  expect(righe.length).toBeGreaterThanOrEqual(1);
  for (const riga of righe) expect(riga).toMatch(schema('.+?'));
});
