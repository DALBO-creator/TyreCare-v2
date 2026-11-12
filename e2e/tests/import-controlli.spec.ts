import { expect, test } from '@playwright/test';
import { accedi, creaCliente, creaVeicolo, csvControlli, unico } from './aiuti';

// Import dei controlli dal gestionale (T023): anteprima, import, reimport senza doppioni.
// Targa e codici documento unici a ogni esecuzione: non serve `db:reset`.

test('il titolare importa i controlli di un veicolo e reimportarli non li duplica', async ({
  page,
}) => {
  const id = unico();
  const targa = `K${id.slice(-7)}`;

  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Controlli', cognome: `Import${id}` });
  await creaVeicolo(page, clienteId, { targa, marca: 'Fiat', modello: 'Panda' });
  const schedaVeicolo = page.url();

  // 2 documenti (2 ruote ciascuno) in date passate e diverse, con la stessa gomma
  const riga = (doc: string, data: string, km: number, posizione: string, mm: string) => [
    doc,
    targa,
    data,
    String(km),
    posizione,
    mm,
    '2,2',
    'REGOLARE',
    '',
    'ESTIVO',
    '205/55 R16',
    'Pirelli',
    'Cinturato',
    '2321',
    '',
  ];
  const csv = Buffer.from(
    csvControlli([
      riga(`D1${id}`, '15/01/2026', 40000, 'ANT_SX', '5,5'),
      riga(`D1${id}`, '15/01/2026', 40000, 'ANT_DX', '5,4'),
      riga(`D2${id}`, '20/03/2026', 45000, 'ANT_SX', '4,5'),
      riga(`D2${id}`, '20/03/2026', 45000, 'ANT_DX', '4,4'),
    ]),
    'utf8',
  );
  const file = { name: `controlli-${id}.csv`, mimeType: 'text/csv', buffer: csv };

  await page.goto('/clienti/importa-controlli');
  await expect(page.getByRole('heading', { name: 'Importa i controlli', level: 1 })).toBeVisible();
  await page.getByLabel('File CSV o Excel').setInputFiles(file);
  await expect(page.getByRole('heading', { name: `Anteprima di «${file.name}»` })).toBeFocused();
  await expect(page.getByText(/^2 controlli nuovi · 0 già presenti/)).toBeVisible();

  await page.getByRole('button', { name: 'Importa i controlli' }).click();
  await expect(page.getByText(/^Import completato: 2 controlli nuovi/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Torna ai veicoli' })).toBeVisible();

  // I 2 controlli sono nello storico del veicolo
  await page.goto(schedaVeicolo);
  await expect(page.getByRole('heading', { name: 'Storico dei controlli' })).toBeVisible();
  await expect(page.locator('.tc-storico__voce')).toHaveCount(2);

  // Lo stesso file di nuovo: i documenti ci sono già
  await page.goto('/clienti/importa-controlli');
  await page.getByLabel('File CSV o Excel').setInputFiles(file);
  await expect(page.getByText(/^0 controlli nuovi · 2 già presenti/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importa i controlli' })).toHaveCount(0);
});

test('il titolare vede quante gomme già registrate saranno completate col DOT del file', async ({
  page,
}) => {
  const id = unico();
  const targa = `L${id.slice(-7)}`;

  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Completate', cognome: `Import${id}` });
  await creaVeicolo(page, clienteId, { targa, marca: 'Fiat', modello: 'Panda' });

  // Stessa gomma (posizione, marca, misura); il DOT è vuoto nel primo file e pieno nel secondo
  const riga = (doc: string, data: string, dot: string) => [
    doc,
    targa,
    data,
    '40000',
    'ANT_SX',
    '5,5',
    '2,2',
    'REGOLARE',
    '',
    'ESTIVO',
    '205/55 R16',
    'Pirelli',
    'Cinturato',
    dot,
    '',
  ];
  const file = (nome: string, righe: string[][]) => ({
    name: `${nome}-${id}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvControlli(righe), 'utf8'),
  });
  const senzaDot = file('senza-dot', [riga(`C1${id}`, '15/01/2026', '')]);
  const conDot = file('con-dot', [riga(`C2${id}`, '20/03/2026', '2321')]);

  // Primo import: crea la gomma senza DOT, niente da completare
  await page.goto('/clienti/importa-controlli');
  await page.getByLabel('File CSV o Excel').setInputFiles(senzaDot);
  await expect(page.getByText(/^1 controllo nuovo · 0 già presenti/)).toBeVisible();
  await expect(page.locator('[data-completate]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Importa i controlli' }).click();
  await expect(page.getByText(/^Import completato: 1 controllo nuovo/)).toBeVisible();
  await expect(page.locator('[data-completate]')).toHaveCount(0);

  // Secondo file: la gomma già registrata prende il DOT, in anteprima e nell'esito
  await page.goto('/clienti/importa-controlli');
  await page.getByLabel('File CSV o Excel').setInputFiles(conDot);
  await expect(
    page.getByText('1 gomma già registrata sarà completata con i dati del file'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Importa i controlli' }).click();
  await expect(page.getByText(/^Import completato: 1 controllo nuovo/)).toBeVisible();
  await expect(
    page.getByText('1 gomma già registrata è stata completata con i dati del file'),
  ).toBeVisible();
});

test("l'operatore non può importare i controlli", async ({ page }) => {
  await accedi(page, 'operatore@tyrecare.test');
  await page.goto('/clienti/importa-controlli');
  await expect(page.getByText("Solo il titolare dell'officina può importare")).toBeVisible();
});
