import { describe, expect, it } from 'vitest';
import { referrerStessoSito } from './legale';

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
