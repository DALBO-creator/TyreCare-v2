import { expect, test } from '@playwright/test';
import { accedi, creaCliente, unico } from './aiuti';

// Filtro "Senza app" dell'elenco clienti (T033): chi non usa ancora l'app si trova con un tocco.

test('il filtro "Senza app" mostra i clienti da invitare e nasconde quelli già collegati', async ({
  page,
}) => {
  const id = unico();
  await accedi(page, 'titolare@tyrecare.test');
  await creaCliente(page, { nome: 'Filtro', cognome: `Senzapp${id}` });

  await page.goto('/clienti');
  const cerca = page.getByLabel('Cerca per nome, telefono, email o targa');
  const filtro = page.getByRole('button', { name: /Senza app/ });
  await filtro.click();
  await expect(filtro).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Tutti', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await cerca.fill(`Senzapp${id}`);
  const riga = page.locator('a[href^="/cliente?id="]', { hasText: `Senzapp${id}` });
  await expect(riga).toBeVisible();
  await expect(riga).toContainText('Non usa l’app');

  // Giulia Verdi è collegata all'app: con il filtro attivo non compare
  await cerca.fill('Giulia');
  await expect(page.getByText('Nessun cliente per «Giulia»')).toBeVisible();
  await expect(page.locator('a[href^="/cliente?id="]', { hasText: 'Verdi' })).toHaveCount(0);

  // Tornando a "Tutti" Giulia riappare
  await page.getByRole('button', { name: 'Tutti', exact: true }).click();
  await expect(page.locator('a[href^="/cliente?id="]', { hasText: 'Verdi' })).toBeVisible();
});
