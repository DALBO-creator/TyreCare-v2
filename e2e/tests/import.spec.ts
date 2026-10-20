import { expect, test } from '@playwright/test';
import * as XLSX from '@e965/xlsx';
import { accedi } from './aiuti';

// Import di clienti e veicoli dal CSV standard (P8): anteprima con errori, import, reimport senza
// doppioni. Codici e targhe unici a ogni esecuzione: non serve `db:reset`.

test('il titolare importa un CSV di Excel e reimportarlo non cambia nulla', async ({ page }) => {
  const id = Date.now().toString(36).toUpperCase().slice(-6);
  const nome = `Niccolò${id}`;
  // CSV come lo salva Excel in italiano: punto e virgola e codifica Windows-1252 (la "ò")
  const csv = Buffer.from(
    [
      'Codice;Nome;Cognome;Telefono;Targa;Marca;Modello;Anno',
      `I${id};${nome};Prova;333 1234567;A${id};Fiat;Panda;2019`,
      `I${id};${nome};Prova;333 1234567;B${id};Fiat;500;2021`,
      `;;;;C${id};Fiat;Tipo;19`,
    ].join('\r\n'),
    'latin1',
  );
  const file = { name: `gestionale-${id}.csv`, mimeType: 'text/csv', buffer: csv };

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti');
  await page.getByRole('link', { name: 'Importa dal gestionale' }).click();
  await expect(page.getByRole('heading', { name: 'Importa clienti e veicoli' })).toBeVisible();

  // Anteprima: la simulazione conta nuovi e aggiornati; la riga con l'anno sbagliato è saltata
  await page.getByLabel(/File CSV/).setInputFiles(file);
  await expect(page.getByRole('heading', { name: `Anteprima di «${file.name}»` })).toBeFocused();
  await expect(page.getByText('3 righe lette: 2 pronte da importare, 1 con errori.')).toBeVisible();
  const riepilogo = page.locator('.tc-riepilogo--import');
  await expect(riepilogo).toContainText(/1\s*Clienti nuovi/);
  await expect(riepilogo).toContainText(/2\s*Veicoli nuovi/);
  await expect(page.getByRole('list', { name: 'Righe con errori' })).toContainText(
    /Riga 4\s*Controlla l'anno/,
  );

  await page.getByRole('button', { name: 'Importa 2 righe' }).click();
  await expect(
    page.getByText('Import completato: 1 cliente nuovo, 2 veicoli nuovi.'),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Import precedenti' })).toContainText(file.name);

  // Lo stesso file di nuovo: le righe valide ci sono già, resta solo quella sbagliata da correggere
  await page.getByLabel(/File CSV/).setInputFiles(file);
  await expect(
    page.getByText(
      'Niente da importare: le righe valide sono già in TyreCare. La riga con errori non è stata importata',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Importa/ })).toHaveCount(0);

  // Il cliente importato, con l'accento giusto e i suoi due veicoli
  await page.goto('/clienti');
  await page.getByLabel('Cerca per nome, telefono, email o targa').fill(nome);
  await expect(page.getByRole('link', { name: new RegExp(`Prova ${nome}`) })).toContainText(
    `A${id}, B${id}`,
  );
});

test("l'operatore non vede l'import", async ({ page }) => {
  await accedi(page, 'operatore@tyrecare.test');
  await page.goto('/clienti');
  await expect(page.getByRole('heading', { name: 'Clienti', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Importa dal gestionale' })).toHaveCount(0);
  await page.goto('/clienti/importa');
  await expect(page.getByText("Solo il titolare dell'officina può importare")).toBeVisible();
});

test('il titolare importa un file Excel .xlsx', async ({ page }) => {
  const id = Date.now().toString(36).toUpperCase().slice(-6);
  const nome = `Zaccarìa${id}`;
  const foglio = XLSX.utils.aoa_to_sheet([
    ['codice_cliente', 'nome', 'cognome', 'telefono', 'targa', 'marca', 'modello', 'anno'],
    [`X${id}`, nome, 'Excel', '333 7654321', `E${id}`, 'Fiat', 'Panda', 2020],
    [`X${id}`, nome, 'Excel', '333 7654321', `F${id}`, 'Fiat', '500', 2022],
  ]);
  const cartella = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(cartella, foglio, 'Clienti');
  const file = {
    name: `gestionale-${id}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(XLSX.write(cartella, { bookType: 'xlsx', type: 'buffer' }) as Buffer),
  };

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti/importa');
  await page.getByLabel(/File CSV/).setInputFiles(file);
  await expect(page.getByRole('heading', { name: `Anteprima di «${file.name}»` })).toBeFocused();
  await expect(page.getByText('2 righe lette: 2 pronte da importare.')).toBeVisible();
  const riepilogo = page.locator('.tc-riepilogo--import');
  await expect(riepilogo).toContainText(/1\s*Clienti nuovi/);
  await expect(riepilogo).toContainText(/2\s*Veicoli nuovi/);

  await page.getByRole('button', { name: 'Importa 2 righe' }).click();
  await expect(
    page.getByText('Import completato: 1 cliente nuovo, 2 veicoli nuovi.'),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Import precedenti' })).toContainText(file.name);
});
