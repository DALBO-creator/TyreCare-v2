import { expect, test } from '@playwright/test';
import { accedi, unico } from './aiuti';

// Pilota: chi usa TyreCare manda un commento dal Profilo (la lettura è solo dalla dashboard di Supabase).

test('il cliente invia un commento e vede la conferma', async ({ page }) => {
  await accedi(page, 'cliente@tyrecare.test');
  await page.goto('/profilo');
  await page.getByRole('link', { name: 'Invia un commento su TyreCare' }).click();
  await expect(page.getByRole('heading', { name: 'Invia un commento' })).toBeVisible();

  const campo = page.getByLabel('Cosa vuoi dirci?');
  await campo.fill(`Mi piacerebbe vedere i prezzi ${unico()}`);
  await expect(page.getByText(/^\d+ \/ 2000$/)).not.toHaveText('0 / 2000');
  await page.getByRole('button', { name: 'Invia', exact: true }).click();

  await expect(page).toHaveURL(/\/profilo$/);
  await expect(page.getByText('Grazie, abbiamo ricevuto il tuo commento.')).toBeVisible();
});

test('un testo troppo corto dà errore sul campo', async ({ page }) => {
  await accedi(page, 'cliente@tyrecare.test');
  await page.goto('/commento');
  const campo = page.getByLabel('Cosa vuoi dirci?');
  await campo.fill('ok');
  // Uscendo dal campo l'errore compare subito e sposta il pulsante: lo si tocca solo dopo,
  // altrimenti il tocco cade dove il pulsante era prima e il modulo non viene inviato
  await campo.blur();
  await expect(page.getByText('Scrivi almeno 3 caratteri')).toBeVisible();
  await page.getByRole('button', { name: 'Invia', exact: true }).click();

  // L'invio con il testo sbagliato riporta nel campo
  await expect(campo).toBeFocused();
  await expect(page).toHaveURL(/\/commento$/);
});
