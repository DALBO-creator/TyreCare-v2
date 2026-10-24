import { expect, test, type Browser } from '@playwright/test';
import {
  SERVIZIO,
  accedi,
  chiedi,
  entra,
  nuovoAccountCliente,
  prossimoFeriale,
  unico,
} from './aiuti';

// Corsa per l'ultima fascia: il cliente B compila il modulo mentre il cliente A riempie la fascia.
// Dopo l'errore la pagina di B ricarica le fasce piene e spegne quella appena riempita.

// La capienza è un'impostazione condivisa dell'officina: si svuota in un contesto nuovo prima e dopo il
// test (anche dopo un timeout), altrimenti i test successivi troverebbero le fasce piene.
async function svuotaCapienza(browser: Browser): Promise<void> {
  const titolare = await entra(browser, 'titolare@tyrecare.test');
  try {
    await titolare.goto('/officina/orari');
    const campo = titolare.getByLabel('Richieste al massimo per fascia');
    await campo.fill('');
    await titolare.getByRole('button', { name: 'Salva orari' }).click();
    await expect(titolare.getByText('Orari salvati.')).toBeVisible();
    await expect(campo).toHaveValue('');
  } finally {
    await titolare.context().close();
  }
}

test.beforeEach(({ browser }) => svuotaCapienza(browser));
test.afterEach(({ browser }) => svuotaCapienza(browser));

test('se la fascia si riempie mentre compili, la pagina la spegne', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  // Giorno diverso da quelli degli altri test (0–2, 25, 40); un nuovo tentativo usa il giorno dopo
  const giorno = prossimoFeriale(44 + testInfo.retry);

  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/orari');
  const campo = page.getByLabel('Richieste al massimo per fascia');
  await campo.fill('1');
  await page.getByRole('button', { name: 'Salva orari' }).click();
  await expect(page.getByText('Orari salvati.')).toBeVisible();
  await expect(campo).toHaveValue('1');

  // B apre il modulo e sceglie il giorno: la Mattina è ancora libera
  const secondo = await entra(browser, await nuovoAccountCliente('Bruno'));
  await secondo.goto('/officine');
  await secondo.getByRole('link', { name: /Gomme Rossi/ }).click();
  await secondo.getByRole('link', { name: 'Chiedi un appuntamento' }).click();
  await secondo.getByLabel('Giorno').fill(giorno);
  await expect(secondo.getByLabel('Mattina')).toBeEnabled();

  // Nel frattempo A riempie la Mattina
  const primo = await entra(browser, await nuovoAccountCliente('Anna'));
  const indirizzo = await chiedi(primo, {
    targa: `C${unico().slice(-7)}`,
    giorno,
    fascia: 'Mattina',
  });

  // B compila il resto e invia: la fascia è piena
  await secondo.getByLabel('Servizio').selectOption({ label: SERVIZIO });
  await secondo.getByLabel('Targa').fill(`D${unico().slice(-7)}`);
  await secondo.getByLabel('Mattina').check();
  await secondo.getByLabel('Il tuo telefono').fill('340 7654321');
  await secondo.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(secondo.getByText('Questa fascia si è appena riempita')).toBeVisible();
  await expect(secondo.getByLabel('Mattina (piena)')).toBeDisabled();

  // Libera la fascia: così l'esecuzione si può ripetere lo stesso giorno
  await primo.goto(indirizzo);
  await primo.getByRole('button', { name: 'Annulla la richiesta' }).click();
  await primo.getByRole('dialog').getByRole('button', { name: 'Sì, annulla' }).click();
  await expect(primo.getByText('Appuntamento annullato.')).toBeVisible();
});
