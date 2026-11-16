import { describe, expect, it } from 'vitest';
import {
  apriFuori,
  compilaSegnaposto,
  legaleInHtml,
  riscriviLink,
  valoriSegnaposto,
} from './legale';

describe('riscriviLink', () => {
  it('manda informativa e termini alle pagine dell’app', () => {
    expect(riscriviLink('<a href="informativa-privacy.md">informativa</a>')).toBe(
      '<a href="/privacy">informativa</a>',
    );
    expect(riscriviLink('<a href="termini-di-servizio.md#recesso">termini</a>')).toBe(
      '<a href="/termini#recesso">termini</a>',
    );
  });

  it('manda la cookie policy alla sua pagina', () => {
    expect(riscriviLink('<a href="cookie-policy.md">cookie</a>')).toBe(
      '<a href="/cookie">cookie</a>',
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

describe('compilaSegnaposto', () => {
  const valori = { 'fornitore.nome': 'Mario Rossi', 'fornitore.pec': '[PEC]' };

  it('mette i dati della configurazione al posto dei segnaposto', () => {
    expect(compilaSegnaposto('Titolare: {{fornitore.nome}}.', valori)).toBe(
      'Titolare: Mario Rossi.',
    );
  });

  it('protegge le parentesi quadre dei dati non ancora compilati', () => {
    expect(compilaSegnaposto('PEC: {{fornitore.pec}}', valori)).toBe('PEC: \\[PEC\\]');
    expect(legaleInHtml('PEC: {{non.esiste}} [x]')).toContain('[x]');
  });

  it('lascia visibile un segnaposto sconosciuto', () => {
    expect(compilaSegnaposto('{{non.esiste}}', valori)).toBe('{{non.esiste}}');
  });

  it('ogni segnaposto usato nei testi legali ha un valore', async () => {
    const { readFileSync } = await import('node:fs');
    const chiavi = Object.keys(valoriSegnaposto());
    for (const file of ['informativa-privacy.md', 'termini-di-servizio.md', 'cookie-policy.md']) {
      const testo = readFileSync(
        new URL(`../../../../DOCS/legale/${file}`, import.meta.url),
        'utf8',
      );
      for (const [, chiave] of testo.matchAll(/\{\{([a-zA-Z.]+)\}\}/g))
        expect(chiavi).toContain(chiave);
      expect(testo).not.toContain('DA COMPLETARE');
      expect(testo).not.toMatch(/stripe/i);
    }
  });
});

describe('apriFuori', () => {
  it('apre i link esterni in una scheda nuova e lascia stare quelli interni', () => {
    expect(apriFuori('<a href="https://esempio.it">x</a>')).toBe(
      '<a href="https://esempio.it" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(apriFuori('<a href="/privacy">y</a>')).toBe('<a href="/privacy">y</a>');
  });
});
