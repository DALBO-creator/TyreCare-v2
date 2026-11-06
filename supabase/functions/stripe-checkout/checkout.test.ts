import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchFn } from '../_shared/stripe.ts';
import {
  gestisciCheckout,
  leggiCorpo,
  parametriCheckout,
  parametriCliente,
  type AbbonamentoCheckout,
  type DbCheckout,
} from './checkout.ts';

const OFFICINA = 'b0000000-0000-0000-0000-000000000001';
const ALTRA_OFFICINA = 'b0000000-0000-0000-0000-000000000002';
const TITOLARE = 'a0000000-0000-0000-0000-000000000002';
const OPERATORE = 'a0000000-0000-0000-0000-000000000003';
const TITOLARE2 = 'a0000000-0000-0000-0000-000000000005';
const SITO = 'https://tyrecare.prova';
const URL_SESSIONE = 'https://checkout.stripe.com/c/pay/cs_test_finta';

const ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_finta',
  STRIPE_PRICE_STARTER: 'price_finto_starter',
  STRIPE_PRICE_PRO: 'price_finto_pro',
  SITO_URL: SITO,
};

// Token finti → utente; ruoli per officina
const UTENTI: Record<string, { id: string; email: string | null }> = {
  tok_titolare: { id: TITOLARE, email: 'titolare@prova.it' },
  tok_operatore: { id: OPERATORE, email: 'operatore@prova.it' },
  tok_titolare2: { id: TITOLARE2, email: 'titolare2@prova.it' },
};
const RUOLI: Record<string, string> = {
  [`${OFFICINA}/${TITOLARE}`]: 'TITOLARE',
  [`${OFFICINA}/${OPERATORE}`]: 'OPERATORE',
  [`${ALTRA_OFFICINA}/${TITOLARE2}`]: 'TITOLARE',
};

let chiamate: string[];
let console_error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  chiamate = [];
  console_error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console_error.mockRestore();
});

function dbFinto(abbonamento: AbbonamentoCheckout | null, altro: Partial<DbCheckout> = {}) {
  const db: DbCheckout = {
    utente: async (token) => UTENTI[token] ?? null,
    ruolo: async (officina, utente) => RUOLI[`${officina}/${utente}`] ?? null,
    abbonamento: async () => abbonamento,
    officina: async () => ({ ragione_sociale: 'Gomme Rossi', stato_affiliazione: 'ATTIVA' }),
    collegaCliente: vi.fn(async (officina: string, customer: string) => {
      chiamate.push(`collega ${officina} ${customer}`);
    }),
    ...altro,
  };
  return db;
}

const PROVA: AbbonamentoCheckout = {
  piano: 'STARTER',
  stato: 'PROVA',
  stripe_customer_id: null,
  stripe_subscription_id: null,
};

/** Stripe finto: registra le chiamate, risponde con un cliente o una sessione (o con un errore). */
function stripeFinto(errore?: { percorso: string; messaggio: string }) {
  return vi.fn<FetchFn>(async (url) => {
    const percorso = url.replace('https://api.stripe.com/v1/', '');
    chiamate.push(`stripe ${percorso}`);
    if (errore?.percorso === percorso) {
      return Response.json({ error: { message: errore.messaggio } }, { status: 400 });
    }
    if (percorso === 'customers') return Response.json({ id: 'cus_finto' });
    return Response.json({ id: 'cs_test_finta', url: URL_SESSIONE });
  });
}

const richiesta = (corpo: unknown, token: string | null = 'tok_titolare', metodo = 'POST') =>
  new Request('http://localhost/stripe-checkout', {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(metodo === 'POST'
      ? { body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }
      : {}),
  });

const CORPO = { officina_id: OFFICINA, piano: 'STARTER' };

const esegui = (
  req: Request,
  db: DbCheckout,
  fetchFn: FetchFn = stripeFinto(),
  env: Record<string, string> = ENV,
) => gestisciCheckout(req, { env: (n) => env[n], fetchFn, db });

describe('leggiCorpo', () => {
  it('corpo valido', () => {
    expect(leggiCorpo({ officina_id: OFFICINA, piano: 'PRO' })).toEqual({
      officina_id: OFFICINA,
      piano: 'PRO',
    });
  });

  it.each([
    ['null', null],
    ['stringa', 'STARTER'],
    ['array', [OFFICINA, 'STARTER']],
    ['senza officina', { piano: 'STARTER' }],
    ['officina non uuid', { officina_id: '1 or 1=1', piano: 'STARTER' }],
    ['piano PILOTA', { officina_id: OFFICINA, piano: 'PILOTA' }],
    ['piano minuscolo', { officina_id: OFFICINA, piano: 'starter' }],
    ['senza piano', { officina_id: OFFICINA }],
  ])('%s → null', (_nome, json) => {
    expect(leggiCorpo(json)).toBeNull();
  });
});

describe('parametriCheckout', () => {
  it('parametri esatti della sessione (barra finale del sito tolta)', () => {
    const p = parametriCheckout({
      customer: 'cus_finto',
      prezzo: 'price_finto_starter',
      officina_id: OFFICINA,
      sito: `${SITO}/`,
    });
    expect(Object.fromEntries(p)).toEqual({
      mode: 'subscription',
      customer: 'cus_finto',
      'line_items[0][price]': 'price_finto_starter',
      'line_items[0][quantity]': '1',
      'payment_method_types[0]': 'card',
      client_reference_id: OFFICINA,
      'subscription_data[metadata][officina_id]': OFFICINA,
      locale: 'it',
      success_url: `${SITO}/officina/abbonamento?pagamento=ok`,
      cancel_url: `${SITO}/officina/abbonamento?pagamento=annullato`,
    });
    expect([...p.keys()]).toHaveLength(10); // nessuna chiave ripetuta
  });
});

describe('parametriCliente', () => {
  it('email, nome e metadata; senza email il campo non c’è', () => {
    expect(
      parametriCliente({ email: 'a@b.it', nome: 'Gomme Rossi', officina_id: OFFICINA }).toString(),
    ).toBe(`email=a%40b.it&name=Gomme+Rossi&metadata%5Bofficina_id%5D=${OFFICINA}`);
    expect(
      parametriCliente({ email: null, nome: 'Gomme Rossi', officina_id: OFFICINA }).toString(),
    ).toBe(`name=Gomme+Rossi&metadata%5Bofficina_id%5D=${OFFICINA}`);
  });
});

describe('gestisciCheckout', () => {
  it('OPTIONS → 204 con CORS, senza toccare Stripe', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(null, null, 'OPTIONS'), dbFinto(PROVA), fetchFn);
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('GET → 405', async () => {
    const r = await esegui(richiesta(null, 'tok_titolare', 'GET'), dbFinto(PROVA));
    expect(r.status).toBe(405);
  });

  it.each(['STRIPE_SECRET_KEY', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO', 'SITO_URL'])(
    'manca %s → 503 PAGAMENTI_NON_ATTIVI, nessuna chiamata',
    async (nome) => {
      const fetchFn = stripeFinto();
      const db = dbFinto(PROVA, { utente: vi.fn(async () => UTENTI.tok_titolare ?? null) });
      const env = { ...ENV, [nome]: '' };
      const r = await esegui(richiesta(CORPO), db, fetchFn, env);
      expect(r.status).toBe(503);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(await r.json()).toEqual({ errore: 'PAGAMENTI_NON_ATTIVI' });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(db.utente).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['senza Authorization', null],
    ['token non valido', 'tok_sconosciuto'],
  ])('%s → 401', async (_nome, token) => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(CORPO, token), dbFinto(PROVA), fetchFn);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ errore: 'NON_AUTENTICATO' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('Authorization senza Bearer → 401', async () => {
    const req = new Request('http://localhost/stripe-checkout', {
      method: 'POST',
      headers: { Authorization: 'tok_titolare' },
      body: JSON.stringify(CORPO),
    });
    expect((await esegui(req, dbFinto(PROVA))).status).toBe(401);
  });

  it.each([
    ['JSON rotto', '{"officina_id":'],
    ['piano non valido', { officina_id: OFFICINA, piano: 'GRATIS' }],
    ['officina non uuid', { officina_id: 'gomme-rossi', piano: 'PRO' }],
  ])('%s → 400 RICHIESTA_NON_VALIDA', async (_nome, corpo) => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(corpo), dbFinto(PROVA), fetchFn);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ errore: 'RICHIESTA_NON_VALIDA' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['OPERATORE della stessa officina', 'tok_operatore', OFFICINA],
    ['titolare di un’altra officina', 'tok_titolare2', OFFICINA],
    ['titolare che chiede per un’officina non sua', 'tok_titolare', ALTRA_OFFICINA],
  ])('%s → 403 SOLO_TITOLARE, niente Stripe', async (_nome, token, officina) => {
    const fetchFn = stripeFinto();
    const db = dbFinto(PROVA);
    const r = await esegui(richiesta({ officina_id: officina, piano: 'PRO' }, token), db, fetchFn);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ errore: 'SOLO_TITOLARE' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(db.collegaCliente).not.toHaveBeenCalled();
  });

  it('piano PILOTA → 409 PILOTA', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto({ ...PROVA, piano: 'PILOTA' });
    const r = await esegui(richiesta(CORPO), db, fetchFn);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ errore: 'PILOTA' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('abbonamento ATTIVO → 409 GIA_ATTIVO (si usa il portale)', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto({
      piano: 'STARTER',
      stato: 'ATTIVO',
      stripe_customer_id: 'cus_esistente',
      stripe_subscription_id: 'sub_esistente',
    });
    const r = await esegui(richiesta({ officina_id: OFFICINA, piano: 'PRO' }), db, fetchFn);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ errore: 'GIA_ATTIVO' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['IN_ATTESA', { ragione_sociale: 'Pneus Express', stato_affiliazione: 'IN_ATTESA' }],
    ['SOSPESA', { ragione_sociale: 'Gomme Rossi', stato_affiliazione: 'SOSPESA' }],
    ['assente', null],
  ])('officina %s → 409 OFFICINA_NON_ATTIVA, niente Stripe', async (_nome, officina) => {
    const fetchFn = stripeFinto();
    const abbonamento = vi.fn(async () => PROVA);
    const db = dbFinto(PROVA, { officina: async () => officina, abbonamento });
    const r = await esegui(richiesta(CORPO), db, fetchFn);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ errore: 'OFFICINA_NON_ATTIVA' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(db.collegaCliente).not.toHaveBeenCalled();
    expect(abbonamento).not.toHaveBeenCalled(); // il controllo viene prima dell'abbonamento
  });

  it('officina non ATTIVA con abbonamento ATTIVO → OFFICINA_NON_ATTIVA (prima di GIA_ATTIVO)', async () => {
    const db = dbFinto(
      { ...PROVA, stato: 'ATTIVO', stripe_customer_id: 'cus_e', stripe_subscription_id: 'sub_e' },
      { officina: async () => ({ ragione_sociale: 'Gomme Rossi', stato_affiliazione: 'SOSPESA' }) },
    );
    const r = await esegui(richiesta(CORPO), db);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ errore: 'OFFICINA_NON_ATTIVA' });
  });

  it('OPERATORE di un’officina non ATTIVA → 403 SOLO_TITOLARE (il ruolo viene prima)', async () => {
    const db = dbFinto(PROVA, {
      officina: async () => ({ ragione_sociale: 'Gomme Rossi', stato_affiliazione: 'SOSPESA' }),
    });
    const r = await esegui(richiesta(CORPO, 'tok_operatore'), db);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ errore: 'SOLO_TITOLARE' });
  });

  it('SCADUTO con la subscription ancora collegata → 409 ABBONAMENTO_DA_SISTEMARE, niente Stripe', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto({
      piano: 'STARTER',
      stato: 'SCADUTO',
      stripe_customer_id: 'cus_esistente',
      stripe_subscription_id: 'sub_past_due',
    });
    const r = await esegui(richiesta({ officina_id: OFFICINA, piano: 'PRO' }), db, fetchFn);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ errore: 'ABBONAMENTO_DA_SISTEMARE' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(db.collegaCliente).not.toHaveBeenCalled();
  });

  it('SCADUTO senza subscription e senza cliente → 200, crea il cliente e apre il checkout', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto({ ...PROVA, stato: 'SCADUTO' });
    const r = await esegui(richiesta(CORPO), db, fetchFn);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ url: URL_SESSIONE });
    expect(chiamate).toEqual([
      'stripe customers',
      `collega ${OFFICINA} cus_finto`,
      'stripe checkout/sessions',
    ]);
  });

  it('Idempotency-Key cliente-<officina> solo sulla creazione del cliente, non sulla sessione', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(CORPO), dbFinto(PROVA), fetchFn);
    expect(r.status).toBe(200);

    const [urlCliente, initCliente] = fetchFn.mock.calls[0]!;
    expect(urlCliente).toBe('https://api.stripe.com/v1/customers');
    const intestazioniCliente = initCliente.headers as Record<string, string>;
    expect(intestazioniCliente['Idempotency-Key']).toBe(`cliente-${OFFICINA}`);

    const [urlSessione, initSessione] = fetchFn.mock.calls[1]!;
    expect(urlSessione).toBe('https://api.stripe.com/v1/checkout/sessions');
    const intestazioniSessione = initSessione.headers as Record<string, string>;
    expect(intestazioniSessione['Idempotency-Key']).toBeUndefined();
    expect(intestazioniSessione).toEqual({
      Authorization: 'Bearer sk_test_finta',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  it('abbonamento assente → 404', async () => {
    const r = await esegui(richiesta(CORPO), dbFinto(null));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ errore: 'ABBONAMENTO_NON_TROVATO' });
  });

  it('senza cliente Stripe: crea il cliente, lo collega PRIMA della sessione, risponde { url }', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto(PROVA);
    const r = await esegui(richiesta({ officina_id: OFFICINA, piano: 'PRO' }), db, fetchFn);

    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await r.json()).toEqual({ url: URL_SESSIONE });
    expect(chiamate).toEqual([
      'stripe customers',
      `collega ${OFFICINA} cus_finto`,
      'stripe checkout/sessions',
    ]);

    const [urlCliente, initCliente] = fetchFn.mock.calls[0]!;
    expect(urlCliente).toBe('https://api.stripe.com/v1/customers');
    expect(initCliente.headers).toEqual({
      Authorization: 'Bearer sk_test_finta',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `cliente-${OFFICINA}`,
    });
    expect(initCliente.body).toBe(
      `email=titolare%40prova.it&name=Gomme+Rossi&metadata%5Bofficina_id%5D=${OFFICINA}`,
    );

    const [urlSessione, initSessione] = fetchFn.mock.calls[1]!;
    expect(urlSessione).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(initSessione.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(initSessione.body as string))).toEqual({
      mode: 'subscription',
      customer: 'cus_finto',
      'line_items[0][price]': 'price_finto_pro',
      'line_items[0][quantity]': '1',
      'payment_method_types[0]': 'card',
      client_reference_id: OFFICINA,
      'subscription_data[metadata][officina_id]': OFFICINA,
      locale: 'it',
      success_url: `${SITO}/officina/abbonamento?pagamento=ok`,
      cancel_url: `${SITO}/officina/abbonamento?pagamento=annullato`,
    });
  });

  it('cliente Stripe già collegato: non si ricrea; STARTER usa il suo prezzo', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto({
      piano: 'STARTER',
      stato: 'SCADUTO',
      stripe_customer_id: 'cus_esistente',
      stripe_subscription_id: null,
    });
    const r = await esegui(richiesta(CORPO), db, fetchFn);

    expect(r.status).toBe(200);
    expect(chiamate).toEqual(['stripe checkout/sessions']);
    expect(db.collegaCliente).not.toHaveBeenCalled();
    const corpo = new URLSearchParams(fetchFn.mock.calls[0]![1].body as string);
    expect(corpo.get('customer')).toBe('cus_esistente');
    expect(corpo.get('line_items[0][price]')).toBe('price_finto_starter');
  });

  it('errore di Stripe sulla sessione → 502 STRIPE, messaggio solo nel log', async () => {
    const segreto = 'No such price: price_finto_starter';
    const fetchFn = stripeFinto({ percorso: 'checkout/sessions', messaggio: segreto });
    const r = await esegui(richiesta(CORPO), dbFinto(PROVA), fetchFn);

    expect(r.status).toBe(502);
    const testo = await r.text();
    expect(JSON.parse(testo)).toEqual({ errore: 'STRIPE' });
    expect(testo).not.toContain('price_finto');
    expect(console_error).toHaveBeenCalledWith(
      'Checkout di Stripe: errore di Stripe,',
      'sessione',
      segreto,
    );
  });

  it('errore di Stripe sul cliente → 502 STRIPE, nessun collegamento né sessione', async () => {
    const fetchFn = stripeFinto({ percorso: 'customers', messaggio: 'Invalid email address' });
    const db = dbFinto(PROVA);
    const r = await esegui(richiesta(CORPO), db, fetchFn);

    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ errore: 'STRIPE' });
    expect(chiamate).toEqual(['stripe customers']);
    expect(db.collegaCliente).not.toHaveBeenCalled();
  });

  it('collegamento fallito per una richiesta contemporanea: usa il cliente già collegato', async () => {
    const fetchFn = stripeFinto();
    const letture = [PROVA, { ...PROVA, stripe_customer_id: 'cus_altro' }];
    const db = dbFinto(PROVA, {
      abbonamento: async () => letture.shift() ?? null,
      collegaCliente: async () => {
        throw new Error('CLIENTE_STRIPE_DIVERSO');
      },
    });
    const r = await esegui(richiesta(CORPO), db, fetchFn);

    expect(r.status).toBe(200);
    const corpo = new URLSearchParams(fetchFn.mock.calls[1]![1].body as string);
    expect(corpo.get('customer')).toBe('cus_altro');
  });

  it('errore del database → 500 DATABASE, niente sessione, messaggio solo nel log', async () => {
    const fetchFn = stripeFinto();
    const db = dbFinto(PROVA, {
      collegaCliente: async () => {
        throw new Error('ABBONAMENTO_NON_TROVATO');
      },
      abbonamento: async () => PROVA,
    });
    const r = await esegui(richiesta(CORPO), db, fetchFn);

    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ errore: 'DATABASE' });
    expect(chiamate).toEqual(['stripe customers']);
  });
});
