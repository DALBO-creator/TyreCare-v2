import { describe, expect, it } from 'vitest';
import {
  PIANI,
  PREZZO_INSTALLAZIONE,
  formattaEuro,
  giorniDiProva,
  prezzoPiano,
  ricavoMensile,
} from './abbonamenti';

describe('giorniDiProva', () => {
  it("l'ultimo giorno della prova vale 1", () => {
    expect(giorniDiProva('2026-11-15', '2026-11-15')).toBe(1);
  });

  it('il giorno dopo la fine vale 0', () => {
    expect(giorniDiProva('2026-11-15', '2026-11-16')).toBe(0);
  });

  it('molto dopo la fine non è negativo', () => {
    expect(giorniDiProva('2026-11-15', '2027-06-01')).toBe(0);
  });

  it('30 giorni prima della fine vale 31', () => {
    expect(giorniDiProva('2026-11-15', '2026-10-16')).toBe(31);
  });

  it('attraversa il passaggio di mese e di anno', () => {
    expect(giorniDiProva('2027-01-02', '2026-12-30')).toBe(4);
    expect(giorniDiProva('2026-11-02', '2026-10-30')).toBe(4);
  });

  it("non risente dell'ora legale", () => {
    expect(giorniDiProva('2026-11-01', '2026-10-24')).toBe(9);
  });
});

describe('prezzi', () => {
  it('listino: 100 €/mese, 1000 €/anno, installazione 149 €', () => {
    expect(PIANI.MENSILE.prezzo).toBe(100);
    expect(PIANI.ANNUALE.prezzo).toBe(1000);
    expect(PREZZO_INSTALLAZIONE).toBe(149);
  });

  it('il piano annuale costa come 10 mesi (2 mesi gratis)', () => {
    expect(PIANI.ANNUALE.prezzo).toBe(PIANI.MENSILE.prezzo * 10);
  });

  it('formattaEuro: interi senza decimali, gli altri con due', () => {
    expect(formattaEuro(100)).toBe('100 €');
    expect(formattaEuro(83.333)).toBe('83,33 €');
    expect(formattaEuro(89.5)).toBe('89,50 €');
  });

  it('prezzoPiano: listino o importo concordato', () => {
    expect(prezzoPiano('MENSILE')).toBe('100 €/mese');
    expect(prezzoPiano('ANNUALE', 900)).toBe('900 €/anno');
    expect(prezzoPiano('MENSILE', null)).toBe('100 €/mese');
    expect(prezzoPiano('MENSILE', 0)).toBe('0 €/mese');
  });

  it('ricavoMensile: l’annuale si divide per 12', () => {
    expect(ricavoMensile('MENSILE')).toBe(100);
    expect(ricavoMensile('ANNUALE', 1200)).toBe(100);
    expect(ricavoMensile('ANNUALE')).toBeCloseTo(83.33, 2);
  });
});
