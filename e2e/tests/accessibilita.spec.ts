import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { accedi } from './aiuti';

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
];

for (const { percorso, titolo } of PAGINE) {
  test(`${percorso}: nessuna violazione di accessibilità grave`, async ({ page }) => {
    await page.goto(percorso);
    await expect(page.getByRole('heading', { level: 1, name: titolo })).toBeVisible();

    await controllaAccessibilita(page, percorso);
  });
}

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
