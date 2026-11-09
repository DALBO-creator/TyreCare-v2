import { expect, test, type Browser } from '@playwright/test';
import { accedi, entra, nuovoAccountCliente, unico } from './aiuti';

// Intervento su strada, lato officina (R18): il titolare attiva l'aiuto con 50 km, un cliente nuovo vicino a
// Gomme Rossi manda una richiesta, l'operatore la vede e la accetta, il cliente legge nome e telefono
// dell'officina e il titolare la chiude. Il servizio è un'impostazione condivisa di "Gomme Rossi" (e
// strada.spec.ts conta sul fatto che nessuna officina lo offra): si spegne in un contesto nuovo prima e
// dopo il test, anche dopo un timeout.

const TELEFONO_OFFICINA = '+39 011 1234567';

// Testo esatto dell'avviso nella home dell'officina (singolare o plurale)
const avvisoVicine = (n: number) =>
  n === 1 ? '1 richiesta di aiuto su strada vicina' : `${n} richieste di aiuto su strada vicine`;

async function spegniAiutoSuStrada(browser: Browser): Promise<void> {
  const titolare = await entra(browser, 'titolare@tyrecare.test');
  try {
    await titolare.goto('/officina/dati');
    const casella = titolare.getByLabel("Offro l'aiuto su strada");
    await expect(casella).toBeEnabled();
    await casella.uncheck();
    await titolare.getByLabel('Fino a quanti km').fill('30');
    await titolare.getByRole('button', { name: 'Salva dati' }).click();
    await expect(titolare.getByText("Dati dell'officina salvati.")).toBeVisible();
    await titolare.goto('/officina/dati');
    await expect(titolare.getByLabel("Offro l'aiuto su strada")).not.toBeChecked();
  } finally {
    await titolare.context().close();
  }
}

test.beforeEach(({ browser }) => spegniAiutoSuStrada(browser));
test.afterEach(({ browser }) => spegniAiutoSuStrada(browser));

test('il titolare attiva l’aiuto, l’operatore accetta una richiesta e il titolare la chiude', async ({
  page,
  browser,
}) => {
  // Tre accessi, una registrazione con email di conferma e le pagine di tre persone: più dei 60 s usuali
  test.setTimeout(180_000);
  const descrizione = `Gomma a terra ${unico()}`;

  // Il titolare: il km va da 5 a 100
  await accedi(page, 'titolare@tyrecare.test');
  await page.goto('/officina/dati');
  const casella = page.getByLabel("Offro l'aiuto su strada");
  await expect(casella).toBeEnabled();
  await casella.check();
  await page.getByLabel('Fino a quanti km').fill('101');
  await page.getByRole('button', { name: 'Salva dati' }).click();
  await expect(page.getByLabel('Fino a quanti km')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Fino a quanti km').fill('50');
  await page.getByRole('button', { name: 'Salva dati' }).click();
  await expect(page.getByText("Dati dell'officina salvati.")).toBeVisible();

  // Con il servizio attivo la home ha il link
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Richieste su strada' })).toBeVisible();
  // Un tentativo precedente caduto dopo l'invio lascia una richiesta aperta per ore: si parte dal conteggio
  // già mostrato dall'avviso (0 se non c'è)
  const avviso = page.locator('a.tc-avviso[href="/officina/strada"]');
  const prima = (await avviso.count()) ? Number.parseInt((await avviso.innerText()).trim(), 10) : 0;

  // Il cliente, a poco più di un chilometro da Gomme Rossi
  const contesto = await browser.newContext({
    geolocation: { latitude: 45.08, longitude: 7.69 },
    permissions: ['geolocation'],
  });
  const cliente = await contesto.newPage();
  const operatore = await entra(browser, 'operatore@tyrecare.test');
  try {
    await accedi(cliente, await nuovoAccountCliente('Rita'));
    await cliente.goto('/strada');
    await cliente.getByLabel('Cosa è successo').fill(descrizione);
    await cliente.getByLabel('Telefono', { exact: true }).fill('333 1234567');
    await cliente.getByRole('button', { name: 'Usa la mia posizione e invia' }).click();
    await expect(cliente.getByText("Stiamo cercando un'officina vicina")).toBeVisible();

    // Il titolare, dalla home, vede una richiesta vicina in più
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Richieste su strada' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: avvisoVicine(prima + 1), exact: true }),
    ).toHaveAttribute('href', '/officina/strada');

    // L'operatore la vede e la accetta
    await operatore.goto('/officina/strada');
    await expect(operatore.getByRole('heading', { name: 'Richieste su strada' })).toBeVisible();
    const riga = operatore.locator('.tc-lista__riga', { hasText: descrizione });
    await expect(riga).toBeVisible();
    await expect(riga.getByText(/^A .+ da te$/)).toBeVisible();
    await riga.getByRole('button', { name: 'Accetta' }).click();
    const dialogo = operatore.getByRole('dialog');
    await expect(
      dialogo.getByText("Il cliente riceverà il nome e il telefono dell'officina."),
    ).toBeVisible();
    await dialogo.getByRole('button', { name: 'Sì, accetta' }).click();
    const accettata = operatore
      .locator('.tc-lista__riga', { hasText: descrizione })
      .filter({ has: operatore.getByRole('button', { name: 'Chiudi', exact: true }) });
    await expect(accettata).toBeVisible();
    await expect(accettata.getByRole('link', { name: /Chiama/ })).toHaveAttribute(
      'href',
      'tel:3331234567',
    );
    await expect(accettata.getByRole('link', { name: 'Vedi la posizione' })).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\?q=45\.08,7\.69$/,
    );

    // Il cliente legge nome e telefono dell'officina (la pagina si aggiorna ogni 15 secondi)
    await cliente.reload();
    await expect(cliente.locator('strong', { hasText: 'Gomme Rossi S.n.c.' })).toBeVisible();
    await expect(cliente.getByRole('link', { name: `Chiama ${TELEFONO_OFFICINA}` })).toBeVisible();

    // Il titolare la chiude
    await page.goto('/officina/strada');
    const dellaOfficina = page.locator('.tc-lista__riga', { hasText: descrizione });
    await expect(dellaOfficina).toBeVisible();
    await dellaOfficina.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(page.getByText('Nessuna richiesta accettata in corso.')).toBeVisible();
    await expect(page.getByText(descrizione)).toHaveCount(0);
  } finally {
    await contesto.close();
    await operatore.context().close();
  }
});
