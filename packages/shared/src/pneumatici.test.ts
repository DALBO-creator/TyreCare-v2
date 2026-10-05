import { describe, expect, it } from 'vitest';
import { statoBattistrada } from './pneumatici';

describe('statoBattistrada', () => {
  it('è ROSSO sotto il limite legale di 1,6 mm', () => {
    expect(statoBattistrada(1.5, 'ESTIVO')).toBe('ROSSO');
  });

  it('è GIALLO tra il limite legale e la soglia consigliata', () => {
    expect(statoBattistrada(1.6, 'ESTIVO')).toBe('GIALLO');
    expect(statoBattistrada(3.5, 'INVERNALE')).toBe('GIALLO');
  });

  it('è VERDE dalla soglia consigliata in su', () => {
    expect(statoBattistrada(3, 'ESTIVO')).toBe('VERDE');
    expect(statoBattistrada(4, 'INVERNALE')).toBe('VERDE');
  });
});
