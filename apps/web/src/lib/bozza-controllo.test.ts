import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancellaBozza,
  chiaveBozza,
  leggiBozza,
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
