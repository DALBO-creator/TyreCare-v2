import { expect, test } from '@playwright/test';
import { accedi, emailNuova, unico } from './aiuti';

// "Nuovo cliente" con la casella "Invitalo nell'app": dopo il salvataggio si arriva alla pagina
// dell'invito con l'email già scritta; senza la casella si arriva alla scheda come sempre.

test('spuntando "Invitalo nell\'app" si arriva alla pagina dell\'invito', async ({ page }) => {
  const email = emailNuova();
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti/nuovo?da=clienti');
  await page.getByLabel('Nome', { exact: true }).fill(`Invitato${unico()}`);
  await page.getByLabel('Cognome', { exact: true }).fill('Prova');
  await page.getByLabel('Email (facoltativa)').fill(email);
  await page.getByLabel("Invitalo nell'app dopo il salvataggio").check();
  await page.getByRole('button', { name: 'Salva cliente' }).click();

  await expect(page).toHaveURL(/\/cliente\/invito\?id=/);
  await expect(page.getByLabel('Email del cliente')).toHaveValue(email);
});

test('senza la casella si arriva alla scheda del cliente', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/clienti/nuovo?da=clienti');
  await page.getByLabel('Nome', { exact: true }).fill(`Semplice${unico()}`);
  await page.getByLabel('Cognome', { exact: true }).fill('Prova');
  await page.getByRole('button', { name: 'Salva cliente' }).click();
  await expect(page).toHaveURL(/\/cliente\?id=/);
});
