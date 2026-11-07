import { describe, expect, it } from 'vitest';
import {
  aggiornamentoDaEvento,
  errorePermanente,
  pianoDaPrezzo,
  statoDaStripe,
  subscriptionIgnorata,
} from './eventi.ts';

const PREZZI = { starter: 'price_starter_prova', pro: 'price_pro_prova' };
const OFFICINA = 'b0000000-0000-0000-0000-000000000001';

describe('statoDaStripe', () => {
  it.each([
    ['active', 'ATTIVO'],
    ['trialing', 'ATTIVO'],
    ['past_due', 'SCADUTO'],
    ['unpaid', 'SCADUTO'],
    ['incomplete_expired', 'SCADUTO'],
    ['paused', 'SCADUTO'],
    ['canceled', 'ANNULLATO'],
    ['incomplete', null],
    ['sconosciuto', null],
    [undefined, null],
  ])('%s → %s', (status, atteso) => {
    expect(statoDaStripe(status)).toBe(atteso);
  });
});

describe('pianoDaPrezzo', () => {
  it('prezzi configurati → STARTER e PRO', () => {
    expect(pianoDaPrezzo('price_starter_prova', PREZZI)).toBe('STARTER');
    expect(pianoDaPrezzo('price_pro_prova', PREZZI)).toBe('PRO');
  });

  it('prezzo sconosciuto, mancante o vuoto → null', () => {
    expect(pianoDaPrezzo('price_altro', PREZZI)).toBeNull();
    expect(pianoDaPrezzo(undefined, PREZZI)).toBeNull();
    expect(pianoDaPrezzo('', PREZZI)).toBeNull();
  });

  it('prezzi non configurati → null (mai una corrispondenza con il vuoto)', () => {
    expect(pianoDaPrezzo('price_starter_prova', {})).toBeNull();
    expect(pianoDaPrezzo('', { starter: '', pro: null })).toBeNull();
  });
});

const abbonamento = (tipo: string, oggetto: Record<string, unknown> = {}) => ({
  id: 'evt_prova',
  type: tipo,
  data: {
    object: {
      id: 'sub_prova',
      customer: 'cus_prova',
      status: 'active',
      metadata: { officina_id: OFFICINA },
      items: {
        data: [{ price: { id: 'price_pro_prova' } }, { price: { id: 'price_starter_prova' } }],
      },
      ...oggetto,
    },
  },
});

describe('aggiornamentoDaEvento', () => {
  it('checkout.session.completed in abbonamento → ATTIVO, officina dal client_reference_id', () => {
    const evento = {
      id: 'evt_prova',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          client_reference_id: OFFICINA,
          customer: 'cus_prova',
          subscription: 'sub_prova',
        },
      },
    };
    expect(aggiornamentoDaEvento(evento, PREZZI)).toEqual({
      officina_id: OFFICINA,
      customer: 'cus_prova',
      subscription: 'sub_prova',
      stato: 'ATTIVO',
      piano: null,
    });
  });

  it('checkout.session.completed con customer e subscription espansi → gli id', () => {
    const evento = {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          client_reference_id: OFFICINA,
          customer: { id: 'cus_prova' },
          subscription: { id: 'sub_prova' },
        },
      },
    };
    expect(aggiornamentoDaEvento(evento, PREZZI)).toMatchObject({
      customer: 'cus_prova',
      subscription: 'sub_prova',
    });
  });

  it('checkout.session.completed di un pagamento singolo → null', () => {
    const evento = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', client_reference_id: OFFICINA } },
    };
    expect(aggiornamentoDaEvento(evento, PREZZI)).toBeNull();
  });

  it('client_reference_id che non è un uuid → officina null', () => {
    const evento = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', client_reference_id: 'abc', subscription: 'sub_x' } },
    };
    expect(aggiornamentoDaEvento(evento, PREZZI)).toMatchObject({
      officina_id: null,
      subscription: 'sub_x',
      customer: null,
    });
  });

  it('customer.subscription.created → stato e piano (dal primo prezzo)', () => {
    expect(aggiornamentoDaEvento(abbonamento('customer.subscription.created'), PREZZI)).toEqual({
      officina_id: OFFICINA,
      customer: 'cus_prova',
      subscription: 'sub_prova',
      stato: 'ATTIVO',
      piano: 'PRO',
    });
  });

  it('customer.subscription.updated past_due → SCADUTO, piano STARTER', () => {
    const evento = abbonamento('customer.subscription.updated', {
      status: 'past_due',
      items: { data: [{ price: { id: 'price_starter_prova' } }] },
    });
    expect(aggiornamentoDaEvento(evento, PREZZI)).toMatchObject({
      stato: 'SCADUTO',
      piano: 'STARTER',
    });
  });

  it('customer.subscription.updated senza metadata e con prezzo sconosciuto → officina e piano null', () => {
    const evento = abbonamento('customer.subscription.updated', {
      metadata: {},
      items: { data: [{ price: { id: 'price_altro' } }] },
    });
    expect(aggiornamentoDaEvento(evento, PREZZI)).toEqual({
      officina_id: null,
      customer: 'cus_prova',
      subscription: 'sub_prova',
      stato: 'ATTIVO',
      piano: null,
    });
  });

  it('customer.subscription.updated con status da ignorare (incomplete) → null', () => {
    const evento = abbonamento('customer.subscription.updated', { status: 'incomplete' });
    expect(aggiornamentoDaEvento(evento, PREZZI)).toBeNull();
  });

  it('customer.subscription.deleted → sempre ANNULLATO, anche con status active', () => {
    const evento = abbonamento('customer.subscription.deleted', { status: 'active', items: {} });
    expect(aggiornamentoDaEvento(evento, PREZZI)).toEqual({
      officina_id: OFFICINA,
      customer: 'cus_prova',
      subscription: 'sub_prova',
      stato: 'ANNULLATO',
      piano: null,
    });
  });

  it('altri eventi o eventi malformati → null', () => {
    expect(aggiornamentoDaEvento(abbonamento('invoice.paid'), PREZZI)).toBeNull();
    expect(aggiornamentoDaEvento({ type: 'customer.subscription.updated' }, PREZZI)).toBeNull();
    expect(aggiornamentoDaEvento(null, PREZZI)).toBeNull();
    expect(aggiornamentoDaEvento('evento', PREZZI)).toBeNull();
  });
});

describe('errorePermanente', () => {
  it.each([
    ['ABBONAMENTO_NON_TROVATO', true],
    ['STATO_NON_VALIDO', true],
    ['PIANO_NON_VALIDO', true],
    ['CLIENTE_STRIPE_DIVERSO', true],
    ['SUBSCRIPTION_DI_ALTRA_OFFICINA', true],
    ['TypeError: fetch failed', false],
    ['', false],
    ['errore: ABBONAMENTO_NON_TROVATO (riga 3)', false],
    [' STATO_NON_VALIDO', false],
    ['abbonamento_non_trovato', false],
  ])('%j → %s', (messaggio, atteso) => {
    expect(errorePermanente(messaggio)).toBe(atteso);
  });
});

describe('subscriptionIgnorata', () => {
  it("abbonamento collegato a un'altra subscription → true", () => {
    expect(subscriptionIgnorata({ subscription: 'sub_vecchia' }, 'sub_nuova')).toBe(true);
  });

  it('stessa subscription (evento applicato) → false', () => {
    expect(subscriptionIgnorata({ subscription: 'sub_prova' }, 'sub_prova')).toBe(false);
  });

  it('nessuna subscription collegata → false', () => {
    expect(subscriptionIgnorata({ subscription: 'sub_prova' }, null)).toBe(false);
    expect(subscriptionIgnorata({ subscription: 'sub_prova' }, '')).toBe(false);
  });

  it('evento senza subscription → false', () => {
    expect(subscriptionIgnorata({ subscription: null }, 'sub_prova')).toBe(false);
  });
});
