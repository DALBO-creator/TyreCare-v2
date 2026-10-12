import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

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
export async function nuovoAccountCliente(nome = 'Cliente'): Promise<string> {
  const email = emailNuova();
  const { url, chiave } = supabaseLocale();
  const risposta = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: chiave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, data: { nome, cognome: 'Prova' } }),
  });
  expect(risposta.ok, 'registrazione dall’API di Auth').toBe(true);
  // Aprire il link conferma l'email (poi Auth rimanda al sito: il rimando non serve)
  await fetch(await linkConferma(email), { redirect: 'manual' });
  return email;
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
