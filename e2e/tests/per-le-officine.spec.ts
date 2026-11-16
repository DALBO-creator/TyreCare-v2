import { expect, test } from '@playwright/test';
import { PIANI, prezzoPiano } from '@tyrecare/shared';
import { PASSWORD, nuovoAccountCliente } from './aiuti';

const DOPO = '/officina/registra';

test('senza accesso la pagina per le officine mostra titolo, pulsante e link di accesso', async ({
  page,
}) => {
  await page.goto('/per-le-officine');
  await expect(
    page.getByRole('heading', { level: 1, name: 'TyreCare per le officine' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Come si inizia' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registra la tua officina' })).toHaveAttribute(
    'href',
    `/registrati?dopo=${DOPO}`,
  );
  await expect(page.getByRole('link', { name: 'Accedi', exact: true })).toHaveAttribute(
    'href',
    `/accedi?dopo=${DOPO}`,
  );
  await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  await expect(page.getByRole('link', { name: 'Termini di servizio' })).toHaveAttribute(
    'href',
    '/termini',
  );
});

test("dopo l'accesso con ?dopo=/officina/registra si arriva al modulo di registrazione", async ({
  page,
}) => {
  const email = await nuovoAccountCliente('Gommista');
  await page.goto(`/accedi?dopo=${DOPO}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page).toHaveURL(/\/officina\/registra/);
  await expect(page.getByRole('heading', { name: 'Registra la tua officina' })).toBeVisible();
  await expect(page.getByLabel('Ragione sociale')).toBeVisible();
});

test('da /accedi il link per le officine porta alla pagina', async ({ page }) => {
  await page.goto('/accedi');
  await page
    .getByRole('link', { name: "Sei un'officina? Scopri TyreCare per le officine" })
    .click();
  await expect(page).toHaveURL(/\/per-le-officine$/);
  await expect(page.getByRole('heading', { name: 'TyreCare per le officine' })).toBeVisible();
});

test('la pagina per le officine mostra i prezzi, la prova gratuita e l’aiuto su strada', async ({
  page,
}) => {
  await page.goto('/per-le-officine');
  await expect(page.getByRole('heading', { level: 2, name: 'Prezzi' })).toBeVisible();
  for (const piano of ['MENSILE', 'ANNUALE'] as const) {
    await expect(page.getByRole('heading', { level: 3, name: PIANI[piano].nome })).toBeVisible();
    await expect(page.getByText(prezzoPiano(piano), { exact: true })).toBeVisible();
  }
  await expect(page.getByText('30 giorni di prova gratuita, senza impegno.')).toBeVisible();
  await expect(page.getByText(/Installazione e avvio: 149 € una tantum/)).toBeVisible();
  await expect(page.getByText('Aiuto su strada', { exact: true })).toBeVisible();
});
