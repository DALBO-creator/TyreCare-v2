import { expect, test } from '@playwright/test';
import { accedi, entra, unico } from './aiuti';

test('l’amministratore legge i commenti dei clienti; il titolare no', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const testo = `Commento per l’admin ${unico()}`;

  // Il cliente manda un commento dal Profilo
  await accedi(page, 'cliente@tyrecare.test');
  await page.goto('/profilo');
  await page.getByRole('link', { name: 'Invia un commento su TyreCare' }).click();
  await page.getByLabel('Cosa vuoi dirci?').fill(testo);
  await page.getByRole('button', { name: 'Invia', exact: true }).click();
  await expect(page.getByText('Grazie, abbiamo ricevuto il tuo commento.')).toBeVisible();

  // L'amministratore lo trova dal Profilo
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/profilo');
  await admin.getByRole('link', { name: 'Commenti degli utenti' }).click();
  await expect(admin).toHaveURL(/\/admin\/commenti/);
  await expect(admin.getByRole('heading', { name: 'Commenti degli utenti' })).toBeVisible();
  await expect(admin.locator('.tc-lista__riga').filter({ hasText: testo })).toBeVisible();

  // Il titolare di Gomme Rossi vede il messaggio riservato, non i commenti
  const titolare = await entra(browser, 'titolare@tyrecare.test');
  await titolare.goto('/admin/commenti');
  await expect(titolare.getByText("Pagina riservata all'amministratore.")).toBeVisible();
  await expect(titolare.getByText(testo)).toHaveCount(0);
});
