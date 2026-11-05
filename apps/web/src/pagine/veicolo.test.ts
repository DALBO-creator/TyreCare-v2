import { describe, expect, it } from 'vitest';
import { formattaEta, mesiDalDot } from '../lib/salute';
import { avvisoGommeVecchie, descrizioneConEta, descrizionePneumatico } from './veicolo';

const OGGI = '2026-11-05';
const base = {
  marca: 'Michelin',
  modello: 'Alpin 6',
  misura: '175/65 R14 82T',
  stagione: 'INVERNALE' as const,
  montato_il: '2025-11-10',
};

describe('descrizioneConEta', () => {
  it('senza DOT non aggiunge età ed è uguale a descrizionePneumatico', () => {
    const p = { ...base, dot: null };
    expect(descrizioneConEta(p, OGGI)).toBe(descrizionePneumatico(p));
  });

  it('con DOT non valido non aggiunge età', () => {
    const p = { ...base, dot: 'abcd' };
    expect(descrizioneConEta(p, OGGI)).toBe(descrizionePneumatico(p));
  });

  it('DOT giovane: età subito dopo il DOT', () => {
    const p = { ...base, dot: '3823' };
    const eta = formattaEta(mesiDalDot('3823', OGGI)!);
    expect(descrizioneConEta(p, OGGI)).toBe(
      descrizionePneumatico(p).replace('DOT 3823', `DOT 3823 · ${eta}`),
    );
    expect(descrizioneConEta(p, OGGI)).toContain(`DOT 3823 · ${eta} · dal `);
  });

  it('DOT oltre la soglia: mostra gli anni', () => {
    const p = { ...base, dot: '3820' };
    expect(formattaEta(mesiDalDot('3820', OGGI)!)).toBe('6 anni e 1 mese');
    expect(descrizioneConEta(p, OGGI)).toContain('DOT 3820 · 6 anni e 1 mese · dal ');
  });
});

describe('avvisoGommeVecchie', () => {
  it('nessuna gomma vecchia: stringa vuota', () => {
    expect(avvisoGommeVecchie([{ dot: '3823' }, { dot: null }], OGGI)).toBe('');
  });

  it('almeno una gomma vecchia: un solo avviso giallo', () => {
    const html = avvisoGommeVecchie([{ dot: '3820' }, { dot: '3820' }, { dot: '3823' }], OGGI);
    expect(html).toContain('tc-avviso--giallo');
    expect(html).toContain('Gomme con più di 5 anni: consiglia la sostituzione');
    expect(html.match(/tc-avviso /g)).toHaveLength(1);
  });
});
