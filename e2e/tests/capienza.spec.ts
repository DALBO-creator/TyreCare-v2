import { expect, test } from '@playwright/test';
import { accedi, chiedi, entra, nuovoAccountCliente, prossimoFeriale, unico } from './aiuti';

// Capienza per fascia: il titolare fissa il limite dagli orari, il cliente vede la fascia piena come
// non disponibile. Il limite si rimette vuoto alla fine: l'officina è la stessa degli altri test.

test('con capienza 1 la fascia occupata risulta piena per gli altri clienti', async ({
  page,
  browser,
}) => {
  // Il 40° giorno feriale da oggi (circa 8 settimane): oltre i giorni degli altri test (0–2 e 25),
  // ma entro i 60 giorni prenotabili
  const giorno = prossimoFeriale(40);
  const campo = () => page.getByLabel('Richieste al massimo per fascia');

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/orari');
  try {
    await campo().fill('1');
    await page.getByRole('button', { name: 'Salva orari' }).click();
    await expect(page.getByText('Orari salvati.')).toBeVisible();
    await expect(campo()).toHaveValue('1');

    // Un valore non valido è segnalato sotto il campo
    await campo().fill('0');
    await page.getByRole('button', { name: 'Salva orari' }).click();
    await expect(page.getByText(/Scrivi un numero da 1 a 99/)).toBeVisible();
    await campo().fill('1');

    const primo = await entra(browser, await nuovoAccountCliente('Anna'));
    const indirizzo = await chiedi(primo, {
      targa: `C${unico().slice(-7)}`,
      giorno,
      fascia: 'Mattina',
    });

    const secondo = await entra(browser, await nuovoAccountCliente('Bruno'));
    await secondo.goto('/officine');
    await secondo.getByRole('link', { name: /Gomme Rossi/ }).click();
    await secondo.getByRole('link', { name: 'Chiedi un appuntamento' }).click();
    await secondo.getByLabel('Giorno').fill(giorno);
    await expect(secondo.getByLabel('Mattina (piena)')).toBeDisabled();
    await expect(secondo.getByLabel('Pomeriggio')).toBeEnabled();

    // Libera la fascia: così l'esecuzione si può ripetere lo stesso giorno
    await primo.goto(indirizzo);
    await primo.getByRole('button', { name: "Annulla l'appuntamento" }).click();
    await primo.getByRole('dialog').getByRole('button', { name: 'Sì, annulla' }).click();
    await expect(primo.getByText('Appuntamento annullato.')).toBeVisible();
  } finally {
    await page.goto('/officina/orari');
    await campo().fill('');
    await page.getByRole('button', { name: 'Salva orari' }).click();
    await expect(page.getByText('Orari salvati.')).toBeVisible();
    await expect(campo()).toHaveValue('');
  }
});
