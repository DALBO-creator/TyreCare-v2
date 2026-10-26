import { describe, expect, it } from 'vitest';
import { legaleInHtml, riscriviLink } from './legale';

describe('riscriviLink', () => {
  it('manda informativa e termini alle pagine dell’app', () => {
    expect(riscriviLink('<a href="informativa-privacy.md">informativa</a>')).toBe(
      '<a href="/privacy">informativa</a>',
    );
    expect(riscriviLink('<a href="termini-di-servizio.md#recesso">termini</a>')).toBe(
      '<a href="/termini#recesso">termini</a>',
    );
  });

  it('trasforma gli altri file .md in testo semplice', () => {
    expect(riscriviLink('Vedi <a href="dpa-officine.md">il DPA</a>.')).toBe('Vedi il DPA.');
  });

  it('lascia stare i link esterni e le ancore', () => {
    const html =
      '<a href="https://esempio.it/a.md">x</a> <a href="mailto:a@b.it">y</a> <a href="#uno">z</a>';
    expect(riscriviLink(html)).toBe(html);
  });
});

describe('legaleInHtml', () => {
  it('rende il titolo focalizzabile e riscrive i link', () => {
    const html = legaleInHtml('# Titolo\n\nVai ai [termini](termini-di-servizio.md).');
    expect(html).toContain('<h1 tabindex="-1">Titolo</h1>');
    expect(html).toContain('<a href="/termini">termini</a>');
  });
});
