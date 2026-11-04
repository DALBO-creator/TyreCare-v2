import { describe, expect, it } from 'vitest';
import { esc } from './html';

describe('esc', () => {
  it('sostituisce tutti e cinque i caratteri speciali', () => {
    expect(esc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('testo misto', () => {
    expect(esc('<b>Rossi & figli</b>')).toBe('&lt;b&gt;Rossi &amp; figli&lt;/b&gt;');
  });

  it('non riesegue l’escape su un testo già sostituito una sola volta', () => {
    expect(esc('&amp;')).toBe('&amp;amp;');
  });

  it('null e undefined diventano stringa vuota', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('senza caratteri speciali resta invariato', () => {
    expect(esc('Gomme Rossi 205/55 R16')).toBe('Gomme Rossi 205/55 R16');
    expect(esc('')).toBe('');
  });
});
