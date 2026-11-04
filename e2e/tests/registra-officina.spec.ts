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

test('un cliente registra la sua officina e si ritrova nell’area officina in attesa', async ({
  page,
}) => {
  const email = await nuovoAccountCliente('Giulia');
  await accedi(page, email);

  await page.getByRole('link', { name: "Hai un'officina? Registrala su TyreCare" }).click();
  await expect(page).toHaveURL(/\/officina\/registra/);
  await expect(page.getByRole('heading', { name: 'Registra la tua officina' })).toBeVisible();

  // Una partita IVA con la cifra di controllo sbagliata resta sul modulo
  const partitaIva = partitaIvaUnica();
  await page.getByLabel('Ragione sociale').fill('Gomme di Prova S.r.l.');
  await page
    .getByLabel('Partita IVA')
    .fill(partitaIva.slice(0, 10) + ((+partitaIva[10]! + 1) % 10));
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page.getByText('Partita IVA non valida')).toBeVisible();

  await page.getByLabel('Partita IVA').fill(partitaIva);
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText('Richiesta inviata: intanto puoi preparare la tua officina.'),
  ).toBeVisible();
  await expect(page.getByText('Officina in attesa')).toBeVisible();
});

test('la partita IVA scritta come in fattura (IT e spazi) è accettata e l’amministratore vede le 11 cifre', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ragioneSociale = `Gomme Spazi ${unico()}`;
  const piva = partitaIvaUnica();
  const comeInFattura = 'IT ' + piva.match(/.{1,3}/g)!.join(' ');

  await accedi(page, await nuovoAccountCliente('Sara'));
  await page.goto('/officina/registra');
  await page.getByLabel('Ragione sociale').fill(ragioneSociale);
  await page.getByLabel('Partita IVA').fill(comeInFattura);
  await page.getByLabel('Città').fill('Torino');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText('Richiesta inviata: intanto puoi preparare la tua officina.'),
  ).toBeVisible();
  await expect(page.getByText('Officina in attesa')).toBeVisible();

  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/admin/officine');
  const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
  await expect(riga).toBeVisible();
  await expect(riga).toContainText(`P. IVA ${piva} · Torino`);
  await expect(riga).not.toContainText('P. IVA IT');
});
