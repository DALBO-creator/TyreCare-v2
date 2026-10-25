import { expect, test } from '@playwright/test';
import { accedi, nuovoAccountCliente, PASSWORD } from './aiuti';

// Il cliente elimina il proprio account dal Profilo: torna all'accesso e non può più entrare.

test('il cliente elimina il suo account e non può più accedere', async ({ page }) => {
  const email = await nuovoAccountCliente();
  await accedi(page, email);

  await page.goto('/profilo');
  await page.getByRole('link', { name: 'Elimina il tuo account' }).click();
  await expect(page.getByRole('heading', { name: 'Elimina il tuo account' })).toBeVisible();
  await page.getByRole('button', { name: 'Elimina il mio account' }).click();
  await page.getByRole('button', { name: 'Sì, elimina' }).click();

  await expect(page).toHaveURL(/\/accedi/);
  await expect(page.getByText('Il tuo account è stato eliminato.')).toBeVisible();

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Email o password non corrette.')).toBeVisible();
});
