import { expect, test } from '@playwright/test';
import { accedi } from './aiuti';

// "Dati dell'officina" (Fase 4): il titolare aggiorna indirizzo, contatti e posizione. Si usa il titolare
// di Pneus Express (titolare2) per non toccare i dati di Gomme Rossi, usata dagli altri test.

test('il titolare cambia il telefono e incolla la posizione', async ({ page }) => {
  const telefono = `+39 011 ${Math.floor(1000000 + Math.random() * 8999999)}`;
  await accedi(page, 'titolare2@tyrecare.test');
  await page.goto('/profilo');
  await page.getByRole('link', { name: "Dati dell'officina" }).click();
  await expect(page.getByText("le cambia l'amministratore")).toBeVisible();

  await page.getByLabel('Telefono').fill(telefono);
  await page.getByLabel('Posizione sulla mappa').fill('45.070312, 7.686856');
  await page.getByRole('button', { name: 'Salva dati' }).click();
  await expect(page.getByText("Dati dell'officina salvati.")).toBeVisible();

  await page.goto('/officina/dati');
  await expect(page.getByLabel('Telefono')).toHaveValue(telefono);
  await expect(page.getByLabel('Posizione sulla mappa')).toHaveValue('45.070312, 7.686856');
});

test('coordinate sbagliate: errore sul campo e nessun salvataggio', async ({ page }) => {
  await accedi(page, 'titolare2@tyrecare.test');
  await page.goto('/officina/dati');
  const posizione = page.getByLabel('Posizione sulla mappa');
  await posizione.fill('45,070312 7,686856');
  await page.getByRole('button', { name: 'Salva dati' }).click();
  await expect(page.getByText('Scrivi i decimali con il punto')).toBeVisible();
  await expect(posizione).toHaveAttribute('aria-invalid', 'true');

  await posizione.fill('95.0, 7.0');
  await page.getByRole('button', { name: 'Salva dati' }).click();
  await expect(page.getByText('Non riesco a leggere la posizione')).toBeVisible();
  await expect(page).toHaveURL(/\/officina\/dati/);
});

test("la scelta dell'aiuto su strada resta se si corregge la posizione (senza salvare)", async ({
  page,
}) => {
  // Titolare di Gomme Rossi: nessun salvataggio, le impostazioni sono condivise con gli altri test
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/dati');
  await expect(page.getByRole('button', { name: 'Salva dati' })).toBeVisible();
  const posizione = page.getByLabel('Posizione sulla mappa');
  const casella = page.getByRole('checkbox', { name: "Offro l'aiuto su strada" });

  await posizione.fill('45.464200, 9.190000');
  await expect(casella).toBeEnabled();
  if (!(await casella.isChecked())) await casella.check();

  await posizione.fill('non è una posizione');
  await expect(casella).toBeDisabled();
  await expect(casella).not.toBeChecked();

  await posizione.fill('45.464200, 9.190000');
  await expect(casella).toBeEnabled();
  await expect(casella).toBeChecked();
});

test('un operatore vede che serve il titolare', async ({ page }) => {
  await accedi(page, 'operatore@tyrecare.test');
  await page.goto('/officina/dati');
  await expect(page.getByText("Solo il titolare dell'officina può modificare")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salva dati' })).toHaveCount(0);
});

test.describe('con la posizione del dispositivo', () => {
  test.use({
    geolocation: { latitude: 45.464211, longitude: 9.191383 },
    permissions: ['geolocation'],
  });

  test('"Usa la posizione attuale" compila il campo', async ({ page }) => {
    await accedi(page, 'titolare2@tyrecare.test');
    await page.goto('/officina/dati');
    await page.getByRole('button', { name: 'Usa la posizione attuale' }).click();
    await expect(page.getByLabel('Posizione sulla mappa')).toHaveValue('45.464211, 9.191383');
    await page.getByRole('button', { name: 'Salva dati' }).click();
    await expect(page.getByText("Dati dell'officina salvati.")).toBeVisible();
  });
});
