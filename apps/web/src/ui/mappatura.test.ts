import { mappaturaAutomatica, type Tabella } from '@tyrecare/shared';
import { describe, expect, it } from 'vitest';
import {
  esempioColonna,
  intestazioniUtili,
  schermataMappatura,
  tuttoRiconosciuto,
} from './mappatura';

const tabella = (intestazioni: string[], ...righe: string[][]): Tabella => ({
  intestazioni,
  righe: righe.map((celle, i) => ({ numero: i + 2, celle })),
});

describe('tuttoRiconosciuto', () => {
  it('è vero se ogni intestazione non vuota è usata, anche con colonne vuote in mezzo', () => {
    const t = tabella(['Targa', '', 'Nome'], ['AB123CD', '', 'Mario']);
    expect(tuttoRiconosciuto(t, mappaturaAutomatica(t.intestazioni))).toBe(true);
  });

  it("è falso se c'è un'intestazione sconosciuta o ripetuta", () => {
    const sconosciuta = tabella(['Targa', 'Nominativo']);
    expect(tuttoRiconosciuto(sconosciuta, mappaturaAutomatica(sconosciuta.intestazioni))).toBe(
      false,
    );
    const doppia = tabella(['Targa', 'Targa']);
    expect(tuttoRiconosciuto(doppia, mappaturaAutomatica(doppia.intestazioni))).toBe(false);
  });
});

describe('esempioColonna', () => {
  it('prende la prima cella non vuota e taglia a 30 caratteri', () => {
    const lungo = 'A'.repeat(40);
    const t = tabella(['Targa', 'Note'], ['', lungo], ['AB123CD', 'x']);
    expect(esempioColonna(t, 'Targa')).toBe('AB123CD');
    expect(esempioColonna(t, 'Note')).toBe(`${'A'.repeat(30)}…`);
    expect(esempioColonna(t, 'Non esiste')).toBe('');
  });
});

describe('schermataMappatura', () => {
  it('ha un select per ognuna delle 11 colonne, con le scelte iniziali e gli esempi', () => {
    const t = tabella(['Cod. Cli.', 'Targa veicolo', ''], ['C1', 'AB123CD', '']);
    const html = schermataMappatura(t, { targa: 'Targa veicolo' });
    expect(intestazioniUtili(t)).toEqual(['Cod. Cli.', 'Targa veicolo']);
    expect(html.match(/<select /g)).toHaveLength(11);
    expect(html).toContain('Targa veicolo (es. AB123CD)');
    expect(html).toContain("— Non c'è nel file —");
    expect(html).toContain('<option value="Targa veicolo" selected>');
  });
});
