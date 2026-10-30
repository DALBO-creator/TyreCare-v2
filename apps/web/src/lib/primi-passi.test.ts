import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nascondi, nascosta, passiPrimiPassi } from './primi-passi';

const vuoto = { posizione: false, orari: false, servizi: 0, clienti: 0, clientiConApp: 0 };

describe('passiPrimiPassi', () => {
  it('con tutto vuoto: 5 passi da fare, con i link', () => {
    const p = passiPrimiPassi(vuoto);
    expect(p).toHaveLength(5);
    expect(p.every((x) => !x.fatto)).toBe(true);
    expect(p.map((x) => x.href)).toEqual([
      '/officina/dati',
      '/officina/orari',
      '/servizi',
      '/clienti/importa',
      '/clienti',
    ]);
  });

  it('con tutto fatto: 5 passi fatti', () => {
    const p = passiPrimiPassi({
      posizione: true,
      orari: true,
      servizi: 3,
      clienti: 10,
      clientiConApp: 1,
    });
    expect(p.every((x) => x.fatto)).toBe(true);
  });

  it('a metà: solo i passi soddisfatti sono fatti', () => {
    const p = passiPrimiPassi({ ...vuoto, posizione: true, servizi: 2, clienti: 4 });
    expect(p.map((x) => x.fatto)).toEqual([true, false, true, true, false]);
  });
});

describe('nascondi / nascosta', () => {
  beforeEach(() => {
    const dati = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => dati.get(k) ?? null,
      setItem: (k: string, v: string) => void dati.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ricorda la scelta per officina', () => {
    expect(nascosta('a')).toBe(false);
    nascondi('a');
    expect(nascosta('a')).toBe(true);
    expect(nascosta('b')).toBe(false);
  });

  it('senza localStorage non si rompe e non nasconde', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloccato');
      },
      setItem: () => {
        throw new Error('bloccato');
      },
    });
    expect(() => nascondi('a')).not.toThrow();
    expect(nascosta('a')).toBe(false);
  });
});
