import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// Impaginazione da computer (le officine lavorano soprattutto al PC): barra laterale al posto delle
// barre del telefono, scorciatoia "/" per la ricerca e "Salta al contenuto".
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test('al computer la navigazione è una barra laterale e "/" porta alla ricerca', async ({
  page,
}) => {
  await accedi(page, 'titolare@tyrecare.test');

  const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
  await expect(page.getByRole('group', { name: 'Filtra i veicoli per stato' })).toBeVisible();
  await expect(page.locator('.tc-appbar')).toBeHidden();
  // La barra sta a sinistra, alta quanto la finestra
  const barra = (await nav.boundingBox())!;
  expect(barra.x).toBe(0);
  expect(barra.height).toBeCloseTo(800, 0);
  expect(barra.width).toBeLessThan(300);
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  // Home dell'officina: l'elenco dei veicoli sta a destra del riepilogo, non sotto
  const riepilogo = await page
    .getByRole('group', { name: 'Filtra i veicoli per stato' })
    .boundingBox();
  const ricerca = page.getByLabel('Cerca per targa, cliente o modello');
  const campo = await ricerca.boundingBox();
  expect(campo!.x).toBeGreaterThan(riepilogo!.x + riepilogo!.width);

  // "/" porta nel campo di ricerca senza scriverci la barra
  await page.getByRole('heading', { level: 1 }).click();
  await page.keyboard.press('/');
  await expect(ricerca).toBeFocused();
  await page.keyboard.type('panda');
  await expect(ricerca).toHaveValue('panda');

  // A pagina appena aperta "Salta al contenuto" è il primo elemento raggiungibile con Tab
  await page.goto('/clienti');
  await expect(page.getByRole('heading', { name: 'Clienti', level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  const salta = page.getByRole('link', { name: 'Salta al contenuto' });
  await expect(salta).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL(/\/clienti$/);
});
