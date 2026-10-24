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

test('intestazioni sconosciute: il titolare associa le colonne e importa', async ({ page }) => {
  const id = Date.now().toString(36).toUpperCase().slice(-6);
  const csv = Buffer.from(
    [
      'Cod. Cli.;Nominativo;Cell.;Targa veicolo;Casa;Mod.',
      `M${id};Rossi Mario ${id};333 1112223;M1${id};Fiat;Panda`,
      `M${id};Rossi Mario ${id};333 1112223;M2${id};Fiat;500`,
    ].join('\r\n'),
    'latin1',
  );
  const file = { name: `mappatura-${id}.csv`, mimeType: 'text/csv', buffer: csv };

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti/importa');
  await page.getByLabel(/File CSV/).setInputFiles(file);
  await expect(page.getByRole('heading', { name: 'Associa le colonne' })).toBeFocused();

  // Nessuna di queste intestazioni è riconosciuta da sola: le sceglie il titolare
  await page.getByLabel('Codice cliente', { exact: true }).selectOption('Cod. Cli.');
  await page.getByLabel('Telefono', { exact: true }).selectOption('Cell.');
  await page.getByLabel('Cognome', { exact: true }).selectOption('Nominativo');
  await page.getByLabel('Targa', { exact: true }).selectOption('Targa veicolo');
  await page.getByLabel('Marca', { exact: true }).selectOption('Casa');
  await page.getByLabel('Modello', { exact: true }).selectOption('Mod.');

  // La stessa colonna del file due volte: errore, e si resta qui
  await page.getByLabel('Nome', { exact: true }).selectOption('Nominativo');
  await page.getByRole('button', { name: "Mostra l'anteprima" }).click();
  await expect(page.getByRole('alert')).toContainText(
    '«Nominativo» del file è associata due volte',
  );
  await expect(page.getByRole('heading', { name: 'Associa le colonne' })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).selectOption('');

  await page.getByRole('button', { name: "Mostra l'anteprima" }).click();
  await expect(page.getByRole('heading', { name: `Anteprima di «${file.name}»` })).toBeFocused();
  await expect(page.getByText('2 righe lette: 2 pronte da importare.')).toBeVisible();
  const riepilogo = page.locator('.tc-riepilogo--import');
  await expect(riepilogo).toContainText(/1\s*Clienti nuovi/);
  await expect(riepilogo).toContainText(/2\s*Veicoli nuovi/);

  // "Cambia le colonne" riporta al passo con le scelte già fatte
  await page.getByRole('button', { name: 'Cambia le colonne' }).click();
  await expect(page.getByLabel('Targa', { exact: true })).toHaveValue('Targa veicolo');
  await page.getByRole('button', { name: "Mostra l'anteprima" }).click();

  await page.getByRole('button', { name: 'Importa 2 righe' }).click();
  await expect(
    page.getByText('Import completato: 1 cliente nuovo, 2 veicoli nuovi.'),
  ).toBeVisible();
});

test('il titolare salva l’associazione delle colonne e al file successivo va dritto all’anteprima', async ({
  page,
}) => {
  const id = Date.now().toString(36).toUpperCase().slice(-6);
  const nomeMappatura = `Gestionale <${id}>`;
  // Stesse intestazioni inventate del test sopra, ma righe e targhe diverse
  const nuovoFile = (suffisso: string) => ({
    name: `salvata-${suffisso}-${id}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'Cod. Cli.;Nominativo;Cell.;Targa veicolo;Casa;Mod.',
        `S${id};Bianchi Sara ${id};333 4445556;S1${id};Fiat;Panda`,
      ].join('\r\n'),
      'latin1',
    ),
  });

  // Elimina la mappatura dall'interfaccia, se c'è: serve anche a ripulire in caso di errore
  const elimina = async () => {
    await page.goto('/clienti/importa');
    await page.getByLabel(/File CSV/).setInputFiles(nuovoFile('pulizia'));
    // Con l'associazione salvata si va dritto all'anteprima: si torna al passo delle colonne
    await page
      .getByRole('heading', { name: /^(Associa le colonne|Anteprima di)/ })
      .first()
      .waitFor();
    const cambia = page.getByRole('button', { name: 'Cambia le colonne' });
    if (await cambia.isVisible()) await cambia.click();
    const salvata = page.getByLabel("Usa un'associazione salvata");
    if (await salvata.isVisible().catch(() => false)) {
      await salvata.selectOption({ label: nomeMappatura });
      await page.getByRole('button', { name: 'Elimina', exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: "Elimina l'associazione" })
        .click();
    }
  };

  await accedi(page, 'titolare@tyrecare.test');
  try {
    await page.goto('/clienti/importa');
    const primo = nuovoFile('uno');
    await page.getByLabel(/File CSV/).setInputFiles(primo);
    await expect(page.getByRole('heading', { name: 'Associa le colonne' })).toBeFocused();

    await page.getByLabel('Codice cliente', { exact: true }).selectOption('Cod. Cli.');
    await page.getByLabel('Telefono', { exact: true }).selectOption('Cell.');
    await page.getByLabel('Cognome', { exact: true }).selectOption('Nominativo');
    await page.getByLabel('Targa', { exact: true }).selectOption('Targa veicolo');
    await page.getByLabel('Marca', { exact: true }).selectOption('Casa');
    await page.getByLabel('Modello', { exact: true }).selectOption('Mod.');
    await page.getByLabel('Salva queste scelte come (facoltativo)').fill(nomeMappatura);
    await page.getByRole('button', { name: "Mostra l'anteprima" }).click();
    await expect(page.getByRole('heading', { name: `Anteprima di «${primo.name}»` })).toBeFocused();

    // Un altro file con le stesse intestazioni: l'associazione si applica da sola
    const secondo = nuovoFile('due');
    await page.goto('/clienti/importa');
    await page.getByLabel(/File CSV/).setInputFiles(secondo);
    await expect(
      page.getByRole('heading', { name: `Anteprima di «${secondo.name}»` }),
    ).toBeFocused();
    await expect(page.getByText(`Colonne associate con «${nomeMappatura}».`)).toBeVisible();

    // "Cambia le colonne": si può scegliere l'associazione salvata dall'elenco
    await page.getByRole('button', { name: 'Cambia le colonne' }).click();
    await expect(page.getByLabel("Usa un'associazione salvata")).toBeVisible();
  } finally {
    await elimina();
  }

  // Eliminata: lo stesso file torna a chiedere l'associazione
  await page.goto('/clienti/importa');
  await page.getByLabel(/File CSV/).setInputFiles(nuovoFile('tre'));
  await expect(page.getByRole('heading', { name: 'Associa le colonne' })).toBeFocused();
  await expect(page.getByLabel("Usa un'associazione salvata")).toHaveCount(0);
});

test('il titolare scarica le righe con errori in un CSV da correggere', async ({ page }) => {
  const id = Date.now().toString(36).toUpperCase().slice(-6);
  const csv = Buffer.from(
    [
      'Codice;Nome;Cognome;Telefono;Targa;Marca;Modello;Anno',
      `E${id};Anna;Prova;333 1234567;G${id};Fiat;Panda;2019`,
      `F${id};Luca;Prova;333 1234567;SBAGLIATA${id};Fiat;500;19`,
    ].join('\r\n'),
    'latin1',
  );
  const file = { name: `errori-${id}.csv`, mimeType: 'text/csv', buffer: csv };

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti/importa');
  await page.getByLabel(/File CSV/).setInputFiles(file);
  await expect(page.getByRole('heading', { name: `Anteprima di «${file.name}»` })).toBeFocused();

  // Nessun import confermato: si scarica soltanto il file con la riga sbagliata
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica le righe con errori' }).click();
  const scaricato = await download;
  expect(scaricato.suggestedFilename()).toBe('tyrecare-righe-con-errori.csv');
  const { readFile } = await import('node:fs/promises');
  const testo = await readFile((await scaricato.path())!, 'utf8');
  expect(testo).toContain(`SBAGLIATA${id}`);
  expect(testo).not.toContain(`G${id}`);
  expect(testo.split('\r\n')[0]).toMatch(/;errore$/);
});
