import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, emailNuova } from './aiuti';

async function compila(page: Page) {
  await page.goto('/registrati');
  await page.getByLabel('Nome', { exact: true }).fill('Marta');
  await page.getByLabel('Cognome', { exact: true }).fill('Prova');
  await page.getByLabel('Email', { exact: true }).fill(emailNuova());
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
}

test('senza accettare i termini non si registra', async ({ page }) => {
  await compila(page);
  await page.getByRole('button', { name: 'Crea account' }).click();
  const casella = page.getByLabel(/Ho letto l'informativa privacy/);
  await expect(page.getByText("Per creare l'account devi accettare i termini")).toBeVisible();
  await expect(casella).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Controlla la posta' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/registrati/);
});

test('accettando i termini si arriva a "Controlla la posta"', async ({ page }) => {
  await compila(page);
  await page.getByLabel(/Ho letto l'informativa privacy/).check();
  await page.getByRole('button', { name: 'Crea account' }).click();
  await expect(page.getByRole('heading', { name: 'Controlla la posta' })).toBeVisible();
});
