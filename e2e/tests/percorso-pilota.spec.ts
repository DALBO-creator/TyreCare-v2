import { expect, test } from '@playwright/test';
import {
  OFFICINA,
  PASSWORD,
  accedi,
  emailNuova,
  linkConferma,
  preparaInvito,
  unico,
} from './aiuti';

// Il percorso del pilota con LA SANTI GOMME, in un solo test: il titolare importa clienti e veicoli,
// poi i controlli, invita il cliente; il cliente crea l'account e trova gomme e misure nel garage.

test("dall'import dell'officina al garage del cliente", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const id = unico();
  const cognome = `Pilota${id}`;
  const codice = `P${id}`;
  const targa = `P${id.slice(-7)}`;
  const email = emailNuova();

  // Titolare: import di un cliente con un veicolo (CSV come lo salva Excel in italiano)
  await accedi(page, 'titolare@tyrecare.test');
  const csvClienti = Buffer.from(
    [
      'Codice;Nome;Cognome;Email;Targa;Marca;Modello;Anno',
      `${codice};Luca;${cognome};${email};${targa};Fiat;Panda;2019`,
    ].join('\r\n'),
    'utf8',
  );
  const fileClienti = { name: `clienti-${id}.csv`, mimeType: 'text/csv', buffer: csvClienti };
  await page.goto('/clienti');
  await page.getByRole('link', { name: 'Importa dal gestionale' }).click();
  await expect(page.getByRole('heading', { name: 'Importa clienti e veicoli' })).toBeVisible();
  await page.getByLabel(/File CSV/).setInputFiles(fileClienti);
  await expect(
    page.getByRole('heading', { name: `Anteprima di «${fileClienti.name}»` }),
  ).toBeFocused();
  await page.getByRole('button', { name: /^Importa \d+ righ/ }).click();
  await expect(
    page.getByText(/^Import completato: 1 cliente nuovo, 1 veicolo nuovo/),
  ).toBeVisible();

  // Titolare: import dei controlli di quella targa, 2 documenti con le stesse 4 gomme
  const intestazione = [
    'codice_documento',
    'targa',
    'data',
    'km',
    'posizione',
    'battistrada_mm',
    'pressione_bar',
    'usura',
    'danni',
    'stagione',
    'misura',
    'marca',
    'modello',
    'dot',
    'note',
  ].join(';');
  const riga = (doc: string, data: string, km: number, posizione: string, mm: string) =>
    [doc, targa, data, km, posizione, mm, '2,2', 'REGOLARE', '', 'ESTIVO'].join(';') +
    ';205/55 R16;Pirelli;Cinturato;2321;';
  const posizioni = ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX'];
  const csvControlli = Buffer.from(
    [
      intestazione,
      ...posizioni.map((p) => riga(`D1${id}`, '15/01/2026', 40000, p, '5,0')),
      // Nel secondo controllo l'anteriore sinistra è sotto il limite di legge (1,6 mm)
      ...posizioni.map((p) =>
        riga(`D2${id}`, '20/03/2026', 45000, p, p === 'ANT_SX' ? '2,5' : '4,9'),
      ),
    ].join('\r\n'),
    'utf8',
  );
  const fileControlli = { name: `controlli-${id}.csv`, mimeType: 'text/csv', buffer: csvControlli };
  await page.goto('/clienti/importa-controlli');
  await page.getByLabel('File CSV o Excel').setInputFiles(fileControlli);
  await expect(page.getByText(/^2 controlli nuovi · 0 già presenti/)).toBeVisible();
  await page.getByRole('button', { name: 'Importa i controlli' }).click();
  await expect(page.getByText(/^Import completato: 2 controlli nuovi/)).toBeVisible();

  // Titolare: trova il cliente importato (l'import non restituisce l'id) e prepara l'invito
  await page.goto('/clienti');
  await page.getByLabel('Cerca per nome, telefono, email o targa').fill(cognome);
  await page.getByRole('link', { name: new RegExp(cognome) }).click();
  await expect(page).toHaveURL(/\/cliente\?id=/);
  const clienteId = new URL(page.url()).searchParams.get('id')!;
  const link = await preparaInvito(page, clienteId);

  // Cliente, in un altro browser: crea l'account dal link e collega i veicoli
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(link);
  await expect(
    cliente.getByRole('heading', { name: `${OFFICINA} ti invita su TyreCare` }),
  ).toBeVisible();
  await cliente.getByRole('link', { name: 'Crea account' }).click();
  await expect(cliente.getByLabel('Email', { exact: true })).toHaveValue(email);
  await cliente.getByLabel('Nome', { exact: true }).fill('Luca');
  await cliente.getByLabel('Cognome', { exact: true }).fill(cognome);
  await cliente.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await cliente.getByLabel(/Ho letto l'informativa privacy/).check();
  await cliente.getByRole('button', { name: 'Crea account' }).click();
  await expect(cliente.getByRole('heading', { name: 'Controlla la posta' })).toBeVisible();
  await cliente.goto(await linkConferma(email));
  await expect(cliente).toHaveURL(/\/invito\?codice=/);
  await cliente.getByRole('button', { name: 'Collega i miei veicoli' }).click();
  await expect(cliente).toHaveURL(/\/$/);

  // Garage: il veicolo ha lo stato rosso; dal cruscotto si apre lo pneumatico da 2,5 mm
  const carta = cliente.getByRole('link', { name: /Panda/ });
  await expect(carta).toContainText('Da sostituire');
  await carta.click();
  await expect(cliente).toHaveURL(/\/garage\/veicolo\?targa=/);
  await cliente.getByRole('link', { name: /^Anteriore sinistro: 2,5 mm/ }).click();
  await expect(cliente).toHaveURL(/\/pneumatico\?id=/);

  // Storico: le 2 misure dei 2 controlli importati
  await expect(cliente.getByRole('heading', { name: 'Misure (2)' })).toBeVisible();
  await expect(cliente.locator('.tc-misure__riga')).toHaveCount(2);
  await expect(cliente.locator('.tc-misure__riga').first()).toContainText('2,5 mm');
});
