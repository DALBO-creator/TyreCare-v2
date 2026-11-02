import { describe, expect, it } from 'vitest';
import { ErroreModulo } from './errori';
import {
  DatiEStradaSchema,
  ImpostazioniStradaSchema,
  MESSAGGI,
  linkMappa,
  scadeAlle,
  soloAccettateDi,
  telefonoHref,
  traduci,
} from './strada-officina';

const OFFICINA = 'b0000000-0000-4000-8000-000000000001';
const ALTRA = 'b0000000-0000-4000-8000-000000000002';
const ADESSO = new Date('2026-11-02T12:00:00Z');

const riga = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  stato: 'ACCETTATA',
  officina_id: OFFICINA,
  accettata_il: '2026-11-02T10:00:00Z',
  scade_il: '2026-11-02T11:00:00Z',
  ...extra,
});

describe('soloAccettateDi', () => {
  it('tiene solo le richieste accettate dall’officina indicata (la RLS ne fa leggere altre)', () => {
    const righe = [
      riga('mia'),
      riga('altra-officina', { officina_id: ALTRA }),
      riga('senza-officina', { officina_id: null }),
      riga('aperta', { stato: 'APERTA' }),
      riga('chiusa', { stato: 'CHIUSA' }),
    ];
    expect(soloAccettateDi(righe, OFFICINA, ADESSO).map((r) => r.id)).toEqual(['mia']);
  });

  it('scarta le accettate da più di 24 ore e ordina dalla più recente', () => {
    const righe = [
      riga('vecchia', { accettata_il: '2026-11-01T11:00:00Z' }),
      riga('prima', { accettata_il: '2026-11-02T08:00:00Z' }),
      riga('dopo', { accettata_il: '2026-11-02T11:30:00Z' }),
    ];
    expect(soloAccettateDi(righe, OFFICINA, ADESSO).map((r) => r.id)).toEqual(['dopo', 'prima']);
  });

  it('elenco vuoto se nessuna è dell’officina', () => {
    expect(soloAccettateDi([riga('x', { officina_id: ALTRA })], OFFICINA, ADESSO)).toEqual([]);
  });
});

describe('traduci', () => {
  it('RICHIESTA_NON_DISPONIBILE diventa un messaggio chiaro', () => {
    const e = traduci({ message: 'RICHIESTA_NON_DISPONIBILE' });
    expect(e).toBeInstanceOf(ErroreModulo);
    expect((e as ErroreModulo).message).toBe(MESSAGGI.RICHIESTA_NON_DISPONIBILE);
    expect((e as ErroreModulo).codice).toBe('RICHIESTA_NON_DISPONIBILE');
  });

  it('42501 (officina senza requisiti o fuori raggio) ha un messaggio suo, non quello grezzo', () => {
    const e = traduci({ message: 'Accesso negato', code: '42501' } as { message: string });
    expect(e).toBeInstanceOf(ErroreModulo);
    expect((e as ErroreModulo).message).not.toContain('Accesso negato');
    expect((e as ErroreModulo).codice).toBe('42501');
  });

  it('un errore non atteso resta com’è', () => {
    const grezzo = { message: 'boom', code: 'XX000' };
    expect(traduci(grezzo)).toBe(grezzo);
    expect(traduci(null)).toBeNull();
  });
});

describe('ImpostazioniStradaSchema', () => {
  const esito = (raggio: string, spunta?: string) =>
    ImpostazioniStradaSchema.safeParse({ intervento_strada: spunta, raggio_strada_km: raggio });

  it('accetta interi da 5 a 100', () => {
    for (const km of ['5', '50', '100', ' 30 ']) expect(esito(km).success).toBe(true);
    expect(esito('50', 'on').data).toEqual({ intervento_strada: true, raggio_strada_km: 50 });
    expect(esito('50').data).toEqual({ intervento_strada: false, raggio_strada_km: 50 });
  });

  it('rifiuta fuori intervallo, decimali, vuoti e testo', () => {
    for (const km of ['4', '101', '0', '-5', '12,5', '12.5', '', 'abc', '1e2']) {
      const r = esito(km);
      expect(r.success, km).toBe(false);
      expect(String(r.error?.issues[0]?.path[0])).toBe('raggio_strada_km');
    }
  });
});

describe('DatiEStradaSchema', () => {
  const base = {
    indirizzo: 'Via Roma 1',
    cap: '',
    citta: 'Torino',
    provincia: '',
    telefono: '',
    email: '',
    posizione: '45.07, 7.68',
    intervento_strada: 'on',
    raggio_strada_km: '50',
  };

  it('unisce i dati dell’officina e le impostazioni', () => {
    expect(DatiEStradaSchema.parse(base)).toMatchObject({
      indirizzo: 'Via Roma 1',
      latitudine: 45.07,
      longitudine: 7.68,
      intervento_strada: true,
      raggio_strada_km: 50,
    });
  });

  it('segnala ogni errore sul suo campo', () => {
    const r = DatiEStradaSchema.safeParse({ ...base, citta: '', raggio_strada_km: '3' });
    expect(r.error?.issues.map((i) => String(i.path[0])).sort()).toEqual([
      'citta',
      'raggio_strada_km',
    ]);
  });
});

describe('testi e link', () => {
  it('telefono e mappa', () => {
    expect(telefonoHref('+39 333 123 4567')).toBe('tel:+393331234567');
    expect(linkMappa(45.07, 7.68)).toBe('https://www.google.com/maps?q=45.07,7.68');
  });

  it('scadenza in ora italiana', () => {
    expect(scadeAlle('2026-11-02T13:35:00Z')).toBe('scade alle 14:35');
  });
});
