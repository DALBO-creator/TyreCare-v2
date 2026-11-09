import { expect, test } from '@playwright/test';
import { entra } from './aiuti';

test('l’amministratore vede che il database ha tutte le migrazioni dell’app', async ({
  browser,
}) => {
  const admin = await entra(browser, 'admin@tyrecare.test');
  await admin.goto('/admin/officine');
  // In CI database e build coincidono: l'ultima migrazione è la stessa
  await expect(admin.getByText('Database aggiornato', { exact: false })).toBeVisible();
  await expect(admin.getByText("Versione dell'app:", { exact: false })).toBeVisible();
});
