import { describe, expect, it } from 'vitest';
import { referrerStessoSito, tornaIndietroNelSito } from './legale';

const ORIGINE = 'https://app.tyrecare.it';

describe('referrerStessoSito', () => {
  it('stessa origine: vero', () => {
    expect(referrerStessoSito('https://app.tyrecare.it/garage?x=1', ORIGINE)).toBe(true);
  });
  it('altro dominio: falso', () => {
    expect(referrerStessoSito('https://example.com/pagina', ORIGINE)).toBe(false);
  });
  it('stesso host ma schema o porta diversi: falso', () => {
    expect(referrerStessoSito('http://app.tyrecare.it/', ORIGINE)).toBe(false);
    expect(referrerStessoSito('https://app.tyrecare.it:8443/', ORIGINE)).toBe(false);
  });
  it('referrer vuoto o non URL: falso', () => {
    expect(referrerStessoSito('', ORIGINE)).toBe(false);
    expect(referrerStessoSito('non è un url', ORIGINE)).toBe(false);
  });
});

describe('tornaIndietroNelSito', () => {
  it('stessa origine e storia lunga: vero', () => {
    expect(tornaIndietroNelSito('https://app.tyrecare.it/home', ORIGINE, 3)).toBe(true);
  });
  it('stessa origine ma storia di 1 voce (scheda nuova): falso', () => {
    expect(tornaIndietroNelSito('https://app.tyrecare.it/home', ORIGINE, 1)).toBe(false);
  });
  it('storia lunga ma altro sito o nessun referrer: falso', () => {
    expect(tornaIndietroNelSito('https://example.com/', ORIGINE, 3)).toBe(false);
    expect(tornaIndietroNelSito('', ORIGINE, 3)).toBe(false);
  });
});
