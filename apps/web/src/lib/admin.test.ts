import { describe, expect, it, vi } from 'vitest';
import {
  ERRORI_RIFIUTO,
  formattaDataOra,
  leggiAbbonamentoEmbed,
  leggiVersioneDatabase,
  nomeAutore,
  ordinaOfficineAdmin,
  rifiutaAffiliazione,
  statoDatabase,
} from './admin';

const rpc = vi.fn();
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc }) }));

type S = 'IN_ATTESA' | 'ATTIVA' | 'SOSPESA';
const o = (id: string, stato: S, created_at: string) => ({
  id,
  stato_affiliazione: stato,
  created_at,
});

describe('ordinaOfficineAdmin', () => {
  it('mette prima le in attesa, poi le altre dalla più recente', () => {
    const r = ordinaOfficineAdmin([
      o('a', 'ATTIVA', '2026-10-05T10:00:00Z'),
      o('b', 'IN_ATTESA', '2026-10-01T10:00:00Z'),
      o('c', 'SOSPESA', '2026-10-09T10:00:00Z'),
      o('d', 'IN_ATTESA', '2026-10-03T10:00:00Z'),
    ]);
    expect(r.map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('non modifica l’elenco ricevuto e accetta l’elenco vuoto', () => {
    const entrata = [o('a', 'ATTIVA', '2026-10-05T10:00:00Z'), o('b', 'IN_ATTESA', '2026-10-01')];
    ordinaOfficineAdmin(entrata);
    expect(entrata.map((x) => x.id)).toEqual(['a', 'b']);
    expect(ordinaOfficineAdmin([])).toEqual([]);
  });
});

describe('nomeAutore', () => {
  it('unisce nome e cognome e dà vuoto se il profilo manca', () => {
    expect(nomeAutore({ nome: 'Anna', cognome: 'Rossi' })).toBe('Anna Rossi');
    expect(nomeAutore({ nome: 'Anna', cognome: '' })).toBe('Anna');
    expect(nomeAutore(null)).toBe('');
    expect(nomeAutore(undefined)).toBe('');
  });
});

describe('formattaDataOra', () => {
  it('usa il fuso di Roma (ora legale e solare)', () => {
    // Il separatore tra data e ora dipende dalla versione di ICU: si controllano le parti
    expect(formattaDataOra('2026-07-01T10:05:00Z')).toMatch(/^1 luglio 2026.*12:05$/);
    expect(formattaDataOra('2026-12-01T10:05:00Z')).toMatch(/^1 dicembre 2026.*11:05$/);
  });
});

describe('leggiAbbonamentoEmbed', () => {
  it('legge l’oggetto, l’array e il valore assente', () => {
    const a = { piano: 'PILOTA', stato: 'PROVA' } as const;
    const atteso = { piano: 'PILOTA', statoAbbonamento: 'PROVA' };
    expect(leggiAbbonamentoEmbed(a)).toEqual(atteso);
    expect(leggiAbbonamentoEmbed([a])).toEqual(atteso);
    expect(leggiAbbonamentoEmbed([])).toEqual({ piano: null, statoAbbonamento: null });
    expect(leggiAbbonamentoEmbed(null)).toEqual({ piano: null, statoAbbonamento: null });
  });
});

describe('rifiutaAffiliazione', () => {
  const messaggi: Record<string, string> = {
    OFFICINA_NON_TROVATA: 'Officina non trovata: ricarica la pagina e riprova.',
    OFFICINA_NON_IN_ATTESA: 'Questa officina non è più in attesa: ricarica la pagina.',
    ABBONAMENTO_STRIPE_PRESENTE:
      'Questa officina ha un abbonamento su Stripe: annullalo prima dalla dashboard di Stripe.',
    MOTIVO_TROPPO_LUNGO: 'Il motivo è troppo lungo (al massimo 300 caratteri).',
  };

  it('la mappa ha esattamente le chiavi della funzione SQL', () => {
    expect(ERRORI_RIFIUTO).toEqual(messaggi);
  });

  it('chiama la funzione solo con l’id e non dà errori se va a buon fine', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await expect(rifiutaAffiliazione('abc')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenLastCalledWith('rifiuta_affiliazione', { p_officina_id: 'abc' });
  });

  it('manda il motivo senza spazi ai bordi', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await rifiutaAffiliazione('abc', '  Partita IVA non valida \n');
    expect(rpc).toHaveBeenLastCalledWith('rifiuta_affiliazione', {
      p_officina_id: 'abc',
      p_motivo: 'Partita IVA non valida',
    });
  });

  it('un motivo di soli spazi non viene mandato', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await rifiutaAffiliazione('abc', '   ');
    expect(rpc).toHaveBeenLastCalledWith('rifiuta_affiliazione', { p_officina_id: 'abc' });
  });

  for (const [chiave, messaggio] of Object.entries(messaggi)) {
    it(`${chiave} → messaggio esatto e chiave nell’errore`, async () => {
      rpc.mockResolvedValueOnce({ error: { message: chiave } });
      await expect(rifiutaAffiliazione('abc')).rejects.toMatchObject({ message: messaggio });
    });
  }

  it('42501 → solo l’amministratore', async () => {
    rpc.mockResolvedValueOnce({ error: { code: '42501', message: 'Accesso riservato' } });
    await expect(rifiutaAffiliazione('abc')).rejects.toMatchObject({
      message: "Solo l'amministratore può farlo.",
    });
  });

  it('una chiave sconosciuta (anche "toString") viene rilanciata com’è', async () => {
    const errore = { message: 'ALTRO' };
    rpc.mockResolvedValueOnce({ error: errore });
    await expect(rifiutaAffiliazione('abc')).rejects.toBe(errore);
    const strano = { message: 'toString' };
    rpc.mockResolvedValueOnce({ error: strano });
    await expect(rifiutaAffiliazione('abc')).rejects.toBe(strano);
  });
});

describe('statoDatabase', () => {
  it('confronta la migrazione attesa con quella del database', () => {
    expect(statoDatabase('20261108000200', '20261108000200')).toBe('AGGIORNATO');
    expect(statoDatabase('20261108000200', '20261107000100')).toBe('INDIETRO');
    expect(statoDatabase('20261108000200', '20261109000000')).toBe('AVANTI');
  });

  it('funzione assente (null) = indietro; attesa vuota = sconosciuto', () => {
    expect(statoDatabase('20261108000200', null)).toBe('INDIETRO');
    expect(statoDatabase('', '20261108000200')).toBe('SCONOSCIUTO');
    expect(statoDatabase('', null)).toBe('SCONOSCIUTO');
  });

  it('usa solo i primi 14 caratteri della versione presente', () => {
    expect(statoDatabase('20261108000200', '20261108000200_extra')).toBe('AGGIORNATO');
  });
});

describe('leggiVersioneDatabase', () => {
  it('restituisce la versione', async () => {
    rpc.mockResolvedValueOnce({ data: '20261108000200', error: null });
    expect(await leggiVersioneDatabase()).toBe('20261108000200');
    expect(rpc).toHaveBeenLastCalledWith('versione_database');
  });

  it('funzione assente (PGRST202 o 42883) = null', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'x' } });
    expect(await leggiVersioneDatabase()).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'x' } });
    expect(await leggiVersioneDatabase()).toBeNull();
  });

  it('gli altri errori vengono rilanciati', async () => {
    const errore = { code: '42501', message: 'negato' };
    rpc.mockResolvedValueOnce({ data: null, error: errore });
    await expect(leggiVersioneDatabase()).rejects.toBe(errore);
  });
});
