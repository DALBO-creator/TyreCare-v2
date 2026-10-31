import { describe, expect, it } from 'vitest';
import { nominativo } from './clienti';

describe('nominativo', () => {
  it('con la ragione sociale mostra quella, anche se nome e cognome ci sono', () => {
    expect(nominativo({ nome: 'Giulia', cognome: 'Verdi', ragione_sociale: 'Verdi Srl' })).toBe(
      'Verdi Srl',
    );
  });

  it('senza ragione sociale mostra cognome e nome', () => {
    expect(nominativo({ nome: 'Giulia', cognome: 'Verdi', ragione_sociale: null })).toBe(
      'Verdi Giulia',
    );
  });

  it('con il solo cognome non lascia spazi in fondo', () => {
    expect(nominativo({ nome: '', cognome: 'Verdi', ragione_sociale: null })).toBe('Verdi');
  });

  it('con tutto vuoto o senza cliente dà la stringa vuota', () => {
    expect(nominativo({ nome: '', cognome: '', ragione_sociale: null })).toBe('');
    expect(nominativo(null)).toBe('');
  });
});
