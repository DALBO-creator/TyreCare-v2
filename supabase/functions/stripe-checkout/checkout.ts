// Flusso del checkout di Stripe (T189, R22). La usa `index.ts`, che le passa variabili, `fetch` e le
// letture del database (service role). Senza Deno, così la provano i test di vitest (project `funzioni`).
//
// Chi può: solo il TITOLARE dell'officina (`officina_utenti`). La pagina "Abbonamento" (T192) nasconde il
// pulsante agli altri, ma la decisione è qui. Piano PILOTA (lo assegna l'ADMIN) e abbonamento già ATTIVO
// non aprono un checkout nuovo: per cambiare carta o piano si usa il portale (T195).
// Il cliente Stripe si collega all'abbonamento (`collega_cliente_stripe`) PRIMA di aprire la sessione, così
// il webhook (T185) ritrova l'officina anche dal solo cliente.

import { CORS, chiamaStripe, risposta, type FetchFn } from '../_shared/stripe.ts';

export type Piano = 'STARTER' | 'PRO';

export interface CorpoCheckout {
  officina_id: string;
  piano: Piano;
}

export interface AbbonamentoCheckout {
  piano: string;
  stato: string;
  stripe_customer_id: string | null;
}

/** Letture e scritture del database che servono al checkout. In caso di errore lanciano. */
export interface DbCheckout {
  /** Utente del JWT (`auth.getUser(token)`), `null` se il token non è valido. */
  utente(token: string): Promise<{ id: string; email: string | null } | null>;
  /** Ruolo dell'utente nell'officina (`TITOLARE`/`OPERATORE`), `null` se non ne fa parte. */
  ruolo(officinaId: string, utenteId: string): Promise<string | null>;
  abbonamento(officinaId: string): Promise<AbbonamentoCheckout | null>;
  ragioneSociale(officinaId: string): Promise<string | null>;
  /** `collega_cliente_stripe(p_officina_id, p_customer)`. */
  collegaCliente(officinaId: string, customer: string): Promise<void>;
}

export interface DipendenzeCheckout {
  env: (nome: string) => string | undefined;
  fetchFn: FetchFn;
  db: DbCheckout;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corpo della richiesta della pagina, oppure `null` (→ 400 `RICHIESTA_NON_VALIDA`). */
export function leggiCorpo(json: unknown): CorpoCheckout | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const { officina_id, piano } = json as Record<string, unknown>;
  if (typeof officina_id !== 'string' || !UUID.test(officina_id)) return null;
  if (piano !== 'STARTER' && piano !== 'PRO') return null;
  return { officina_id, piano };
}

/** Parametri di `POST /v1/checkout/sessions`. `sito` senza barra finale (es. https://tyrecare.it). */
export function parametriCheckout(dati: {
  customer: string;
  prezzo: string;
  officina_id: string;
  sito: string;
}): URLSearchParams {
  const sito = dati.sito.replace(/\/+$/, '');
  return new URLSearchParams([
    ['mode', 'subscription'],
    ['customer', dati.customer],
    ['line_items[0][price]', dati.prezzo],
    ['line_items[0][quantity]', '1'],
    // Solo carta: il webhook mette ATTIVO a `checkout.session.completed`, anche con pagamenti differiti.
    ['payment_method_types[0]', 'card'],
    // Entrambi: il webhook ritrova l'officina dalla sessione e dagli eventi dell'abbonamento.
    ['client_reference_id', dati.officina_id],
    ['subscription_data[metadata][officina_id]', dati.officina_id],
    ['locale', 'it'],
    ['success_url', `${sito}/officina/abbonamento?pagamento=ok`],
    ['cancel_url', `${sito}/officina/abbonamento?pagamento=annullato`],
  ]);
}

/** Parametri di `POST /v1/customers`. Senza email (utente senza indirizzo) il campo non si manda. */
export function parametriCliente(dati: {
  email: string | null;
  nome: string;
  officina_id: string;
}): URLSearchParams {
  const parametri = new URLSearchParams();
  if (dati.email) parametri.set('email', dati.email);
  parametri.set('name', dati.nome);
  parametri.set('metadata[officina_id]', dati.officina_id);
  return parametri;
}

function tokenDa(intestazione: string | null): string | null {
  const trovato = /^Bearer\s+(\S+)\s*$/i.exec(intestazione ?? '');
  return trovato?.[1] ?? null;
}

const errore = (codice: string, status: number): Response => risposta({ errore: codice }, status);

export async function gestisciCheckout(
  richiesta: Request,
  { env, fetchFn, db }: DipendenzeCheckout,
): Promise<Response> {
  if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (richiesta.method !== 'POST') return errore('METODO_NON_AMMESSO', 405);

  const chiave = env('STRIPE_SECRET_KEY');
  const prezzi: Record<Piano, string | undefined> = {
    STARTER: env('STRIPE_PRICE_STARTER'),
    PRO: env('STRIPE_PRICE_PRO'),
  };
  const sito = env('SITO_URL');
  if (!chiave || !prezzi.STARTER || !prezzi.PRO || !sito)
    return errore('PAGAMENTI_NON_ATTIVI', 503);

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
    const corpo = leggiCorpo(json);
    if (!corpo) return errore('RICHIESTA_NON_VALIDA', 400);
    const { officina_id, piano } = corpo;

    if ((await db.ruolo(officina_id, utente.id)) !== 'TITOLARE')
      return errore('SOLO_TITOLARE', 403);

    const abbonamento = await db.abbonamento(officina_id);
    if (!abbonamento) return errore('ABBONAMENTO_NON_TROVATO', 404);
    if (abbonamento.piano === 'PILOTA') return errore('PILOTA', 409);
    if (abbonamento.stato === 'ATTIVO') return errore('GIA_ATTIVO', 409);

    let customer = abbonamento.stripe_customer_id;
    if (!customer) {
      const nome = (await db.ragioneSociale(officina_id)) ?? '';
      const cliente = await creaCliente(fetchFn, chiave, {
        email: utente.email,
        nome,
        officina_id,
      });
      if (cliente instanceof Response) return cliente;
      customer = cliente;
      try {
        await db.collegaCliente(officina_id, customer);
      } catch (e) {
        // Due richieste insieme: l'altra ha già collegato il suo cliente. Si usa quello (il cliente
        // appena creato resta su Stripe senza abbonamento, innocuo).
        const riletto = await db.abbonamento(officina_id);
        if (!riletto?.stripe_customer_id) throw e;
        customer = riletto.stripe_customer_id;
      }
    }

    let sessione: Record<string, unknown>;
    try {
      sessione = await chiamaStripe(
        fetchFn,
        chiave,
        'checkout/sessions',
        parametriCheckout({ customer, prezzo: prezzi[piano] as string, officina_id, sito }),
      );
    } catch (e) {
      return erroreStripe('sessione', e);
    }
    if (typeof sessione.url !== 'string' || !sessione.url) {
      return erroreStripe('sessione', new Error('sessione senza url'));
    }
    return risposta({ url: sessione.url }, 200);
  } catch (e) {
    // Errore del database: il messaggio resta nel log.
    console.error('Checkout di Stripe: errore del database,', e instanceof Error ? e.message : e);
    return errore('DATABASE', 500);
  }
}

/** Crea il cliente Stripe e ne restituisce l'id, o la risposta 502 se Stripe dà errore. */
async function creaCliente(
  fetchFn: FetchFn,
  chiave: string,
  dati: { email: string | null; nome: string; officina_id: string },
): Promise<string | Response> {
  try {
    const cliente = await chiamaStripe(fetchFn, chiave, 'customers', parametriCliente(dati));
    if (typeof cliente.id !== 'string' || !cliente.id) throw new Error('cliente senza id');
    return cliente.id;
  } catch (e) {
    return erroreStripe('cliente', e);
  }
}

// 502: il messaggio di Stripe va solo nel log, mai al browser.
function erroreStripe(fase: string, e: unknown): Response {
  console.error('Checkout di Stripe: errore di Stripe,', fase, e instanceof Error ? e.message : e);
  return errore('STRIPE', 502);
}
