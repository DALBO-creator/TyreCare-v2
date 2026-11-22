import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prenotazione } from './prenotazioni';
import {
  annullaPrenotazione,
  caricaClienteDellaPrenotazione,
  caricaMiePrenotazioni,
  caricaPrenotazione,
  caricaPrenotazioniOfficina,
  caricaServizio,
  caricaServizi,
  contaRichiesteDaConfermare,
  registraClienteDaPrenotazione,
  richiediPrenotazione,
  rispondiPrenotazione,
  rispondiProposta,
  type AzioneOfficina,
} from './prenotazioni';
import { ErroreModulo } from './errori';

import { azzeraFinto, chiamate, finto, from, rpc } from '../test/supabase-finto';

const sessione = vi.fn();

vi.mock('./supabase', async () => {
  const f = await import('../test/supabase-finto');
  return { getSupabase: () => ({ rpc: f.rpc, from: f.from }) };
});
vi.mock('./auth', () => ({ sessioneCorrente: () => sessione() }));

const ERRORE_DB = { message: 'X', code: '42501' };

beforeEach(() => {
  azzeraFinto();
  sessione.mockReturnValue(null);
});

describe('caricaMiePrenotazioni', () => {
  it('senza sessione restituisce [] e non interroga il database', async () => {
    expect(await caricaMiePrenotazioni()).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('con sessione filtra per cliente_id dell’utente e ordina dalla più recente', async () => {
    sessione.mockReturnValue({ user: { id: 'u-1' } });
    const righe = [{ id: 'p1' }, { id: 'p2' }];
    finto.risultato = { data: righe, error: null };
    expect(await caricaMiePrenotazioni()).toEqual(righe);
    expect(from).toHaveBeenCalledWith('prenotazioni');
    expect(chiamate).toContainEqual(['eq', 'cliente_id', 'u-1']);
    expect(chiamate.filter(([m]) => m === 'eq')).toHaveLength(1);
    expect(chiamate.filter(([m]) => m === 'order')).toEqual([
      ['order', 'giorno', { ascending: false }],
      ['order', 'created_at', { ascending: false }],
    ]);
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    sessione.mockReturnValue({ user: { id: 'u-1' } });
    finto.risultato = { data: null, error: ERRORE_DB };
    await expect(caricaMiePrenotazioni()).rejects.toBe(ERRORE_DB);
  });
});

describe('richiediPrenotazione', () => {
  const r = {
    servizio_id: 's-1',
    giorno: '2026-12-01',
    fascia: 'MATTINA',
    targa: 'ab 123cd',
    veicolo: 'Fiat Panda',
    telefono: '3331234567',
    note: 'Gomme invernali',
  } as unknown as Parameters<typeof richiediPrenotazione>[1];

  it('chiama la rpc con gli argomenti esatti e restituisce l’id', async () => {
    rpc.mockResolvedValue({ data: 'id-nuovo', error: null, status: 200 });
    expect(await richiediPrenotazione('o-1', r)).toBe('id-nuovo');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('richiedi_prenotazione', {
      p_officina_id: 'o-1',
      p_servizio_id: 's-1',
      p_giorno: '2026-12-01',
      p_fascia: 'MATTINA',
      p_targa: 'AB123CD',
      p_veicolo: 'Fiat Panda',
      p_telefono: '3331234567',
      p_note: 'Gomme invernali',
      p_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it('un errore sconosciuto viene rilanciato così com’è', async () => {
    rpc.mockResolvedValue({ data: null, error: ERRORE_DB, status: 403 });
    await expect(richiediPrenotazione('o-1', r)).rejects.toBe(ERRORE_DB);
  });

  it('un errore atteso diventa ErroreModulo con campo e codice', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FASCIA_PIENA' }, status: 400 });
    const e = await richiediPrenotazione('o-1', r).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroreModulo);
    expect(e).toMatchObject({
      message: 'Questa fascia si è appena riempita: scegli un altro giorno o fascia.',
      campo: 'fascia',
      codice: 'FASCIA_PIENA',
    });
  });
});

describe('rispondiPrenotazione', () => {
  const azioni: AzioneOfficina[] = [
    'CONFERMA',
    'PROPONI',
    'RIFIUTA',
    'COMPLETATA',
    'NON_PRESENTATO',
  ];

  it.each(azioni)('%s: rpc con id, azione e messaggio vuoto di default', async (azione) => {
    await rispondiPrenotazione('p-1', azione);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('rispondi_prenotazione', {
      p_id: 'p-1',
      p_azione: azione,
      p_messaggio: '',
    });
  });

  it('con appuntamento e messaggio li passa alla rpc', async () => {
    await rispondiPrenotazione('p-1', 'PROPONI', {
      appuntamento: '2026-12-02T09:30:00+01:00',
      messaggio: 'Alle 9:30 va bene?',
    });
    expect(rpc).toHaveBeenCalledWith('rispondi_prenotazione', {
      p_id: 'p-1',
      p_azione: 'PROPONI',
      p_appuntamento: '2026-12-02T09:30:00+01:00',
      p_messaggio: 'Alle 9:30 va bene?',
    });
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    rpc.mockResolvedValue({ data: null, error: ERRORE_DB, status: 403 });
    await expect(rispondiPrenotazione('p-1', 'CONFERMA')).rejects.toBe(ERRORE_DB);
  });

  it('STATO_NON_VALIDO diventa ErroreModulo', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'STATO_NON_VALIDO' }, status: 400 });
    await expect(rispondiPrenotazione('p-1', 'RIFIUTA')).rejects.toMatchObject({
      name: 'ErroreModulo',
      codice: 'STATO_NON_VALIDO',
    });
  });
});

describe('rispondiProposta', () => {
  it.each([true, false])('accetta=%s: rpc con argomenti esatti', async (accetta) => {
    await rispondiProposta('p-2', accetta);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('rispondi_proposta', { p_id: 'p-2', p_accetta: accetta });
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    rpc.mockResolvedValue({ data: null, error: ERRORE_DB, status: 500 });
    await expect(rispondiProposta('p-2', true)).rejects.toBe(ERRORE_DB);
  });
});

describe('annullaPrenotazione', () => {
  it('chiama annulla_prenotazione con l’id', async () => {
    await expect(annullaPrenotazione('p-3')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('annulla_prenotazione', { p_id: 'p-3' });
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    rpc.mockResolvedValue({ data: null, error: ERRORE_DB, status: 500 });
    await expect(annullaPrenotazione('p-3')).rejects.toBe(ERRORE_DB);
  });
});

describe('contaRichiesteDaConfermare', () => {
  it('restituisce il count con i filtri esatti (officina, stato RICHIESTA, giorno ≥ dal)', async () => {
    finto.risultato = { count: 4, error: null };
    expect(await contaRichiesteDaConfermare('o-1', '2026-11-13')).toBe(4);
    expect(from).toHaveBeenCalledWith('prenotazioni');
    expect(chiamate).toEqual([
      ['select', 'id', { count: 'exact', head: true }],
      ['eq', 'officina_id', 'o-1'],
      ['eq', 'stato', 'RICHIESTA'],
      ['gte', 'giorno', '2026-11-13'],
    ]);
  });

  it('count null → 0', async () => {
    finto.risultato = { count: null, error: null };
    expect(await contaRichiesteDaConfermare('o-1', '2026-11-13')).toBe(0);
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    finto.risultato = { count: null, error: ERRORE_DB };
    await expect(contaRichiesteDaConfermare('o-1', '2026-11-13')).rejects.toBe(ERRORE_DB);
  });
});

describe('registraClienteDaPrenotazione', () => {
  const p = { id: 'p-9', veicolo: 'Alfa Romeo Giulietta' } as unknown as Prenotazione;

  it('passa prenotazione, id nuovi e marca/modello; restituisce l’id del veicolo', async () => {
    rpc.mockResolvedValue({ data: 'veicolo-1', error: null, status: 200 });
    expect(await registraClienteDaPrenotazione(p)).toBe('veicolo-1');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('registra_cliente_da_prenotazione', {
      p_prenotazione: 'p-9',
      p_cliente_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_veicolo_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_marca: 'Alfa Romeo',
      p_modello: 'Giulietta',
    });
    const args = rpc.mock.calls[0]![1] as Record<string, string>;
    expect(args.p_cliente_id).not.toBe(args.p_veicolo_id);
  });

  it('un errore sconosciuto arriva al chiamante', async () => {
    rpc.mockResolvedValue({ data: null, error: ERRORE_DB, status: 500 });
    await expect(registraClienteDaPrenotazione(p)).rejects.toBe(ERRORE_DB);
  });

  it('PRENOTAZIONE_CHIUSA diventa ErroreModulo', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'PRENOTAZIONE_CHIUSA' }, status: 400 });
    await expect(registraClienteDaPrenotazione(p)).rejects.toMatchObject({
      name: 'ErroreModulo',
      codice: 'PRENOTAZIONE_CHIUSA',
    });
  });
});

describe('caricaPrenotazioniOfficina', () => {
  it('filtra per officina e dal giorno indicato, ordina per giorno, fascia e inserimento', async () => {
    const righe = [{ id: 'p1' }, { id: 'p2' }];
    finto.risultato = { data: righe, error: null };
    expect(await caricaPrenotazioniOfficina('o-1', '2026-12-01')).toEqual(righe);
    expect(from).toHaveBeenCalledWith('prenotazioni');
    expect(chiamate.filter(([m]) => m === 'eq')).toEqual([['eq', 'officina_id', 'o-1']]);
    expect(chiamate.filter(([m]) => m === 'gte')).toEqual([['gte', 'giorno', '2026-12-01']]);
    expect(chiamate.filter(([m]) => m === 'order')).toEqual([
      ['order', 'giorno'],
      ['order', 'fascia'],
      ['order', 'created_at'],
    ]);
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    finto.risultato = { data: null, error: ERRORE_DB };
    await expect(caricaPrenotazioniOfficina('o-1', '2026-12-01')).rejects.toBe(ERRORE_DB);
  });
});

describe('caricaPrenotazione', () => {
  it('cerca per id con maybeSingle e restituisce la riga', async () => {
    const riga = { id: 'p-1' };
    finto.risultato = { data: riga, error: null };
    expect(await caricaPrenotazione('p-1')).toBe(riga);
    expect(from).toHaveBeenCalledWith('prenotazioni');
    expect(chiamate.filter(([m]) => m === 'eq')).toEqual([['eq', 'id', 'p-1']]);
    expect(chiamate.filter(([m]) => m === 'maybeSingle')).toHaveLength(1);
  });

  it('riga assente: null', async () => {
    finto.risultato = { data: null, error: null };
    expect(await caricaPrenotazione('p-1')).toBeNull();
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    finto.risultato = { data: null, error: ERRORE_DB };
    await expect(caricaPrenotazione('p-1')).rejects.toBe(ERRORE_DB);
  });
});

describe('caricaClienteDellaPrenotazione', () => {
  const p = { id: 'p-1', officina_id: 'o-1', cliente_id: 'u-9' } as Prenotazione;

  it('filtra per officina e per account di chi ha prenotato, prende la scheda più vecchia', async () => {
    const scheda = { id: 'c-1', nome: 'Anna', cognome: 'Rossi' };
    finto.risultato = { data: scheda, error: null };
    expect(await caricaClienteDellaPrenotazione(p)).toBe(scheda);
    expect(from).toHaveBeenCalledWith('clienti_officina');
    // Esattamente due filtri: né di più né di meno (nessuna scheda di altre officine o altri utenti).
    expect(chiamate.filter(([m]) => m === 'eq')).toEqual([
      ['eq', 'officina_id', 'o-1'],
      ['eq', 'profile_id', 'u-9'],
    ]);
    expect(chiamate.filter(([m]) => m === 'order')).toEqual([['order', 'created_at']]);
    expect(chiamate.filter(([m]) => m === 'limit')).toEqual([['limit', 1]]);
    expect(chiamate.filter(([m]) => m === 'maybeSingle')).toHaveLength(1);
  });

  it('nessuna scheda collegata: null', async () => {
    finto.risultato = { data: null, error: null };
    expect(await caricaClienteDellaPrenotazione(p)).toBeNull();
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    finto.risultato = { data: null, error: ERRORE_DB };
    await expect(caricaClienteDellaPrenotazione(p)).rejects.toBe(ERRORE_DB);
  });
});

describe('caricaServizi', () => {
  it('filtra per officina e ordina per nome secondo l’italiano', async () => {
    // In ordine italiano: alfa, Équilibratura, Zeta (senza sort resterebbe Zeta, Équilibratura, alfa).
    finto.risultato = {
      data: [{ nome: 'Zeta' }, { nome: 'Équilibratura' }, { nome: 'alfa' }],
      error: null,
    };
    expect(await caricaServizi('o-1')).toEqual([
      { nome: 'alfa' },
      { nome: 'Équilibratura' },
      { nome: 'Zeta' },
    ]);
    expect(from).toHaveBeenCalledWith('servizi_officina');
    expect(chiamate.filter(([m]) => m === 'eq')).toEqual([['eq', 'officina_id', 'o-1']]);
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    finto.risultato = { data: null, error: ERRORE_DB };
    await expect(caricaServizi('o-1')).rejects.toBe(ERRORE_DB);
  });
});

describe('caricaServizio', () => {
  it('legge il servizio per id dalla tabella dei servizi, senza altri filtri', async () => {
    const riga = { id: 's-1', nome: 'Cambio gomme', officina_id: 'o-1' };
    finto.risultato = { data: riga, error: null };
    expect(await caricaServizio('s-1')).toEqual(riga);
    expect(from).toHaveBeenCalledWith('servizi_officina');
    expect(chiamate).toEqual([['select', '*'], ['eq', 'id', 's-1'], ['maybeSingle']]);
  });

  it('servizio assente: null', async () => {
    finto.risultato = { data: null, error: null };
    expect(await caricaServizio('s-1')).toBeNull();
  });

  it('un errore di Supabase arriva al chiamante', async () => {
    finto.risultato = { data: null, error: ERRORE_DB };
    await expect(caricaServizio('s-1')).rejects.toBe(ERRORE_DB);
  });
});
