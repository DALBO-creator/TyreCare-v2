// Flusso del portale clienti di Stripe (T195, R22, ultima parte di T071). La usa `index.ts`, che le passa
// variabili, `fetch` e le letture del database (service role). Senza Deno, così la provano i test di
// vitest (project `funzioni`).
//
// Il titolare che paga apre la pagina di Stripe dove cambia carta, vede le fatture o annulla
// l'abbonamento; le modifiche tornano all'app dal webhook (T185), non da qui.
// Chi può: solo il TITOLARE dell'officina (`officina_utenti`), come il checkout. Serve un cliente Stripe
// già collegato all'abbonamento (`stripe_customer_id`): senza → 409 `NESSUN_PAGAMENTO`.
// Stato dell'officina e piano NON si controllano di proposito: un'officina SOSPESA o IN_ATTESA, o un
// abbonamento PILOTA/SCADUTO con un cliente Stripe, deve poter annullare o sistemare la carta (dritta
// T189: un `past_due` resta vivo finché non lo si chiude). Il portale non crea subscription nuove.

import { CORS, chiamaStripe, risposta, type FetchFn } from '../_shared/stripe.ts';

/** Letture del database che servono al portale. In caso di errore lanciano. */
export interface DbPortale {
  /** Utente del JWT (`auth.getUser(token)`), `null` se il token non è valido. */
  utente(token: string): Promise<{ id: string } | null>;
  /** Ruolo dell'utente nell'officina (`TITOLARE`/`OPERATORE`), `null` se non ne fa parte. */
  ruolo(officinaId: string, utenteId: string): Promise<string | null>;
  /** Abbonamento dell'officina, `null` se non esiste. */
  abbonamento(officinaId: string): Promise<{ stripe_customer_id: string | null } | null>;
}

export interface DipendenzePortale {
  env: (nome: string) => string | undefined;
  fetchFn: FetchFn;
  db: DbPortale;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `officina_id` del corpo `{ officina_id }`, oppure `null` (→ 400 `RICHIESTA_NON_VALIDA`). */
export function leggiCorpo(json: unknown): string | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const { officina_id } = json as Record<string, unknown>;
  if (typeof officina_id !== 'string' || !UUID.test(officina_id)) return null;
  return officina_id;
}

/** Parametri di `POST /v1/billing_portal/sessions`. La barra finale del sito si toglie (come nel checkout). */
export function parametriPortale(dati: { customer: string; sito: string }): URLSearchParams {
  const sito = dati.sito.replace(/\/+$/, '');
  return new URLSearchParams([
    ['customer', dati.customer],
    ['return_url', `${sito}/officina/abbonamento`],
  ]);
}

function tokenDa(intestazione: string | null): string | null {
  const trovato = /^Bearer\s+(\S+)\s*$/i.exec(intestazione ?? '');
  return trovato?.[1] ?? null;
}

const errore = (codice: string, status: number): Response => risposta({ errore: codice }, status);

export async function gestisciPortale(
  richiesta: Request,
  { env, fetchFn, db }: DipendenzePortale,
): Promise<Response> {
  if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (richiesta.method !== 'POST') return errore('METODO_NON_AMMESSO', 405);

  // I prezzi non servono: il portale lavora sulla subscription che il cliente ha già.
  const chiave = env('STRIPE_SECRET_KEY');
  const sito = env('SITO_URL');
  if (!chiave || !sito) return errore('PAGAMENTI_NON_ATTIVI', 503);

  try {
    const token = tokenDa(richiesta.headers.get('authorization'));
    const utente = token ? await db.utente(token) : null;
    if (!utente) return errore('NON_AUTENTICATO', 401);

    let json: unknown;
    try {
      json = await richiesta.json();
    } catch {
      json = null;
    }
    const officina_id = leggiCorpo(json);
    if (!officina_id) return errore('RICHIESTA_NON_VALIDA', 400);

    if ((await db.ruolo(officina_id, utente.id)) !== 'TITOLARE')
      return errore('SOLO_TITOLARE', 403);

    const abbonamento = await db.abbonamento(officina_id);
    if (!abbonamento) return errore('ABBONAMENTO_NON_TROVATO', 404);
    const customer = abbonamento.stripe_customer_id;
    if (!customer) return errore('NESSUN_PAGAMENTO', 409);

    let sessione: Record<string, unknown>;
    try {
      sessione = await chiamaStripe(
        fetchFn,
        chiave,
        'billing_portal/sessions',
        parametriPortale({ customer, sito }),
      );
    } catch (e) {
      return erroreStripe(e);
    }
    if (typeof sessione.url !== 'string' || !sessione.url) {
      return erroreStripe(new Error('sessione senza url'));
    }
    return risposta({ url: sessione.url }, 200);
  } catch (e) {
    // Errore del database: il messaggio resta nel log.
    console.error('Portale di Stripe: errore del database,', e instanceof Error ? e.message : e);
    return errore('DATABASE', 500);
  }
}

// 502: il messaggio di Stripe (es. portale non configurato nella dashboard) va solo nel log.
function erroreStripe(e: unknown): Response {
  console.error('Portale di Stripe: errore di Stripe,', e instanceof Error ? e.message : e);
  return errore('STRIPE', 502);
}
