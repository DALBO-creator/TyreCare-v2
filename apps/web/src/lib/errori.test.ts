import { describe, expect, it } from 'vitest';
import { ErroreModulo, codiceErrore } from './errori';

describe('ErroreModulo', () => {
  it('conserva campo e codice', () => {
    const e = new ErroreModulo('Fascia piena', 'fascia', 'FASCIA_PIENA');
    expect(e.message).toBe('Fascia piena');
    expect(e.campo).toBe('fascia');
    expect(e.codice).toBe('FASCIA_PIENA');
    expect(e).toBeInstanceOf(Error);
  });

  it('campo e codice sono facoltativi', () => {
    const e = new ErroreModulo('Errore');
    expect(e.campo).toBeUndefined();
    expect(e.codice).toBeUndefined();
  });
});

describe('codiceErrore', () => {
  it('legge il codice di PostgreSQL se è testo', () => {
    expect(codiceErrore({ code: '23505' })).toBe('23505');
    expect(codiceErrore({ code: 5 })).toBeUndefined();
    expect(codiceErrore(null)).toBeUndefined();
  });
});
