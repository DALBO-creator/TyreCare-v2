import { expect, test, type Page } from '@playwright/test';
import { accedi, codiceTotp, nuovoAccountCliente } from './aiuti';

// Il cliente attiva la verifica in due passaggi dal Profilo, rientra con il codice e la spegne.

/**
 * Supabase può rifiutare lo stesso codice usato due volte nella stessa finestra di 30 s: prima di ogni
 * codice nuovo si attende che `codiceTotp(segreto)` cambi rispetto all'ultimo usato (al massimo 31 s).
 */
async function codiceNuovo(page: Page, segreto: string, ultimo: string | null): Promise<string> {
  for (let i = 0; i < 31; i++) {
    const codice = codiceTotp(segreto);
    if (codice !== ultimo) return codice;
    await page.waitForTimeout(1000);
  }
  throw new Error('Il codice TOTP non è cambiato entro 31 secondi');
}

async function esci(page: Page): Promise<void> {
  await page.goto('/profilo');
  await page.getByRole('button', { name: 'Esci' }).click();
  await expect(page).toHaveURL(/\/accedi/);
}

test('il cliente attiva la verifica in due passaggi, rientra con il codice e la disattiva', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const email = await nuovoAccountCliente('Nome');
  await accedi(page, email);
  await expect(page.getByRole('heading', { name: 'Ciao, Nome' })).toBeVisible();

  // Attivazione
  await page.goto('/profilo/sicurezza');
  await page.getByRole('button', { name: 'Attiva la verifica in due passaggi' }).click();
  const campoSegreto = page.locator('[data-segreto]');
  await expect(campoSegreto).toHaveText(/^[A-Z2-7]+=*$/);
  const segreto = (await campoSegreto.textContent())!.trim();
  const codiceAttivazione = codiceTotp(segreto);
  await page.getByLabel('Codice di 6 cifre', { exact: true }).fill(codiceAttivazione);
  await page.getByRole('button', { name: 'Attiva', exact: true }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  await expect(
    page.getByText(
      'Verifica in due passaggi attivata: al prossimo accesso ti chiederemo il codice.',
    ),
  ).toBeVisible();

  // Rientro: dopo la password serve il codice
  await esci(page);
  await accedi(page, email);
  await expect(page.getByRole('heading', { name: 'Verifica in due passaggi' })).toBeVisible();
  const campo = page.getByLabel('Codice di 6 cifre', { exact: true });
  await expect(campo).toBeVisible();

  const sbagliato = codiceTotp(segreto) === '000000' ? '111111' : '000000';
  await campo.fill(sbagliato);
  await page.getByRole('button', { name: 'Continua' }).click();
  await expect(
    page.getByText('Codice non valido o scaduto: riprova con quello nuovo.'),
  ).toBeVisible();

  const codiceAccesso = await codiceNuovo(page, segreto, codiceAttivazione);
  await campo.fill('');
  await campo.fill(codiceAccesso);
  await page.getByRole('button', { name: 'Continua' }).click();
  await expect(page.getByRole('heading', { name: 'Ciao, Nome' })).toBeVisible();

  // Disattivazione
  await page.goto('/profilo/sicurezza');
  await expect(page.getByText('La verifica in due passaggi è attiva.')).toBeVisible();
  const codiceDisattivazione = await codiceNuovo(page, segreto, codiceAccesso);
  await page.getByLabel('Codice di 6 cifre', { exact: true }).fill(codiceDisattivazione);
  await page.getByRole('button', { name: 'Disattiva', exact: true }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  await expect(page.getByText('Verifica in due passaggi disattivata.')).toBeVisible();

  // Rientro senza richiesta del codice (l'assenza si verifica dopo aver atteso l'h1 della home)
  await esci(page);
  await accedi(page, email);
  await expect(page.getByRole('heading', { name: 'Ciao, Nome' })).toBeVisible();
  await expect(page.getByLabel('Codice di 6 cifre', { exact: true })).toHaveCount(0);
});
