import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ getSupabase: () => ({}) }));

import { statoCasella, testoPosizione } from './dati-officina';

describe('testoPosizione', () => {
  it('con entrambe le coordinate', () => {
    expect(testoPosizione({ latitudine: 45.070312, longitudine: 7.686856 })).toBe(
      '45.070312, 7.686856',
    );
  });

  it('latitudine mancante: vuota', () => {
    expect(testoPosizione({ latitudine: null, longitudine: 7.686856 })).toBe('');
  });

  it('longitudine mancante: vuota', () => {
    expect(testoPosizione({ latitudine: 45.070312, longitudine: null })).toBe('');
  });

  it('entrambe mancanti: vuota', () => {
    expect(testoPosizione({ latitudine: null, longitudine: null })).toBe('');
  });

  it('zero è una coordinata valida', () => {
    expect(testoPosizione({ latitudine: 0, longitudine: 0 })).toBe('0, 0');
  });
});

describe('statoCasella', () => {
  it('posizione illeggibile: disattivata e non spuntata, anche se era scelta', () => {
    expect(statoCasella(false, true)).toEqual({ disabled: true, checked: false });
    expect(statoCasella(false, false)).toEqual({ disabled: true, checked: false });
  });

  it("posizione leggibile: attiva con l'ultima scelta dell'utente", () => {
    expect(statoCasella(true, true)).toEqual({ disabled: false, checked: true });
    expect(statoCasella(true, false)).toEqual({ disabled: false, checked: false });
  });
});
