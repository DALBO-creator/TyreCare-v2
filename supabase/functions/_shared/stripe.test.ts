import { describe, expect, it, vi } from 'vitest';
import { CORS, chiamaStripe, risposta, type FetchFn } from './stripe.ts';

const CHIAVE = 'sk_test_finta';

const fetchCon = (status: number, json: unknown) =>
  vi.fn<FetchFn>(async () => new Response(JSON.stringify(json), { status }));

describe('CORS e risposta', () => {
  it('intestazioni CORS esatte', () => {
    expect(CORS).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    });
  });

  it('risposta: JSON, status e CORS', async () => {
    const r = risposta({ errore: 'PROVA' }, 418);
    expect(r.status).toBe(418);
    expect(r.headers.get('Content-Type')).toBe('application/json');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
    expect(await r.json()).toEqual({ errore: 'PROVA' });
  });
});

describe('chiamaStripe', () => {
  it('POST form-urlencoded con la chiave; restituisce il JSON', async () => {
    const fetchFn = fetchCon(200, { id: 'cus_prova' });
    const parametri = new URLSearchParams([
      ['name', 'Gomme Rossi'],
      ['metadata[officina_id]', 'b0000000-0000-0000-0000-000000000001'],
    ]);

    expect(await chiamaStripe(fetchFn, CHIAVE, 'customers', parametri)).toEqual({
      id: 'cus_prova',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk_test_finta',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'name=Gomme+Rossi&metadata%5Bofficina_id%5D=b0000000-0000-0000-0000-000000000001',
    });
  });

  it('con chiaveIdempotenza: intestazione Idempotency-Key, il resto uguale', async () => {
    const fetchFn = fetchCon(200, { id: 'cus_prova' });
    await chiamaStripe(
      fetchFn,
      CHIAVE,
      'customers',
      new URLSearchParams([['name', 'Gomme Rossi']]),
      {
        chiaveIdempotenza: 'cliente-b0000000-0000-0000-0000-000000000001',
      },
    );
    expect(fetchFn).toHaveBeenCalledWith('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk_test_finta',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': 'cliente-b0000000-0000-0000-0000-000000000001',
      },
      body: 'name=Gomme+Rossi',
    });
  });

  it.each([
    ['senza quinto argomento', undefined],
    ['opzioni vuote', {}],
    ['chiave vuota', { chiaveIdempotenza: '' }],
  ])('%s: nessuna Idempotency-Key', async (_nome, opzioni) => {
    const fetchFn = fetchCon(200, { id: 'cs_prova' });
    await chiamaStripe(fetchFn, CHIAVE, 'checkout/sessions', new URLSearchParams(), opzioni);
    expect(fetchFn.mock.calls[0]![1].headers).toEqual({
      Authorization: 'Bearer sk_test_finta',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  it('errore di Stripe → lancia con il messaggio di Stripe', async () => {
    const fetchFn = fetchCon(400, { error: { message: 'No such price: price_finto_starter' } });
    await expect(
      chiamaStripe(fetchFn, CHIAVE, 'checkout/sessions', new URLSearchParams()),
    ).rejects.toThrow('No such price: price_finto_starter');
  });

  it('errore senza messaggio → "Errore di Stripe"', async () => {
    await expect(
      chiamaStripe(fetchCon(500, {}), CHIAVE, 'customers', new URLSearchParams()),
    ).rejects.toThrow('Errore di Stripe');
  });

  it('risposta non JSON → lancia', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('<html>', { status: 502 }));
    await expect(chiamaStripe(fetchFn, CHIAVE, 'customers', new URLSearchParams())).rejects.toThrow(
      'Errore di Stripe',
    );
  });
});
