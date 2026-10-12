import { expect, test } from '@playwright/test';
import { OFFICINA, accedi, prossimoFeriale, unico } from './aiuti';

// Orari e chiusure straordinarie dell'officina (Fase 4): li cambia il titolare dal Profilo, il cliente
// li ritrova nella scheda dell'officina e nel modulo "Prenota".

test('il titolare corregge un orario sbagliato e salva', async ({ page }) => {
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/profilo');
  await page.getByRole('link', { name: 'Orari e chiusure' }).click();

  const chiude = page.getByLabel('Lunedì, primo turno: chiude');
  await expect(chiude).toHaveValue('12:30');
  await chiude.fill('07:00');
  await page.getByRole('button', { name: 'Salva orari' }).click();
  await expect(page.getByText("Deve venire dopo l'apertura")).toBeVisible();
  await expect(chiude).toBeFocused();

  await chiude.fill('12:30');
  await page.getByRole('button', { name: 'Salva orari' }).click();
  await expect(page.getByText('Orari salvati.')).toBeVisible();
  await expect(page.getByLabel('Lunedì, primo turno: chiude')).toHaveValue('12:30');
});

test('una chiusura straordinaria toglie il giorno dalle prenotazioni', async ({
  page,
  browser,
}) => {
  // Più di 4 settimane avanti: lontano dai giorni degli altri test e dalla chiusura del seed
  const giorno = prossimoFeriale(25);
  const motivo = `Ferie ${unico()}`;

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/orari');
  await page.getByRole('link', { name: 'Aggiungi una chiusura' }).click();
  await page.getByLabel('Dal').fill(giorno);
  await page.getByLabel('Al (compreso)').fill(giorno);
  await page.getByLabel('Motivo (facoltativo)').fill(motivo);
  await page.getByRole('button', { name: 'Salva chiusura' }).click();
  await expect(page.getByText('Chiusura salvata.')).toBeVisible();
  const riga = page.locator('.tc-lista__riga', { hasText: motivo });
  await expect(riga).toBeVisible();

  // Il cliente la vede nella scheda e non può scegliere quel giorno
  const cliente = await (await browser.newContext()).newPage();
  await accedi(cliente, 'cliente@tyrecare.test');
  await cliente.goto('/officine');
  await cliente.getByRole('link', { name: new RegExp(OFFICINA) }).click();
  await expect(cliente.getByText(motivo)).toBeVisible();
  await cliente.getByRole('link', { name: 'Chiedi un appuntamento' }).click();
  await cliente.getByLabel('Giorno').fill(giorno);
  // Senza il motivo esatto: una chiusura rimasta da un'esecuzione interrotta può cadere lo stesso giorno
  await expect(cliente.getByText(/: l'officina è chiusa \(ferie /)).toBeVisible();

  // Il titolare la elimina
  await riga.getByRole('button').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina chiusura' }).click();
  await expect(page.getByText('Chiusura eliminata.')).toBeVisible();
  await expect(page.getByText(motivo)).toHaveCount(0);
});
