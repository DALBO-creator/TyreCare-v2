import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pulisciBozzeUtente } from './bozza-chiave';
import {
  cancellaBozza,
  creaSalvataggioRitardato,
  chiaveBozza,
  leggiBozza,
  pulisciBozzeScadute,
  salvaBozza,
  DURATA_BOZZA_MS,
} from './bozza-controllo';

const POS = ['ANT_SX', 'ANT_DX'];
const T0 = Date.parse('2026-11-10T10:00:00Z');
let dati: Map<string, string>;

beforeEach(() => {
  dati = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => dati.get(k) ?? null,
    setItem: (k: string, v: string) => void dati.set(k, v),
    removeItem: (k: string) => void dati.delete(k),
    key: (i: number) => [...dati.keys()][i] ?? null,
    get length() {
      return dati.size;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('bozza del nuovo controllo', () => {
  it('la chiave contiene utente e veicolo', () => {
    expect(chiaveBozza('u1', 'v1')).toBe('tc-bozza-controllo:u1:v1');
  });

  it('andata e ritorno', () => {
    const k = chiaveBozza('u1', 'v1');
    salvaBozza(k, POS, { mm_ANT_SX: '5,5', note: 'ok' }, T0);
    expect(leggiBozza(k, POS, T0 + 1000)).toEqual({
      salvata_il: T0,
      posizioni: POS,
      valori: { mm_ANT_SX: '5,5', note: 'ok' },
    });
  });

  it('un altro utente non la vede', () => {
    salvaBozza(chiaveBozza('u1', 'v1'), POS, { note: 'x' }, T0);
    expect(leggiBozza(chiaveBozza('u2', 'v1'), POS, T0)).toBeNull();
  });

  it('dopo 7 giorni è null e viene cancellata; entro 7 giorni resta', () => {
    const k = chiaveBozza('u1', 'v1');
    salvaBozza(k, POS, { note: 'x' }, T0);
    expect(leggiBozza(k, POS, T0 + DURATA_BOZZA_MS)).not.toBeNull();
    expect(leggiBozza(k, POS, Date.parse('2026-11-17T10:00:01Z'))).toBeNull();
    expect(dati.has(k)).toBe(false);
  });

  it('posizioni diverse → null (la bozza resta)', () => {
    const k = chiaveBozza('u1', 'v1');
    salvaBozza(k, POS, { note: 'x' }, T0);
    expect(leggiBozza(k, ['ANT_SX', 'POST_SX'], T0)).toBeNull();
    expect(leggiBozza(k, ['ANT_SX'], T0)).toBeNull();
  });

  it('JSON rotto o struttura sbagliata → null', () => {
    const k = chiaveBozza('u1', 'v1');
    dati.set(k, '{non json');
    expect(leggiBozza(k, POS, T0)).toBeNull();
    dati.set(k, '[]');
    expect(leggiBozza(k, POS, T0)).toBeNull();
    dati.set(k, JSON.stringify({ salvata_il: 'ieri', posizioni: POS, valori: {} }));
    expect(leggiBozza(k, POS, T0)).toBeNull();
  });

  it('cancellaBozza toglie la bozza', () => {
    const k = chiaveBozza('u1', 'v1');
    salvaBozza(k, POS, {}, T0);
    cancellaBozza(k);
    expect(leggiBozza(k, POS, T0)).toBeNull();
  });

  it('con localStorage che lancia non c’è nessuna eccezione', () => {
    const lancia = () => {
      throw new Error('negato');
    };
    vi.stubGlobal('localStorage', { getItem: lancia, setItem: lancia, removeItem: lancia });
    expect(() => salvaBozza('k', POS, {}, T0)).not.toThrow();
    expect(() => cancellaBozza('k')).not.toThrow();
    expect(leggiBozza('k', POS, T0)).toBeNull();
  });
});

describe('creaSalvataggioRitardato', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('la prima richiesta scrive subito, la seconda entro 500 ms aspetta il timer finale', () => {
    const scrivi = vi.fn();
    const s = creaSalvataggioRitardato(scrivi, 500);
    s.programma();
    expect(scrivi).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    s.programma();
    s.programma();
    expect(scrivi).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(399);
    expect(scrivi).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(scrivi).toHaveBeenCalledTimes(2);
  });

  it('dopo ferma() il timer in sospeso non scrive e le richieste sono ignorate', () => {
    const scrivi = vi.fn();
    const s = creaSalvataggioRitardato(scrivi, 500);
    s.programma();
    vi.advanceTimersByTime(100);
    s.programma();
    s.ferma();
    vi.advanceTimersByTime(1000);
    s.programma();
    vi.advanceTimersByTime(1000);
    expect(scrivi).toHaveBeenCalledTimes(1);
  });

  it('annulla() toglie il timer ma le richieste dopo scrivono ancora', () => {
    const scrivi = vi.fn();
    const s = creaSalvataggioRitardato(scrivi, 500);
    s.programma();
    vi.advanceTimersByTime(100);
    s.programma();
    s.annulla();
    vi.advanceTimersByTime(1000);
    expect(scrivi).toHaveBeenCalledTimes(1);
    s.programma();
    expect(scrivi).toHaveBeenCalledTimes(2);
  });
});

describe('pulizia delle bozze scadute', () => {
  const scritta = (chiave: string, valore: unknown) =>
    dati.set(chiave, typeof valore === 'string' ? valore : JSON.stringify(valore));
  const ok = { posizioni: POS, valori: {} };

  afterEach(() => vi.restoreAllMocks());

  it('cancella la scaduta e tiene la valida', () => {
    scritta('tc-bozza-controllo:u1:v1', { ...ok, salvata_il: T0 - DURATA_BOZZA_MS - 1 });
    scritta('tc-bozza-controllo:u1:v2', { ...ok, salvata_il: T0 - DURATA_BOZZA_MS });
    scritta('tc-bozza-controllo:u1:v3', { ...ok, salvata_il: T0 - 1000 });
    pulisciBozzeScadute(T0);
    expect([...dati.keys()].sort()).toEqual([
      'tc-bozza-controllo:u1:v2',
      'tc-bozza-controllo:u1:v3',
    ]);
  });

  it('cancella le bozze illeggibili o senza salvata_il numerico', () => {
    scritta('tc-bozza-controllo:u1:a', 'non è json');
    scritta('tc-bozza-controllo:u1:b', { ...ok });
    scritta('tc-bozza-controllo:u1:c', { ...ok, salvata_il: 'ieri' });
    scritta('tc-bozza-controllo:u1:d', 'null');
    pulisciBozzeScadute(T0);
    expect(dati.size).toBe(0);
  });

  it('cancella tutte le scadute anche se sono molte e consecutive', () => {
    for (let i = 0; i < 6; i++) scritta(`tc-bozza-controllo:u1:v${i}`, { ...ok, salvata_il: 1 });
    pulisciBozzeScadute(T0);
    expect(dati.size).toBe(0);
  });

  it('non tocca le chiavi di altre app', () => {
    scritta('tc-tema', 'scuro');
    scritta('altro:tc-bozza-controllo:x', 'non è json');
    scritta('tc-bozza-controllo:u1:v1', 'non è json');
    pulisciBozzeScadute(T0);
    expect([...dati.keys()].sort()).toEqual(['altro:tc-bozza-controllo:x', 'tc-tema']);
  });

  it('con localStorage che lancia non dà errori', () => {
    scritta('tc-bozza-controllo:u1:v1', { ...ok, salvata_il: 1 });
    const l = localStorage;
    vi.spyOn(l, 'key').mockImplementation(() => {
      throw new Error('negato');
    });
    expect(() => pulisciBozzeScadute(T0)).not.toThrow();
    vi.restoreAllMocks();
    vi.spyOn(l, 'getItem').mockImplementation(() => {
      throw new Error('negato');
    });
    vi.spyOn(l, 'removeItem').mockImplementation(() => {
      throw new Error('negato');
    });
    expect(() => pulisciBozzeScadute(T0)).not.toThrow();
  });
});

describe('pulizia delle bozze di un utente', () => {
  it("toglie solo le bozze dell'utente, non quelle di u10 né le altre chiavi", () => {
    dati.set(chiaveBozza('u1', 'v1'), '{}');
    dati.set(chiaveBozza('u1', 'v2'), '{}');
    dati.set(chiaveBozza('u10', 'v1'), '{}');
    dati.set(chiaveBozza('u2', 'v1'), '{}');
    dati.set('tc-altro', 'x');
    pulisciBozzeUtente('u1');
    expect([...dati.keys()].sort()).toEqual([
      'tc-altro',
      'tc-bozza-controllo:u10:v1',
      'tc-bozza-controllo:u2:v1',
    ]);
  });

  it('con id vuoto non tocca nulla', () => {
    dati.set(chiaveBozza('u1', 'v1'), '{}');
    dati.set('tc-bozza-controllo::x', '{}');
    pulisciBozzeUtente('');
    expect(dati.size).toBe(2);
  });

  it('con localStorage che lancia non lancia', () => {
    dati.set(chiaveBozza('u1', 'v1'), '{}');
    vi.stubGlobal('localStorage', {
      get length(): number {
        throw new Error('negato');
      },
    });
    expect(() => pulisciBozzeUtente('u1')).not.toThrow();
    vi.stubGlobal('localStorage', {
      length: 1,
      key: () => chiaveBozza('u1', 'v1'),
      removeItem: () => {
        throw new Error('negato');
      },
    });
    expect(() => pulisciBozzeUtente('u1')).not.toThrow();
  });
});
