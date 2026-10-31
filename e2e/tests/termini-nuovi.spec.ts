import { expect, test } from '@playwright/test';
import { accedi, nuovoAccountCliente } from './aiuti';

// Chi aveva accettato una versione precedente dei termini li riaccetta al primo accesso.

const TITOLO = 'Abbiamo aggiornato informativa e termini';

test('chi aveva accettato termini vecchi li riaccetta una sola volta', async ({ page }) => {
  const email = await nuovoAccountCliente('Cliente', { termini_versione: '2020-01-vecchia' });
  await accedi(page, email);

  await expect(page.getByRole('heading', { name: TITOLO })).toBeVisible();
  const accetto = page.getByRole('button', { name: 'Accetto e continuo' });
  await expect(accetto).toBeDisabled();

  await page.getByRole('checkbox').check();
  await expect(accetto).toBeEnabled();
  await accetto.click();
  await expect(page.getByRole('heading', { name: /^Ciao/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /^Ciao/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: TITOLO })).toHaveCount(0);
});

test('chi non ha una versione registrata vede subito la home', async ({ page }) => {
  const email = await nuovoAccountCliente();
  await accedi(page, email);

  await expect(page.getByRole('heading', { name: /^Ciao/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: TITOLO })).toHaveCount(0);
});
