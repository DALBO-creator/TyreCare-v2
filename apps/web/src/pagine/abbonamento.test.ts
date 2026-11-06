import { describe, expect, it, vi } from 'vitest';
import { avvisoPagamento, mostraPagamento, testoStato } from './abbonamento';
import type { AbbonamentoOfficina } from '../lib/abbonamento';

// Ambiente node, senza DOM: le icone (SVG creati con `document`) qui non servono
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const abb = (o: Partial<AbbonamentoOfficina>): AbbonamentoOfficina => ({
  piano: 'STARTER',
  stato: 'PROVA',
  prova_fino_al: '2999-01-01',
  ...o,
});

describe('testoStato', () => {
  it('pilota: gratuito per tutta la durata', () => {
    expect(testoStato(abb({ piano: 'PILOTA', stato: 'ATTIVO' }))).toBe(
      'Gratuito per tutta la durata del pilota',
    );
  });
  it('attivo e scaduto', () => {
    expect(testoStato(abb({ stato: 'ATTIVO' }))).toBe('Abbonamento attivo');
    expect(testoStato(abb({ stato: 'SCADUTO' }))).toBe('Abbonamento scaduto');
  });
  it('prova in corso', () => {
    expect(testoStato(abb({ stato: 'PROVA' }))).toMatch(/^Prova gratuita: mancano \d+ giorni/);
  });
});

describe('mostraPagamento', () => {
  it('solo per prova, scaduto e annullato di un piano a pagamento', () => {
    expect(mostraPagamento(abb({ stato: 'PROVA' }))).toBe(true);
    expect(mostraPagamento(abb({ stato: 'SCADUTO' }))).toBe(true);
    expect(mostraPagamento(abb({ stato: 'ANNULLATO' }))).toBe(true);
    expect(mostraPagamento(abb({ stato: 'ATTIVO' }))).toBe(false);
  });
  it('mai per il pilota né senza abbonamento', () => {
    for (const stato of ['PROVA', 'ATTIVO', 'SCADUTO'] as const)
      expect(mostraPagamento(abb({ piano: 'PILOTA', stato }))).toBe(false);
    expect(mostraPagamento(null)).toBe(false);
  });
});

describe('avvisoPagamento', () => {
  it('testo per i due parametri', () => {
    expect(avvisoPagamento('ok')).toBe(
      "Pagamento ricevuto: l'abbonamento si aggiorna entro pochi minuti.",
    );
    expect(avvisoPagamento('annullato')).toBe(
      'Pagamento annullato: non ti è stato addebitato nulla.',
    );
  });
  it('altri valori: nessun avviso', () => {
    expect(avvisoPagamento(null)).toBeNull();
    expect(avvisoPagamento('boh')).toBeNull();
  });
});
