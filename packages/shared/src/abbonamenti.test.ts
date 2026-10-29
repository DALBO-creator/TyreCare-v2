import { describe, expect, it } from 'vitest';
import { PIANI, giorniDiProva } from './abbonamenti';

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

describe('PIANI', () => {
  it('ha i prezzi di Starter e Pro e il pilota gratuito', () => {
    expect(PIANI.STARTER.prezzoMensile).toBe(29);
    expect(PIANI.PRO.prezzoMensile).toBe(49);
    expect(PIANI.PILOTA.prezzoMensile).toBeNull();
    expect(PIANI.PILOTA.nome).toBe('Officina pilota');
  });
});
