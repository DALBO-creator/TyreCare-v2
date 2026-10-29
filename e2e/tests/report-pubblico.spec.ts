import { expect, test } from '@playwright/test';
import { formattaTarga } from '@tyrecare/shared';
import { accedi } from './aiuti';

// Report condiviso (T064): l'officina crea il link dal report, chi lo apre senza account vede il report
// e dopo "Disattiva i link" il link non funziona più.

// Controllo della Panda (targa 'AB 123 CD') in `supabase/seed.sql`
const CONTROLLO = '/controllo?id=f0000000-0000-4000-8000-000000000001';
const TARGA = formattaTarga('AB 123 CD');

test('il titolare condivide il report, chi lo apre lo vede e dopo la revoca no', async ({
  page,
  browser,
}) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto(CONTROLLO);
  await page.getByRole('button', { name: 'Condividi il report' }).click();

  const link = await page.getByLabel('Link del report').inputValue();
  expect(link).toMatch(/\/r\?c=[0-9a-f]{32}$/);
  await expect(page.getByText('Il link funziona per 30 giorni.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Invia con WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=/,
  );

  // Senza account: il report si vede, senza i pulsanti dell'officina
  const ospite = await browser.newContext();
  const pagina = await ospite.newPage();
  await pagina.goto(link);
  await expect(pagina.getByText(TARGA).first()).toBeVisible();
  await expect(pagina.getByRole('button', { name: 'Stampa o salva in PDF' })).toBeVisible();
  await expect(pagina.getByRole('link', { name: /Correggi o elimina/ })).toHaveCount(0);
  await expect(pagina.getByRole('button', { name: 'Condividi il report' })).toHaveCount(0);

  // Disattivati i link, lo stesso indirizzo non è più valido
  await page.getByRole('button', { name: 'Disattiva i link' }).click();
  await expect(page.getByText('Link disattivati.')).toBeVisible();
  await pagina.reload();
  await expect(
    pagina.getByText("Link non valido o scaduto. Chiedi all'officina un link nuovo."),
  ).toBeVisible();
  await ospite.close();
});

test('un codice sbagliato mostra il messaggio di link non valido', async ({ page }) => {
  await page.goto('/r?c=00000000000000000000000000000000');
  await expect(
    page.getByText("Link non valido o scaduto. Chiedi all'officina un link nuovo."),
  ).toBeVisible();
});
