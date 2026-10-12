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
