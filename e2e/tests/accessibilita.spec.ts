import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  PASSWORD,
  accedi,
  emailNuova,
  entra,
  nuovoAccountCliente,
  partitaIvaUnica,
  unico,
} from './aiuti';

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
  // Pubblica (accesso 'pubblica' in main.ts): l'h1 viene dal Markdown dell'informativa
  { percorso: '/privacy', titolo: /^Informativa sul trattamento dei dati personali/ },
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
  // Modulo di richiesta prima dell'invio (nessuna posizione richiesta)
  { percorso: '/strada', titolo: 'Aiuto su strada' },
  { percorso: '/appuntamenti', titolo: 'Appuntamenti' },
  { percorso: '/notifiche', titolo: 'Notifiche' },
  // Il titolo è il nome del profilo del seed (Giulia Verdi)
  { percorso: '/profilo', titolo: 'Giulia Verdi' },
  { percorso: '/commento', titolo: 'Invia un commento' },
  // Pagina di prenotazione di "Gomme Rossi": il titolo è fisso, il nome dell'officina è nell'etichetta
  {
    percorso: '/prenota?officina=b0000000-0000-4000-8000-000000000001',
    titolo: 'Chiedi un appuntamento',
  },
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
  { percorso: '/officina/strada', titolo: 'Richieste su strada' },
  { percorso: '/officina/abbonamento', titolo: 'Abbonamento' },
  // Il titolo è il nome del profilo del seed (Mario Rossi)
  { percorso: '/profilo', titolo: 'Mario Rossi' },
  { percorso: '/servizi', titolo: 'Servizi' },
  { percorso: '/officina/orari', titolo: 'Orari e chiusure' },
  { percorso: '/officina/dati', titolo: "Dati dell'officina" },
  // Giulia Verdi (seed): il titolo è il nominativo "cognome nome"
  { percorso: '/cliente?id=c0000000-0000-4000-8000-000000000001', titolo: 'Verdi Giulia' },
  { percorso: '/clienti/importa-controlli', titolo: 'Importa i controlli' },
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

test.describe('amministratore', () => {
  test("/admin/officine con un'officina in attesa: nessuna violazione di accessibilità grave", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    // Non dipende dal seed (le altre prove attivano o sospendono officine): se ne registra una nuova,
    // che resta in attesa, così compaiono i pulsanti «Attiva» e «Rifiuta la richiesta».
    const ragioneSociale = `Gomme Axe ${unico()}`;
    await accedi(page, await nuovoAccountCliente('Marta'));
    await page.goto('/officina/registra');
    await page.getByLabel('Ragione sociale').fill(ragioneSociale);
    await page.getByLabel('Partita IVA').fill(partitaIvaUnica());
    await page.getByLabel('Città').fill('Torino');
    await page.getByRole('button', { name: 'Invia la richiesta' }).click();
    await expect(page.getByText('Officina in attesa')).toBeVisible();

    const admin = await entra(browser, 'admin@tyrecare.test');
    await admin.goto('/admin/officine');
    await expect(admin.getByRole('heading', { level: 1, name: 'Officine' })).toBeVisible();
    const riga = admin.locator('.tc-lista__riga').filter({ hasText: ragioneSociale });
    await expect(riga.getByRole('button', { name: 'Attiva' })).toBeVisible();
    await expect(riga.getByRole('button', { name: 'Rifiuta la richiesta' })).toBeVisible();
    await controllaAccessibilita(admin, '/admin/officine');
  });

  // L'elenco è pieno: un cliente nuovo (il limite è di 20 commenti in 24 ore per utente) scrive un
  // commento e l'admin lo trova in cima (ordine `created_at desc`) prima dell'analisi
  test('/admin/commenti: nessuna violazione di accessibilità grave', async ({ browser }) => {
    test.setTimeout(180_000);

    const testo = `Commento per axe ${unico()}`;
    const email = await nuovoAccountCliente('Commentatore');
    const cliente = await entra(browser, email);
    await cliente.goto('/commento');
    await cliente.getByLabel('Cosa vuoi dirci?').fill(testo);
    await cliente.getByRole('button', { name: 'Invia', exact: true }).click();
    await expect(cliente.getByText('Grazie, abbiamo ricevuto il tuo commento.')).toBeVisible();

    // L'admin del seed ha la 2FA: `entra` scrive anche il codice
    const page = await entra(browser, 'admin@tyrecare.test');
    await page.goto('/admin/commenti');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Commenti degli utenti' }),
    ).toBeVisible();
    await expect(page.locator('.tc-lista__riga').filter({ hasText: testo })).toBeVisible();
    await controllaAccessibilita(page, '/admin/commenti');
  });

  test('/admin/andamento: nessuna violazione di accessibilità grave', async ({ browser }) => {
    test.setTimeout(180_000);

    const page = await entra(browser, 'admin@tyrecare.test');
    await page.goto('/admin/andamento');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Andamento del pilota' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gomme Rossi' })).toBeVisible();
    await controllaAccessibilita(page, '/admin/andamento');
  });

  // L'h1 compare già durante il controllo d'accesso: l'attesa specifica è un elemento disegnato solo
  // dopo il caricamento dei dati (elenco o stato vuoto, perché errori e registro possono essere vuoti)
  const PAGINE_ADMIN: {
    percorso: string;
    titolo: string;
    atteso: (page: Page) => Locator;
  }[] = [
    {
      percorso: '/admin',
      titolo: 'Pannello amministratore',
      atteso: (page) => page.getByRole('heading', { level: 2, name: 'Strumenti', exact: true }),
    },
    {
      percorso: '/admin/utenti',
      titolo: 'Account',
      atteso: (page) => page.getByLabel('Cerca per email, nome, cognome, telefono o ID'),
    },
    {
      percorso: '/admin/errori',
      titolo: "Errori dell'app",
      atteso: (page) =>
        page
          .locator('.tc-contenuto > .tc-lista')
          .or(page.getByText('Nessun errore negli ultimi 30 giorni')),
    },
    {
      percorso: '/admin/registro',
      titolo: 'Registro delle azioni',
      atteso: (page) =>
        page.locator('.tc-contenuto > .tc-lista').or(page.getByText('Nessuna azione registrata')),
    },
    {
      percorso: '/admin/abbonamento?id=b0000000-0000-4000-8000-000000000001',
      titolo: 'Abbonamento',
      atteso: (page) => page.locator('.tc-contenuto').getByText('Gomme Rossi'),
    },
  ];

  for (const { percorso, titolo, atteso } of PAGINE_ADMIN) {
    test(`${percorso}: nessuna violazione di accessibilità grave`, async ({ browser }) => {
      test.setTimeout(180_000);

      const page = await entra(browser, 'admin@tyrecare.test');
      await page.goto(percorso);
      await expect(
        page.getByRole('heading', { level: 1, name: titolo, exact: true }),
      ).toBeVisible();
      await expect(atteso(page)).toBeVisible();
      await controllaAccessibilita(page, percorso);
    });
  }
});
