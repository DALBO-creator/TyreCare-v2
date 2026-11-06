import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Browser, type Page } from '@playwright/test';

// Funzioni comuni ai test: accesso, dati unici, operazioni dell'officina ed email lette da Mailpit.

/** Password degli utenti di `supabase/seed.sql` (e di quelli creati dai test). */
export const PASSWORD = 'password123';

/** Officina del titolare del seed (`titolare@tyrecare.test`). */
export const OFFICINA = 'Gomme Rossi S.n.c.';

/** Mailpit di Supabase locale: riceve tutte le email di Auth (porta in `supabase/config.toml`). */
const MAILPIT = 'http://127.0.0.1:54324';

/** Suffisso diverso a ogni chiamata, per creare clienti, email e targhe senza duplicati. */
export function unico(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/** Partita IVA italiana valida e unica: 10 cifre dall'orologio e dal caso, più la cifra di controllo. */
export function partitaIvaUnica(): string {
  const dieci =
    Date.now().toString().slice(-7) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let c = Number(dieci[i]);
    if (i % 2 === 1) c = c * 2 > 9 ? c * 2 - 9 : c * 2;
    somma += c;
  }
  return dieci + String((10 - (somma % 10)) % 10);
}

/** Email nuova di un cliente di prova, che nessun account usa ancora. */
export const emailNuova = () => `e2e-${unico().toLowerCase()}@tyrecare.test`;

export async function accedi(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/accedi');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page).not.toHaveURL(/\/accedi/);
}

/** Crea un cliente dall'elenco clienti e ne restituisce l'id (dall'indirizzo della sua scheda). */
export async function creaCliente(
  page: Page,
  cliente: { nome: string; cognome: string; email?: string },
): Promise<string> {
  await page.goto('/clienti/nuovo?da=clienti');
  await page.getByLabel('Nome', { exact: true }).fill(cliente.nome);
  await page.getByLabel('Cognome', { exact: true }).fill(cliente.cognome);
  if (cliente.email) await page.getByLabel('Email (facoltativa)').fill(cliente.email);
  await page.getByRole('button', { name: 'Salva cliente' }).click();
  await expect(page).toHaveURL(/\/cliente\?id=/);
  return new URL(page.url()).searchParams.get('id')!;
}

export async function creaVeicolo(
  page: Page,
  clienteId: string,
  veicolo: { targa: string; marca: string; modello: string },
): Promise<void> {
  await page.goto(`/veicoli/nuovo?cliente=${clienteId}&da=cliente`);
  await page.getByLabel('Targa').fill(veicolo.targa);
  await page.getByLabel('Marca').fill(veicolo.marca);
  await page.getByLabel('Modello').fill(veicolo.modello);
  await page.getByRole('button', { name: 'Salva veicolo' }).click();
  await expect(page).toHaveURL(/\/veicolo\?id=/);
}

/**
 * Prepara l'invito del cliente e restituisce il link da mandargli. Il link si legge dall'email già
 * scritta (`mailto:`), come quella che l'officina manda dal suo programma di posta.
 */
export async function preparaInvito(page: Page, clienteId: string): Promise<string> {
  await page.goto(`/cliente/invito?id=${clienteId}`);
  await page.getByRole('button', { name: 'Prepara invito' }).click();
  await expect(page.getByRole('heading', { name: 'Invito pronto' })).toBeVisible();
  const mailto = await page.getByRole('link', { name: "Scrivi l'email" }).getAttribute('href');
  const link = decodeURIComponent(mailto ?? '').match(
    /https?:\/\/\S+\/invito\?codice=[0-9a-f]{32}/,
  );
  expect(link, "il link dell'invito è nel testo dell'email").not.toBeNull();
  return link![0];
}

interface MessaggioMailpit {
  ID: string;
}

/** Link di conferma della registrazione, dall'ultima email arrivata a `email` (attende fino a 15 s). */
export async function linkConferma(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const risposta = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        const { messages } = (await risposta.json()) as { messages: MessaggioMailpit[] };
        id = messages[0]?.ID;
        return id;
      },
      { message: `email di conferma per ${email}`, timeout: 15_000 },
    )
    .toBeTruthy();

  const risposta = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const { HTML } = (await risposta.json()) as { HTML: string };
  const href = HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1];
  expect(href, "il link di conferma è nell'email").toBeDefined();
  return href!.replaceAll('&amp;', '&');
}

/** URL e chiave pubblica di Supabase locale, dallo stesso `.env` usato dal web. */
function supabaseLocale(): { url: string; chiave: string } {
  const env = Object.fromEntries(
    readFileSync(path.join(import.meta.dirname, '../../apps/web/.env'), 'utf8')
      .split(/\r?\n/)
      .map((r) => r.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  return { url: env.VITE_SUPABASE_URL!, chiave: env.VITE_SUPABASE_ANON_KEY! };
}

/**
 * Crea e conferma un account cliente nuovo senza passare dal browser (registrazione dall'API di Auth,
 * link di conferma da Mailpit): per i test che partono da un cliente già registrato.
 */
export async function nuovoAccountCliente(
  nome = 'Cliente',
  metadati: Record<string, string> = {},
): Promise<string> {
  const email = emailNuova();
  const { url, chiave } = supabaseLocale();
  const risposta = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: chiave, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      data: { nome, cognome: 'Prova', ...metadati },
    }),
  });
  expect(risposta.ok, 'registrazione dall’API di Auth').toBe(true);
  // Aprire il link conferma l'email (poi Auth rimanda al sito: il rimando non serve)
  await fetch(await linkConferma(email), { redirect: 'manual' });
  return email;
}

/**
 * Il cliente apre il link dell'invito in `page` (browser separato), crea l'account con l'email
 * dell'invito, conferma dall'email (Mailpit) e collega i veicoli: alla fine è nella home, già dentro.
 */
export async function registratiDalLinkInvito(
  page: Page,
  link: string,
  { nome, cognome, email }: { nome: string; cognome: string; email: string },
): Promise<void> {
  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: `${OFFICINA} ti invita su TyreCare` }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Crea account' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await page.getByLabel('Nome', { exact: true }).fill(nome);
  await page.getByLabel('Cognome', { exact: true }).fill(cognome);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Ho letto l'informativa privacy/).check();
  await page.getByRole('button', { name: 'Crea account' }).click();
  await expect(page.getByRole('heading', { name: 'Controlla la posta' })).toBeVisible();

  // Il link di conferma riporta all'invito, già dentro
  await page.goto(await linkConferma(email));
  await expect(page).toHaveURL(/\/invito\?codice=/);
  await page.getByRole('button', { name: 'Collega i miei veicoli' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Colonne del CSV dei controlli, nell'ordine dell'import (`importa-controlli`). */
const COLONNE_CONTROLLI = [
  'codice_documento',
  'targa',
  'data',
  'km',
  'posizione',
  'battistrada_mm',
  'pressione_bar',
  'usura',
  'danni',
  'stagione',
  'misura',
  'marca',
  'modello',
  'dot',
  'note',
];

/** CSV dei controlli come lo salva Excel in italiano: intestazione, campi con `;`, righe con `\r\n`. */
export function csvControlli(righe: string[][]): string {
  return [COLONNE_CONTROLLI, ...righe].map((r) => r.join(';')).join('\r\n');
}

/** Prossimo giorno feriale (lunedì–venerdì) dopo oggi, `AAAA-MM-GG`, saltandone `salta`. */
export function prossimoFeriale(salta = 0): string {
  // Da oggi in Italia (come il database), non dal giorno UTC
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const d = new Date(`${oggi}T12:00:00Z`);
  let trovati = -1;
  while (trovati < salta) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) trovati++;
  }
  return d.toISOString().slice(0, 10);
}

/** Servizio del seed di Gomme Rossi usato nelle richieste dei test. */
export const SERVIZIO = 'Cambio gomme stagionale';

/** Un browser separato, già entrato con l'account indicato. */
export async function entra(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await accedi(page, email);
  return page;
}

/** Il cliente chiede un appuntamento a Gomme Rossi; restituisce l'indirizzo della prenotazione. */
export async function chiedi(
  page: Page,
  {
    targa,
    giorno,
    fascia,
    veicolo,
  }: { targa: string; giorno: string; fascia: 'Mattina' | 'Pomeriggio'; veicolo?: string },
): Promise<string> {
  await page.goto('/officine');
  await page.getByRole('link', { name: new RegExp(OFFICINA) }).click();
  await page.getByRole('link', { name: 'Chiedi un appuntamento' }).click();
  await page.getByLabel('Servizio').selectOption({ label: SERVIZIO });
  await page.getByLabel('Targa').fill(targa);
  if (veicolo) await page.getByLabel('Veicolo (facoltativo)').fill(veicolo);
  await page.getByLabel('Giorno').fill(giorno);
  await page.getByLabel(fascia).check();
  await page.getByLabel('Il tuo telefono').fill('340 1234567');
  await page.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(page).toHaveURL(/\/appuntamento\?id=/);
  await expect(page.getByText(`Richiesta inviata a ${OFFICINA}`)).toBeVisible();
  await expect(page.getByText('In attesa di risposta')).toBeVisible();
  return new URL(page.url()).pathname + new URL(page.url()).search;
}
