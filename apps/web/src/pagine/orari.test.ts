import { describe, expect, it, vi } from 'vitest';
import { periodoChiusura } from './orari';

// Ambiente node, senza DOM: le icone (SVG creati con `document`) e il client Supabase qui non servono
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

describe('periodoChiusura', () => {
  it('un giorno solo: il giorno con la maiuscola iniziale', () => {
    expect(periodoChiusura({ dal: '2026-10-14', al: '2026-10-14' })).toBe('Mercoledì 14 ottobre');
  });
  it('più giorni nello stesso mese: "Da … a …" con i giorni in minuscolo', () => {
    expect(periodoChiusura({ dal: '2026-10-14', al: '2026-10-16' })).toBe(
      'Da mercoledì 14 ottobre a venerdì 16 ottobre',
    );
  });
  it('a cavallo di mese', () => {
    expect(periodoChiusura({ dal: '2026-10-30', al: '2026-11-02' })).toBe(
      'Da venerdì 30 ottobre a lunedì 2 novembre',
    );
  });
  it("a cavallo d'anno", () => {
    expect(periodoChiusura({ dal: '2026-12-31', al: '2027-01-02' })).toBe(
      'Da giovedì 31 dicembre a sabato 2 gennaio',
    );
  });
  it("un giorno di un altro anno: il testo non mostra mai l'anno", () => {
    expect(periodoChiusura({ dal: '2030-03-05', al: '2030-03-05' })).toBe('Martedì 5 marzo');
  });
});
