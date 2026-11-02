import { describe, expect, it } from 'vitest';
import { htmlErrore } from './comune';

describe('htmlErrore', () => {
  it('mette il messaggio in un paragrafo', () => {
    expect(htmlErrore('Qualcosa è andato storto')).toBe(
      '<p class="mb-0">Qualcosa è andato storto</p>',
    );
  });

  it('esegue l’escape dei caratteri speciali', () => {
    expect(htmlErrore('<b>&')).toBe('<p class="mb-0">&lt;b&gt;&amp;</p>');
  });
});
