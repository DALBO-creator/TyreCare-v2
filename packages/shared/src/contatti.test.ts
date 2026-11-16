import { describe, expect, it } from 'vitest';
import { CONTATTO_EMAIL, linkContatto, linkEmail } from './contatti';

describe('linkEmail', () => {
  it('codifica oggetto e testo', () => {
    expect(linkEmail('a@b.it', 'Rinnovo & piano', 'Buongiorno,\nvorrei…')).toBe(
      'mailto:a@b.it?subject=Rinnovo%20%26%20piano&body=Buongiorno%2C%0Avorrei%E2%80%A6',
    );
  });

  it('senza testo mette solo l’oggetto', () => {
    expect(linkEmail('a@b.it', 'Ciao')).toBe('mailto:a@b.it?subject=Ciao');
  });
});

describe('linkContatto', () => {
  it('scrive all’indirizzo di TyreCare', () => {
    expect(linkContatto('Abbonamento')).toBe(`mailto:${CONTATTO_EMAIL}?subject=Abbonamento`);
    expect(CONTATTO_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });
});
