import { describe, expect, it, vi } from 'vitest';
import { dettagliServizio } from './servizi';

// Ambiente node, senza DOM: le icone (SVG creati con `document`) e il client Supabase qui non servono
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

describe('dettagliServizio', () => {
  it('durata e prezzo intero, separati da " · "', () => {
    expect(dettagliServizio({ durata_minuti: 45, prezzo_da: 40 })).toBe('45 min · da 40 €');
  });
  it('ore e minuti, prezzo con i decimali', () => {
    expect(dettagliServizio({ durata_minuti: 90, prezzo_da: 39.9 })).toBe(
      '1 h 30 min · da 39,90 €',
    );
  });
  it('ore tonde', () => {
    expect(dettagliServizio({ durata_minuti: 120, prezzo_da: 40 })).toBe('2 h · da 40 €');
  });
  it('prezzo nullo: "Su preventivo"', () => {
    expect(dettagliServizio({ durata_minuti: 60, prezzo_da: null })).toBe('1 h · Su preventivo');
  });
  it('durata nulla: solo il prezzo, senza separatore', () => {
    expect(dettagliServizio({ durata_minuti: null, prezzo_da: 25 })).toBe('da 25 €');
  });
  it('durata zero: solo il prezzo', () => {
    expect(dettagliServizio({ durata_minuti: 0, prezzo_da: 25 })).toBe('da 25 €');
  });
  it('né durata né prezzo: solo "Su preventivo"', () => {
    expect(dettagliServizio({ durata_minuti: null, prezzo_da: null })).toBe('Su preventivo');
  });
});
