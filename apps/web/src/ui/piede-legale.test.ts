import { SITO_URL } from '@tyrecare/shared';
import { describe, expect, it } from 'vitest';
import { piedeLegale } from './piede-legale';

describe('piedeLegale', () => {
  const html = piedeLegale();

  it('porta a privacy, termini e cookie policy', () => {
    for (const pagina of ['/privacy', '/termini', '/cookie'])
      expect(html).toContain(`href="${pagina}"`);
  });

  it('apre il sito di presentazione in una scheda nuova, senza referrer', () => {
    expect(html).toContain(`<a href="${SITO_URL}" target="_blank" rel="noopener noreferrer">`);
  });
});
