import { describe, expect, it } from 'vitest';
import { contaInAttesa, formattaDataOra, nomeAutore, ordinaOfficineAdmin } from './admin';

type S = 'IN_ATTESA' | 'ATTIVA' | 'SOSPESA';
const o = (id: string, stato: S, created_at: string) => ({
  id,
  stato_affiliazione: stato,
  created_at,
});

describe('ordinaOfficineAdmin', () => {
  it('mette prima le in attesa, poi le altre dalla più recente', () => {
    const r = ordinaOfficineAdmin([
      o('a', 'ATTIVA', '2026-10-05T10:00:00Z'),
      o('b', 'IN_ATTESA', '2026-10-01T10:00:00Z'),
      o('c', 'SOSPESA', '2026-10-09T10:00:00Z'),
      o('d', 'IN_ATTESA', '2026-10-03T10:00:00Z'),
    ]);
    expect(r.map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('non modifica l’elenco ricevuto e accetta l’elenco vuoto', () => {
    const entrata = [o('a', 'ATTIVA', '2026-10-05T10:00:00Z'), o('b', 'IN_ATTESA', '2026-10-01')];
    ordinaOfficineAdmin(entrata);
    expect(entrata.map((x) => x.id)).toEqual(['a', 'b']);
    expect(ordinaOfficineAdmin([])).toEqual([]);
  });
});

describe('contaInAttesa', () => {
  it('conta solo le IN_ATTESA', () => {
    expect(
      contaInAttesa([
        o('a', 'ATTIVA', 'x'),
        o('b', 'IN_ATTESA', 'x'),
        o('c', 'IN_ATTESA', 'x'),
        o('d', 'SOSPESA', 'x'),
      ]),
    ).toBe(2);
    expect(contaInAttesa([])).toBe(0);
  });
});

describe('nomeAutore', () => {
  it('unisce nome e cognome e dà vuoto se il profilo manca', () => {
    expect(nomeAutore({ nome: 'Anna', cognome: 'Rossi' })).toBe('Anna Rossi');
    expect(nomeAutore({ nome: 'Anna', cognome: '' })).toBe('Anna');
    expect(nomeAutore(null)).toBe('');
    expect(nomeAutore(undefined)).toBe('');
  });
});

describe('formattaDataOra', () => {
  it('usa il fuso di Roma (ora legale e solare)', () => {
    // Il separatore tra data e ora dipende dalla versione di ICU: si controllano le parti
    expect(formattaDataOra('2026-07-01T10:05:00Z')).toMatch(/^1 luglio 2026.*12:05$/);
    expect(formattaDataOra('2026-12-01T10:05:00Z')).toMatch(/^1 dicembre 2026.*11:05$/);
  });
});
