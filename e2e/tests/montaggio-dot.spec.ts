import { expect, test, type Page } from '@playwright/test';
import { accedi, creaCliente, creaVeicolo, unico } from './aiuti';

// Montaggio con «DOT diverso per ogni ruota»: i quattro DOT arrivano fino alla scheda del veicolo
// (pneumatici uguali ma con DOT diverso non si raggruppano: una riga per ruota) e un DOT sbagliato
// in un campo per ruota è segnalato su quel campo.

const MESSAGGIO_DOT = 'Il DOT sono le ultime 4 cifre: settimana e anno (es. 3823)';

/** Titolare di "Gomme Rossi": cliente e veicolo nuovi, poi apre il modulo «Monta pneumatici». */
async function apriMontaggio(page: Page): Promise<string> {
  await accedi(page, 'titolare@tyrecare.test');
  const clienteId = await creaCliente(page, { nome: 'Dino', cognome: `Dot ${unico()}` });
  await creaVeicolo(page, clienteId, { targa: unico().slice(-6), marca: 'Fiat', modello: 'Panda' });
  const veicoloId = new URL(page.url()).searchParams.get('id')!;
  await page.goto(`/veicolo/pneumatici?id=${veicoloId}`);
  await expect(page.getByRole('heading', { name: 'Monta pneumatici' })).toBeVisible();
  await page.getByLabel('Stagione', { exact: true }).selectOption({ label: 'Estivi' });
  await page.getByLabel('Misura', { exact: true }).fill('205/55 R16 91V');
  await page.getByLabel('Marca', { exact: true }).fill('Michelin');
  await page.getByLabel('Modello', { exact: true }).fill('Primacy');
  await page.getByLabel('DOT diverso per ogni ruota').check();
  return veicoloId;
}

test('quattro gomme con un DOT diverso per ruota: la scheda del veicolo li mostra', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await apriMontaggio(page);

  await page.getByLabel('DOT Anteriore sinistro', { exact: true }).fill('0123');
  await page.getByLabel('DOT Anteriore destro', { exact: true }).fill('1522');
  await page.getByLabel('DOT Posteriore sinistro', { exact: true }).fill('2623');
  await page.getByLabel('DOT Posteriore destro', { exact: true }).fill('4824');
  await page.getByRole('button', { name: 'Monta pneumatici' }).click();

  await expect(page).toHaveURL(/\/veicolo\?id=/);
  const righe = page.locator('.tc-lista__riga');
  await expect(righe.filter({ hasText: 'Anteriore sinistro' })).toContainText('DOT 0123');
  await expect(righe.filter({ hasText: 'Posteriore destro' })).toContainText('DOT 4824');
  await expect(righe.filter({ hasText: 'Anteriore destro' })).toContainText('DOT 1522');
  await expect(righe.filter({ hasText: 'Posteriore sinistro' })).toContainText('DOT 2623');
});

test('un DOT sbagliato in un campo per ruota è segnalato su quel campo', async ({ page }) => {
  test.setTimeout(180_000);
  await apriMontaggio(page);

  const sbagliato = page.getByLabel('DOT Anteriore destro', { exact: true });
  await page.getByLabel('DOT Anteriore sinistro', { exact: true }).fill('0123');
  await sbagliato.fill('9999');
  await page.getByLabel('DOT Posteriore sinistro', { exact: true }).fill('2623');
  await page.getByLabel('DOT Posteriore destro', { exact: true }).fill('4824');
  await page.getByRole('button', { name: 'Monta pneumatici' }).click();

  await expect(sbagliato).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(MESSAGGIO_DOT, { exact: true })).toBeVisible();
  await expect(page.getByLabel('DOT Anteriore sinistro', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page).toHaveURL(/\/veicolo\/pneumatici/);
});
