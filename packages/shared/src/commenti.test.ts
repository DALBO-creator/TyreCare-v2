import { describe, expect, it } from 'vitest';
import { COMMENTO_MAX, CommentoSchema, PERCORSO_MAX, percorsoCommento } from './commenti';

const errore = (testo: string) => CommentoSchema.safeParse({ testo }).error?.issues[0]?.message;

describe('CommentoSchema', () => {
  it('toglie gli spazi ai lati', () => {
    expect(CommentoSchema.parse({ testo: '  Ottima app  ' }).testo).toBe('Ottima app');
  });

  it('rifiuta un testo troppo corto, anche se riempito di spazi', () => {
    expect(errore('ab')).toBe('Scrivi almeno 3 caratteri');
    expect(errore('   a   ')).toBe('Scrivi almeno 3 caratteri');
    expect(errore('')).toBe('Scrivi almeno 3 caratteri');
  });

  it('accetta i limiti e rifiuta oltre 2000 caratteri', () => {
    expect(errore('abc')).toBeUndefined();
    expect(errore('a'.repeat(COMMENTO_MAX))).toBeUndefined();
    expect(errore('a'.repeat(COMMENTO_MAX + 1))).toBe(
      'Il commento può avere al massimo 2000 caratteri',
    );
  });
});

describe('percorsoCommento', () => {
  it('accetta un percorso interno', () => {
    expect(percorsoCommento('/garage')).toBe('/garage');
    expect(percorsoCommento('/veicolo?id=1')).toBe('/veicolo?id=1');
  });

  it('scarta ciò che manca o non è un percorso interno', () => {
    expect(percorsoCommento(null)).toBe('');
    expect(percorsoCommento('')).toBe('');
    expect(percorsoCommento('garage')).toBe('');
    expect(percorsoCommento('//altro.sito')).toBe('');
    expect(percorsoCommento('https://altro.sito')).toBe('');
  });

  it('scarta un percorso più lungo del limite del database', () => {
    expect(percorsoCommento('/' + 'a'.repeat(PERCORSO_MAX - 1))).toHaveLength(PERCORSO_MAX);
    expect(percorsoCommento('/' + 'a'.repeat(PERCORSO_MAX))).toBe('');
  });
});
