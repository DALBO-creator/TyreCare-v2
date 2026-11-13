import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfficinaUtente } from './profilo';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc }) }));

import { ErroreModulo } from './errori';
import { eTitolare, giaSalvato, officinaAttiva, scegliOfficina, scollegaCliente } from './officina';

const officina = (id: string, ruolo: OfficinaUtente['ruolo']): OfficinaUtente => ({
  ruolo,
  officina: {
    id,
    ragione_sociale: `Officina ${id}`,
    citta: 'Torino',
    stato_affiliazione: 'ATTIVA',
  },
});

beforeEach(() => {
  const dati = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => dati.get(k) ?? null,
    setItem: (k: string, v: string) => void dati.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('officinaAttiva', () => {
  it('nessuna officina: undefined', () => {
    expect(officinaAttiva([])).toBeUndefined();
  });

  it('una officina senza scelta: quella', () => {
    const a = officina('a', 'TITOLARE');
    expect(officinaAttiva([a])).toBe(a);
  });

  it('scelta salvata valida: quella scelta', () => {
    const a = officina('a', 'TITOLARE');
    const b = officina('b', 'OPERATORE');
    scegliOfficina('b');
    expect(officinaAttiva([a, b])).toBe(b);
  });

  it('scelta salvata non più valida: la prima', () => {
    const a = officina('a', 'TITOLARE');
    const b = officina('b', 'OPERATORE');
    scegliOfficina('sparita');
    expect(officinaAttiva([a, b])).toBe(a);
  });

  it('senza scelta con due officine: la prima', () => {
    const a = officina('a', 'TITOLARE');
    expect(officinaAttiva([a, officina('b', 'TITOLARE')])).toBe(a);
  });

  it('localStorage che lancia: la prima, senza errori', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloccato');
      },
      setItem: () => {
        throw new Error('bloccato');
      },
    });
    const a = officina('a', 'TITOLARE');
    expect(officinaAttiva([a, officina('b', 'TITOLARE')])).toBe(a);
    expect(() => scegliOfficina('b')).not.toThrow();
  });
});

describe('eTitolare', () => {
  const lista = [officina('a', 'TITOLARE'), officina('b', 'OPERATORE')];

  it('vero per titolare della stessa officina', () => {
    expect(eTitolare(lista, 'a')).toBe(true);
  });

  it('falso per operatore della stessa officina', () => {
    expect(eTitolare(lista, 'b')).toBe(false);
  });

  it('falso per titolare di un’altra officina', () => {
    expect(eTitolare([officina('a', 'TITOLARE')], 'b')).toBe(false);
  });

  it('lista vuota: falso', () => {
    expect(eTitolare([], 'a')).toBe(false);
  });
});

describe('giaSalvato', () => {
  it('23505 sulla chiave primaria della tabella: vero', () => {
    const e = { code: '23505', message: 'duplicate key value violates "clienti_officina_pkey"' };
    expect(giaSalvato(e, 'clienti_officina')).toBe(true);
  });

  it('23505 su un altro vincolo: falso', () => {
    const e = {
      code: '23505',
      message: 'duplicate key value violates "clienti_officina_targa_key"',
    };
    expect(giaSalvato(e, 'clienti_officina')).toBe(false);
  });

  it('23505 sulla chiave primaria di un’altra tabella: falso', () => {
    const e = { code: '23505', message: 'duplicate key value violates "veicoli_pkey"' };
    expect(giaSalvato(e, 'clienti_officina')).toBe(false);
  });

  it('altro codice con _pkey nel messaggio: falso', () => {
    const e = { code: '23503', message: 'clienti_officina_pkey' };
    expect(giaSalvato(e, 'clienti_officina')).toBe(false);
  });

  it('errore senza codice: falso', () => {
    expect(giaSalvato(new Error('clienti_officina_pkey'), 'clienti_officina')).toBe(false);
  });

  it('vincolo il cui nome finisce come la chiave primaria (x_veicoli_pkey): falso', () => {
    const e = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "x_veicoli_pkey"',
    };
    expect(giaSalvato(e, 'veicoli')).toBe(false);
  });

  it('messaggio reale di Postgres sulla chiave primaria (veicoli_pkey): vero', () => {
    const e = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "veicoli_pkey"',
    };
    expect(giaSalvato(e, 'veicoli')).toBe(true);
  });
});

describe('scollegaCliente', () => {
  beforeEach(() => rpc.mockReset());

  it('chiama la funzione con il cliente', async () => {
    rpc.mockResolvedValue({ error: null });
    await scollegaCliente('c1');
    expect(rpc).toHaveBeenCalledWith('scollega_cliente', { p_cliente_id: 'c1' });
  });

  it('CLIENTE_NON_COLLEGATO: messaggio in italiano', async () => {
    rpc.mockResolvedValue({ error: { message: 'CLIENTE_NON_COLLEGATO', code: 'P0001' } });
    const e = await scollegaCliente('c1').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroreModulo);
    expect((e as Error).message).toBe('Il cliente non è più collegato: ricarica la pagina.');
  });

  it('42501: solo il titolare', async () => {
    rpc.mockResolvedValue({ error: { message: 'Accesso riservato', code: '42501' } });
    await expect(scollegaCliente('c1')).rejects.toThrow(
      'Solo il titolare può scollegare un cliente.',
    );
  });

  it('errore sconosciuto: rilanciato', async () => {
    const errore = { message: 'boh', code: 'XX000' };
    rpc.mockResolvedValue({ error: errore });
    await expect(scollegaCliente('c1')).rejects.toBe(errore);
  });
});
