import { expect, test } from '@playwright/test';
import { accedi, entra, unico } from './aiuti';

test('l’amministratore legge gli errori dell’app; il titolare no', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const messaggio = `Errore di prova ${unico()}`;

  // Un cliente, su una pagina già disegnata, provoca un errore non gestito: l'app lo segnala da sola
  await accedi(page, 'cliente@tyrecare.test');
  await page.goto('/profilo');
  await expect(page.getByRole('link', { name: 'Modifica i tuoi dati' })).toBeVisible();
  await page.evaluate((m) => {
    setTimeout(() => {
      throw new Error(m);
    });
  }, messaggio);

  // L'amministratore lo trova dal Profilo (l'invio è asincrono: si ricarica finché compare)
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/profilo');
  await admin.getByRole('link', { name: "Errori dell'app" }).click();
  await expect(admin).toHaveURL(/\/admin\/errori/);
  await expect(admin.getByRole('heading', { name: "Errori dell'app" })).toBeVisible();
  await expect(async () => {
    await admin.reload();
    await expect(admin.getByText(messaggio)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await admin.getByText(messaggio).click();
  await expect(admin.getByText(/utente [0-9a-f]{8}/).first()).toBeVisible();

  // Il titolare vede il messaggio riservato, non gli errori
  const titolare = await entra(browser, 'titolare@tyrecare.test');
  await titolare.goto('/admin/errori');
  await expect(titolare.getByText("Pagina riservata all'amministratore.")).toBeVisible();
  await expect(titolare.getByText(messaggio)).toHaveCount(0);
});
