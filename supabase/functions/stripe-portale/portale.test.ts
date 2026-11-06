import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchFn } from '../_shared/stripe.ts';
import { gestisciPortale, leggiCorpo, parametriPortale, type DbPortale } from './portale.ts';

const OFFICINA = 'b0000000-0000-0000-0000-000000000001';
const ALTRA_OFFICINA = 'b0000000-0000-0000-0000-000000000002';
const TITOLARE = 'a0000000-0000-0000-0000-000000000002';
const OPERATORE = 'a0000000-0000-0000-0000-000000000003';
const TITOLARE2 = 'a0000000-0000-0000-0000-000000000005';
const SITO = 'https://tyrecare.prova';
const URL_PORTALE = 'https://billing.stripe.com/p/session/test_finta';

const ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_finta',
  SITO_URL: SITO,
};

const UTENTI: Record<string, { id: string }> = {
  tok_titolare: { id: TITOLARE },
  tok_operatore: { id: OPERATORE },
  tok_titolare2: { id: TITOLARE2 },
};
const RUOLI: Record<string, string> = {
  [`${OFFICINA}/${TITOLARE}`]: 'TITOLARE',
  [`${OFFICINA}/${OPERATORE}`]: 'OPERATORE',
  [`${ALTRA_OFFICINA}/${TITOLARE2}`]: 'TITOLARE',
};

let console_error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  console_error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console_error.mockRestore();
});

type Abbonamento = { stripe_customer_id: string | null } | null;

function dbFinto(abbonamento: Abbonamento, altro: Partial<DbPortale> = {}): DbPortale {
  return {
    utente: async (token) => UTENTI[token] ?? null,
    ruolo: async (officina, utente) => RUOLI[`${officina}/${utente}`] ?? null,
    abbonamento: vi.fn(async () => abbonamento),
    ...altro,
  };
}

const CON_CLIENTE: Abbonamento = { stripe_customer_id: 'cus_finto' };

/** Stripe finto: risponde con la sessione del portale (o con un errore / una sessione senza url). */
function stripeFinto(risposta: 'ok' | 'errore' | 'senza-url' = 'ok') {
  return vi.fn<FetchFn>(async () => {
    if (risposta === 'errore') {
      return Response.json(
        { error: { message: 'No configuration provided (segreto)' } },
        { status: 400 },
      );
    }
    if (risposta === 'senza-url') return Response.json({ id: 'bps_finta' });
    return Response.json({ id: 'bps_finta', url: URL_PORTALE });
  });
}

const richiesta = (corpo: unknown, token: string | null = 'tok_titolare', metodo = 'POST') =>
  new Request('http://localhost/stripe-portale', {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(metodo === 'POST'
      ? { body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }
      : {}),
  });

const CORPO = { officina_id: OFFICINA };

const esegui = (
  req: Request,
  db: DbPortale,
  fetchFn: FetchFn = stripeFinto(),
  env: Record<string, string> = ENV,
) => gestisciPortale(req, { env: (n) => env[n], fetchFn, db });

describe('leggiCorpo', () => {
  it('corpo valido (campi in più ignorati)', () => {
    expect(leggiCorpo({ officina_id: OFFICINA })).toBe(OFFICINA);
    expect(leggiCorpo({ officina_id: OFFICINA, piano: 'PRO' })).toBe(OFFICINA);
  });

  it.each([
    ['null', null],
    ['stringa', OFFICINA],
    ['array', [OFFICINA]],
    ['senza officina', {}],
    ['officina numero', { officina_id: 1 }],
    ['officina non uuid', { officina_id: '1 or 1=1' }],
  ])('%s → null', (_nome, json) => {
    expect(leggiCorpo(json)).toBeNull();
  });
});

describe('parametriPortale', () => {
  it('customer e return_url esatti (barra finale del sito tolta)', () => {
    const p = parametriPortale({ customer: 'cus_finto', sito: `${SITO}/` });
    expect(Object.fromEntries(p)).toEqual({
      customer: 'cus_finto',
      return_url: `${SITO}/officina/abbonamento`,
    });
    expect([...p.keys()]).toHaveLength(2);
  });
});

describe('gestisciPortale', () => {
  it('OPTIONS → 204 con CORS, senza toccare Stripe', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(null, null, 'OPTIONS'), dbFinto(CON_CLIENTE), fetchFn);
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('GET → 405 METODO_NON_AMMESSO', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(null, 'tok_titolare', 'GET'), dbFinto(CON_CLIENTE), fetchFn);
    expect(r.status).toBe(405);
    expect(await r.json()).toEqual({ errore: 'METODO_NON_AMMESSO' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each(['STRIPE_SECRET_KEY', 'SITO_URL'])(
    'manca %s → 503 PAGAMENTI_NON_ATTIVI, nessuna chiamata',
    async (nome) => {
      const fetchFn = stripeFinto();
      const db = dbFinto(CON_CLIENTE, { utente: vi.fn(async () => UTENTI.tok_titolare ?? null) });
      const r = await esegui(richiesta(CORPO), db, fetchFn, { ...ENV, [nome]: '' });
      expect(r.status).toBe(503);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(await r.json()).toEqual({ errore: 'PAGAMENTI_NON_ATTIVI' });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(db.utente).not.toHaveBeenCalled();
    },
  );

  it('senza prezzi Stripe (non servono al portale) → 200', async () => {
    const r = await esegui(richiesta(CORPO), dbFinto(CON_CLIENTE));
    expect(r.status).toBe(200);
  });

  it.each([
    ['senza Authorization', null],
    ['token non valido', 'tok_sconosciuto'],
  ])('%s → 401 NON_AUTENTICATO', async (_nome, token) => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(CORPO, token), dbFinto(CON_CLIENTE), fetchFn);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ errore: 'NON_AUTENTICATO' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('Authorization senza Bearer → 401', async () => {
    const req = new Request('http://localhost/stripe-portale', {
      method: 'POST',
      headers: { Authorization: 'tok_titolare' },
      body: JSON.stringify(CORPO),
    });
    const r = await esegui(req, dbFinto(CON_CLIENTE));
    expect(r.status).toBe(401);
  });

  it.each([
    ['JSON rotto', '{officina'],
    ['officina non uuid', { officina_id: 'xyz' }],
    ['corpo vuoto', {}],
  ])('%s → 400 RICHIESTA_NON_VALIDA', async (_nome, corpo) => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(corpo), dbFinto(CON_CLIENTE), fetchFn);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ errore: 'RICHIESTA_NON_VALIDA' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['OPERATORE della stessa officina', 'tok_operatore'],
    ['TITOLARE di un’altra officina', 'tok_titolare2'],
  ])('%s → 403 SOLO_TITOLARE, niente abbonamento né Stripe', async (_nome, token) => {
    const fetchFn = stripeFinto();
    const db = dbFinto(CON_CLIENTE);
    const r = await esegui(richiesta(CORPO, token), db, fetchFn);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ errore: 'SOLO_TITOLARE' });
    expect(db.abbonamento).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('abbonamento assente → 404 ABBONAMENTO_NON_TROVATO', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(CORPO), dbFinto(null), fetchFn);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ errore: 'ABBONAMENTO_NON_TROVATO' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('abbonamento senza cliente Stripe → 409 NESSUN_PAGAMENTO, nessuna chiamata a Stripe', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(CORPO), dbFinto({ stripe_customer_id: null }), fetchFn);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ errore: 'NESSUN_PAGAMENTO' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cliente Stripe collegato → una sola POST a billing_portal/sessions, 200 { url }', async () => {
    const fetchFn = stripeFinto();
    const r = await esegui(richiesta(CORPO), dbFinto(CON_CLIENTE), fetchFn, {
      ...ENV,
      SITO_URL: `${SITO}/`,
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await r.json()).toEqual({ url: URL_PORTALE });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer sk_test_finta',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(init.body).toBe(
      `customer=cus_finto&return_url=${encodeURIComponent(`${SITO}/officina/abbonamento`)}`,
    );
  });

  it('errore di Stripe → 502 STRIPE, messaggio solo nel log', async () => {
    const r = await esegui(richiesta(CORPO), dbFinto(CON_CLIENTE), stripeFinto('errore'));
    expect(r.status).toBe(502);
    const testo = await r.text();
    expect(JSON.parse(testo)).toEqual({ errore: 'STRIPE' });
    expect(testo).not.toContain('segreto');
    expect(console_error).toHaveBeenCalled();
  });

  it('sessione senza url → 502 STRIPE', async () => {
    const r = await esegui(richiesta(CORPO), dbFinto(CON_CLIENTE), stripeFinto('senza-url'));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ errore: 'STRIPE' });
  });

  it.each([
    ['utente', { utente: async () => Promise.reject(new Error('auth giù')) }],
    ['ruolo', { ruolo: async () => Promise.reject(new Error('ruolo giù')) }],
    ['abbonamento', { abbonamento: async () => Promise.reject(new Error('abb giù')) }],
  ] as [string, Partial<DbPortale>][])(
    'errore del database (%s) → 500 DATABASE, niente Stripe',
    async (_nome, altro) => {
      const fetchFn = stripeFinto();
      const r = await esegui(richiesta(CORPO), dbFinto(CON_CLIENTE, altro), fetchFn);
      expect(r.status).toBe(500);
      const testo = await r.text();
      expect(JSON.parse(testo)).toEqual({ errore: 'DATABASE' });
      expect(testo).not.toContain('giù');
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );
});
