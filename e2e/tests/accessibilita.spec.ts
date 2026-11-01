import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, accedi, emailNuova } from './aiuti';

/**
 * Analizza la pagina già caricata: nessuna violazione WCAG 2 A/AA di impatto grave o critico.
 * Le pagine entrano con una dissolvenza: finché dura, axe misura colori a metà transizione
 * (falso errore di contrasto). Si analizza a pagina ferma, senza escludere nessuna regola.
 */
async function controllaAccessibilita(page: Page, percorso: string): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );

  const risultato = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const gravi = risultato.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

  expect(gravi, `Violazioni su ${percorso}:\n${gravi.join('\n')}`).toEqual([]);
}

// Pagine pubbliche (da ospite): nessuna violazione WCAG 2 A/AA di impatto grave o critico.
const PAGINE = [
  { percorso: '/accedi', titolo: 'Accedi' },
  { percorso: '/registrati', titolo: 'Crea il tuo account' },
  { percorso: '/password-dimenticata', titolo: 'Password dimenticata' },
  { percorso: '/per-le-officine', titolo: 'TyreCare per le officine' },
  { percorso: '/pagina-che-non-esiste', titolo: 'Pagina non trovata' },
];

for (const { percorso, titolo } of PAGINE) {
  test(`${percorso}: nessuna violazione di accessibilità grave`, async ({ page }) => {
    await page.goto(percorso);
    await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();

    await controllaAccessibilita(page, percorso);
  });
}

test.describe('avvisi "Controlla la posta"', () => {
  test('password dimenticata: avviso "Controlla la posta" senza violazioni gravi', async ({
    page,
  }) => {
    await page.goto('/password-dimenticata');
    await page.getByLabel('Email', { exact: true }).fill('cliente@tyrecare.test');
    await page.getByRole('button', { name: 'Invia il link' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Controlla la posta' })).toBeVisible();

    await controllaAccessibilita(page, '/password-dimenticata (Controlla la posta)');
  });

  test('registrazione: avviso "Controlla la posta" senza violazioni gravi', async ({ page }) => {
    await page.goto('/registrati');
    await page.getByLabel('Nome', { exact: true }).fill('Marta');
    await page.getByLabel('Cognome', { exact: true }).fill('Prova');
    await page.getByLabel('Email', { exact: true }).fill(emailNuova());
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel(/Ho letto l'informativa privacy/).check();
    await page.getByRole('button', { name: 'Crea account' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Controlla la posta' })).toBeVisible();

    await controllaAccessibilita(page, '/registrati (Controlla la posta)');
  });
});

// Pagine con l'accesso: stesso controllo, a pagina caricata (h1 visibile).
const PAGINE_CLIENTE = [
  { percorso: '/', titolo: /^Ciao/ },
  // Panda di Giulia (seed): il titolo è il modello ("Panda" o "Panda 1.2")
  { percorso: '/garage/veicolo?targa=AB123CD', titolo: /Panda/ },
  { percorso: '/officine', titolo: 'Officine' },
];

test.describe('cliente', () => {
  for (const { percorso, titolo } of PAGINE_CLIENTE) {
    test(`${percorso}: nessuna violazione di accessibilità grave`, async ({ page }) => {
      await accedi(page, 'cliente@tyrecare.test');
      await page.goto(percorso);
      await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();
      await controllaAccessibilita(page, percorso);
    });
  }
});

const PAGINE_TITOLARE = [
  { percorso: '/', titolo: /^Ciao/ },
  { percorso: '/clienti', titolo: 'Clienti' },
  { percorso: '/appuntamenti', titolo: 'Appuntamenti' },
  { percorso: '/appuntamenti/calendario', titolo: 'Calendario' },
  // Moduli dell'officina. Cliente e veicolo del seed: Giulia (c0…01) e la sua Panda (d0…01, con
  // pneumatici montati: senza, /veicolo/controllo rimanda a /veicolo/pneumatici)
  { percorso: '/clienti/nuovo', titolo: 'Nuovo cliente' },
  {
    percorso: '/veicoli/nuovo?cliente=c0000000-0000-4000-8000-000000000001',
    titolo: 'Nuovo veicolo',
  },
  {
    percorso: '/veicolo/controllo?id=d0000000-0000-4000-8000-000000000001',
    titolo: 'Nuovo controllo',
  },
  { percorso: '/clienti/importa', titolo: 'Importa clienti e veicoli' },
];

test.describe('titolare (Gomme Rossi)', () => {
  for (const { percorso, titolo } of PAGINE_TITOLARE) {
    test(`${percorso}: nessuna violazione di accessibilità grave`, async ({ page }) => {
      await accedi(page, 'titolare@tyrecare.test');
      await page.goto(percorso);
      await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();
      await controllaAccessibilita(page, percorso);
    });
  }

  // Modulo vuoto inviato: errori visibili sotto i campi (aria-invalid, messaggi in aria-describedby)
  test('/clienti/nuovo con gli errori mostrati: nessuna violazione di accessibilità grave', async ({
    page,
  }) => {
    await accedi(page, 'titolare@tyrecare.test');
    await page.goto('/clienti/nuovo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuovo cliente' })).toBeVisible();
    await page.getByRole('button', { name: 'Salva cliente' }).click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    await controllaAccessibilita(page, '/clienti/nuovo (con errori)');
  });
});
