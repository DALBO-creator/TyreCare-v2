import { expect, test } from '@playwright/test';
import { entra } from './aiuti';

test('l’amministratore vede l’andamento del pilota; il cliente no', async ({ browser }) => {
  test.setTimeout(180_000);

  // L'amministratore lo trova dal Profilo, sotto «Errori dell'app»
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/profilo');
  await admin.getByRole('link', { name: 'Andamento del pilota' }).click();
  await expect(admin).toHaveURL(/\/admin\/andamento/);
  await expect(
    admin.getByRole('heading', { name: 'Andamento del pilota', level: 1 }),
  ).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Gomme Rossi' })).toBeVisible();
  await expect(admin.getByLabel('Periodo')).toHaveValue('questa');
  await expect(admin.getByRole('button', { name: 'Copia i numeri' })).toBeVisible();

  // Cambiando periodo la carta resta (i numeri si ricaricano)
  await admin.getByLabel('Periodo').selectOption('30giorni');
  await expect(admin.getByRole('heading', { name: 'Gomme Rossi' })).toBeVisible();

  // Il cliente vede il messaggio riservato, non i numeri
  const cliente = await entra(browser, 'cliente@tyrecare.test');
  await cliente.goto('/admin/andamento');
  await expect(cliente.getByText("Pagina riservata all'amministratore.")).toBeVisible();
  await expect(cliente.getByRole('heading', { name: 'Gomme Rossi' })).toHaveCount(0);
});
