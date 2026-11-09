import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// "Scarica i tuoi dati" (portabilità, art. 20 GDPR): il cliente scarica i suoi dati dal Profilo.

test('il cliente scarica i suoi dati dal Profilo', async ({ page }) => {
  await accedi(page, 'cliente@tyrecare.test');
  await page.goto('/profilo');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica i tuoi dati' }).click();
  const scaricato = await download;
  expect(scaricato.suggestedFilename()).toMatch(/^tyrecare-i-miei-dati-\d{4}-\d{2}-\d{2}\.json$/);

  const dati = JSON.parse(await readFile((await scaricato.path())!, 'utf8'));
  expect(dati.versione).toBe(1);
  expect(dati.account.email).toBe('cliente@tyrecare.test');
  expect(JSON.stringify(dati.garage)).toContain('AB123CD');
  expect(Array.isArray(dati.richieste_strada)).toBe(true);
  expect(typeof dati.iscrizioni_push).toBe('number');
});
