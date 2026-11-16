import { describe, expect, it, vi } from 'vitest';
import type { ImportPassato } from '../lib/importa';
import { importAnnullabile, testoAnnullo } from './importa';

// Ambiente node, senza DOM e senza Supabase: icone e client qui non servono
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}) }));

const adesso = Date.parse('2026-11-16T12:00:00Z');
const ORA = 3600 * 1000;
const GIORNO = 24 * ORA;

/** Un import creato `eta` millisecondi prima di `adesso` (solo i campi che la regola legge). */
function imp(
  id: string,
  tipo: string,
  eta: number,
  annullato_il: string | null = null,
): ImportPassato {
  return {
    id,
    tipo,
    created_at: new Date(adesso - eta).toISOString(),
    annullato_il,
  } as ImportPassato;
}

describe('importAnnullabile', () => {
  // `caricaImportPassati` li legge dal più recente (created_at desc): i dati sono in quest'ordine
  it("sceglie l'ultimo import di clienti e veicoli tra più import", () => {
    const passati = [
      imp('nuovo', 'CLIENTI_VEICOLI', 1 * GIORNO),
      imp('vecchio', 'CLIENTI_VEICOLI', 3 * GIORNO),
    ];
    expect(importAnnullabile(passati, adesso)?.id).toBe('nuovo');
  });

  it('un import di controlli più recente non conta', () => {
    const passati = [
      imp('controlli', 'CONTROLLI', 1 * ORA),
      imp('clienti', 'CLIENTI_VEICOLI', 2 * GIORNO),
    ];
    expect(importAnnullabile(passati, adesso)?.id).toBe('clienti');
  });

  it("se l'ultimo è già annullato non c'è nulla da annullare, anche se il penultimo non lo è", () => {
    const passati = [
      imp('ultimo', 'CLIENTI_VEICOLI', 1 * GIORNO, '2026-11-15T12:00:00Z'),
      imp('penultimo', 'CLIENTI_VEICOLI', 2 * GIORNO),
    ];
    expect(importAnnullabile(passati, adesso)).toBeUndefined();
  });

  it('6 giorni e 23 ore: si può ancora annullare', () => {
    expect(
      importAnnullabile([imp('a', 'CLIENTI_VEICOLI', 6 * GIORNO + 23 * ORA)], adesso)?.id,
    ).toBe('a');
  });

  it('7 giorni esatti: scaduto (come annulla_import)', () => {
    expect(importAnnullabile([imp('a', 'CLIENTI_VEICOLI', 7 * GIORNO)], adesso)).toBeUndefined();
  });

  it('elenco vuoto o senza import di clienti e veicoli', () => {
    expect(importAnnullabile([], adesso)).toBeUndefined();
    expect(importAnnullabile([imp('c', 'CONTROLLI', 1 * ORA)], adesso)).toBeUndefined();
  });
});

describe('testoAnnullo', () => {
  const base = { clienti_tolti: 2, veicoli_tolti: 3, clienti_tenuti: 0, veicoli_tenuti: 0 };

  it('plurali, senza righe tenute', () => {
    expect(testoAnnullo(base)).toBe('Import annullato: 2 clienti tolti e 3 veicoli tolti.');
  });
  it('singolari, senza righe tenute', () => {
    expect(testoAnnullo({ ...base, clienti_tolti: 1, veicoli_tolti: 1 })).toBe(
      'Import annullato: 1 cliente tolto e 1 veicolo tolto.',
    );
  });
  it('zero tolti', () => {
    expect(testoAnnullo({ ...base, clienti_tolti: 0, veicoli_tolti: 0 })).toBe(
      'Import annullato: 0 clienti tolti e 0 veicoli tolti.',
    );
  });
  it('plurali, con righe tenute', () => {
    expect(testoAnnullo({ ...base, clienti_tenuti: 2, veicoli_tenuti: 4 })).toBe(
      'Import annullato: 2 clienti tolti e 3 veicoli tolti; 2 clienti tenuti e 4 veicoli tenuti perché già usati.',
    );
  });
  it('singolari, con righe tenute', () => {
    expect(
      testoAnnullo({ clienti_tolti: 1, veicoli_tolti: 1, clienti_tenuti: 1, veicoli_tenuti: 1 }),
    ).toBe(
      'Import annullato: 1 cliente tolto e 1 veicolo tolto; 1 cliente tenuto e 1 veicolo tenuto perché già usati.',
    );
  });
  it('solo veicoli tenuti', () => {
    expect(testoAnnullo({ ...base, veicoli_tenuti: 1 })).toBe(
      'Import annullato: 2 clienti tolti e 3 veicoli tolti; 0 clienti tenuti e 1 veicolo tenuto perché già usati.',
    );
  });
});
