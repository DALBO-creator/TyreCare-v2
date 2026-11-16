import { describe, expect, it, vi } from 'vitest';
import { descrizionePiano, riassuntoAbbonamento, testoRichiesta } from './abbonamento';

vi.mock('./supabase', () => ({ getSupabase: () => ({}) }));

const formatta = (iso: string) => `<${iso}>`;
const base = { prova_fino_al: '2026-12-13', scade_il: null };

describe('riassuntoAbbonamento', () => {
  it('prova con molti giorni: tutto a posto', () => {
    const r = riassuntoAbbonamento({ ...base, stato: 'PROVA' }, '2026-11-14', formatta);
    expect(r.titolo).toBe('Prova gratuita: mancano 30 giorni');
    expect(r.dettaglio).toContain('<2026-12-13>');
    expect(r.tono).toBe('ok');
  });

  it('prova all’ultimo giorno: 1 giorno, attenzione', () => {
    const r = riassuntoAbbonamento({ ...base, stato: 'PROVA' }, '2026-12-13', formatta);
    expect(r.titolo).toBe('Prova gratuita: manca 1 giorno');
    expect(r.tono).toBe('attenzione');
  });

  it('prova finita ma non ancora segnata scaduta dal job notturno', () => {
    const r = riassuntoAbbonamento({ ...base, stato: 'PROVA' }, '2026-12-14', formatta);
    expect(r.titolo).toBe('La prova gratuita è finita');
    expect(r.tono).toBe('azione');
  });

  it('attivo e lontano dalla scadenza', () => {
    const r = riassuntoAbbonamento(
      { ...base, stato: 'ATTIVO', scade_il: '2027-11-13' },
      '2026-11-14',
      formatta,
    );
    expect(r).toEqual({
      titolo: 'Abbonamento attivo fino al <2027-11-13>',
      dettaglio: 'Non devi fare nulla.',
      tono: 'ok',
    });
  });

  it('attivo ma in scadenza entro 30 giorni', () => {
    const r = riassuntoAbbonamento(
      { ...base, stato: 'ATTIVO', scade_il: '2026-11-20' },
      '2026-11-14',
      formatta,
    );
    expect(r.dettaglio).toBe('Alla scadenza mancano 7 giorni: scrivici per rinnovare.');
    expect(r.tono).toBe('attenzione');
  });

  it('scaduto dopo un abbonamento pagato o dopo la sola prova', () => {
    expect(
      riassuntoAbbonamento(
        { ...base, stato: 'SCADUTO', scade_il: '2026-11-01' },
        '2026-11-14',
        formatta,
      ).titolo,
    ).toBe('Abbonamento scaduto il <2026-11-01>');
    expect(riassuntoAbbonamento({ ...base, stato: 'SCADUTO' }, '2026-12-20', formatta).titolo).toBe(
      'La prova gratuita è finita',
    );
  });

  it('sospeso', () => {
    const r = riassuntoAbbonamento({ ...base, stato: 'SOSPESO' }, '2026-11-14', formatta);
    expect(r.titolo).toBe('Abbonamento sospeso');
    expect(r.tono).toBe('azione');
  });
});

describe('descrizionePiano', () => {
  it('listino e importo concordato', () => {
    expect(descrizionePiano({ piano: 'MENSILE', importo_concordato: null })).toBe(
      'Mensile · 100 €/mese',
    );
    expect(descrizionePiano({ piano: 'ANNUALE', importo_concordato: 900 })).toBe(
      'Annuale · 900 €/anno',
    );
  });
});

describe('testoRichiesta', () => {
  it('nomina l’officina', () => {
    expect(testoRichiesta('Gomme Rossi')).toContain('Gomme Rossi');
  });
});
