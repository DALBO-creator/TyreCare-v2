import { expect, test } from '@playwright/test';
import { ADMIN, accedi, entra, nuovoAccountCliente } from './aiuti';

test('senza il codice della 2FA l’area amministratore resta chiusa', async ({ page }) => {
  await accedi(page, ADMIN);
  await page.goto('/admin/utenti');
  await expect(page.getByRole('heading', { name: 'Verifica in due passaggi' })).toBeVisible();
  await page.getByLabel('Codice di 6 cifre dell’app').fill('000000');
  await page.getByRole('button', { name: 'Verifica' }).click();
  await expect(page.getByRole('alert')).toContainText('Codice non valido');
  await expect(page.getByRole('heading', { name: 'Account' })).toHaveCount(0);
});

test('l’amministratore corregge un account, lo blocca e ritrova tutto nel registro', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const email = await nuovoAccountCliente('Teo');
  await accedi(page, email);

  const admin = await entra(browser, ADMIN);
  await expect(admin.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();

  await admin.goto(`/admin/utenti?q=${encodeURIComponent(email)}`);
  const riga = admin.locator('[data-utente]');
  await expect(riga).toHaveCount(1);
  await riga.getByText('Correggi i dati').click();
  await riga.getByLabel('Cognome').fill('Corretto');
  await riga.getByRole('button', { name: 'Salva' }).click();
  await expect(admin.locator('[data-utente]')).toContainText('Teo Corretto');

  await admin.locator('[data-utente]').getByRole('button', { name: 'Blocca' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Blocca' }).click();
  await expect(admin.locator('[data-utente] .tc-stato', { hasText: 'Bloccato' })).toBeVisible();

  // Bloccato: non rientra con la password
  const nuova = await (await browser.newContext()).newPage();
  await nuova.goto('/accedi');
  await nuova.getByLabel('Email', { exact: true }).fill(email);
  await nuova.getByLabel('Password', { exact: true }).fill('password123');
  await nuova.getByRole('button', { name: 'Accedi' }).click();
  await expect(nuova).toHaveURL(/\/accedi/);

  await admin.locator('[data-utente]').getByRole('button', { name: 'Sblocca' }).click();
  await expect(
    admin.locator('[data-utente]').getByRole('button', { name: 'Blocca' }),
  ).toBeVisible();

  await admin.goto('/admin/registro');
  await expect(admin.getByText('Account bloccato').first()).toBeVisible();
  await expect(admin.getByText('Account sbloccato').first()).toBeVisible();
  await expect(admin.getByText('cognome: Prova → Corretto').first()).toBeVisible();
});
