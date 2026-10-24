import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { COLONNE_IMPORT } from '@tyrecare/shared';
import { accedi } from './aiuti';

// Esportazione di clienti e veicoli nel formato del modello (DPA §13): il file si reimporta.

test('il titolare scarica clienti e veicoli nel formato del modello', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti/importa');
  await expect(page.getByRole('heading', { name: 'Esporta i dati' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica clienti e veicoli' }).click();
  const scaricato = await download;
  expect(scaricato.suggestedFilename()).toMatch(
    /^tyrecare-clienti-veicoli-\d{4}-\d{2}-\d{2}\.csv$/,
  );

  const testo = (await readFile((await scaricato.path())!, 'utf8')).replace(/^\u{FEFF}/u, '');
  expect(testo.startsWith(COLONNE_IMPORT.join(';'))).toBe(true);
  expect(testo).toContain('AB123CD');
});
