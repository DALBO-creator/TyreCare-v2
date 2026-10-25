import { describe, expect, it } from 'vitest';
import { deveRicaricare } from './pigra';

describe('deveRicaricare', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/clienti-abc.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://x/assets/clienti-abc.js',
  ])('ricarica per "%s"', (messaggio) => {
    expect(deveRicaricare(new TypeError(messaggio), false)).toBe(true);
  });

  it('non ricarica per un altro errore', () => {
    expect(deveRicaricare(new TypeError('x is not a function'), false)).toBe(false);
  });

  it('non ricarica se la pagina è già stata ricaricata', () => {
    expect(deveRicaricare(new TypeError('Importing a module script failed.'), true)).toBe(false);
  });

  it('gestisce valori che non sono Error', () => {
    expect(deveRicaricare('Failed to fetch dynamically imported module', false)).toBe(false);
    expect(deveRicaricare(undefined, false)).toBe(false);
    expect(deveRicaricare(null, false)).toBe(false);
  });
});
