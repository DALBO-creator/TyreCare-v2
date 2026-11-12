import { describe, expect, it } from 'vitest';
import { leggiConteggiControlli, periodoDate, periodoSospetto } from './importa-controlli';

const valido = {
  controlli_nuovi: 2,
  controlli_gia_presenti: 1,
  pneumatici_nuovi: 4,
  misure_nuove: 8,
  misure_saltate: 0,
  pneumatici_completati: 3,
  targhe_non_trovate: ['AB123CD'],
};

describe('leggiConteggiControlli', () => {
  it('legge la risposta della funzione SQL', () => {
    expect(leggiConteggiControlli(valido)).toEqual(valido);
  });

  it('senza targhe non trovate usa un elenco vuoto', () => {
    const senza: Record<string, unknown> = { ...valido };
    delete senza.targhe_non_trovate;
    expect(leggiConteggiControlli(senza).targhe_non_trovate).toEqual([]);
  });

  it('senza pneumatici_completati vale 0 (database non ancora aggiornato)', () => {
    const senza: Record<string, unknown> = { ...valido };
    delete senza.pneumatici_completati;
    expect(leggiConteggiControlli(senza).pneumatici_completati).toBe(0);
  });

  it.each([-1, 1.5, '2', null])('rifiuta pneumatici_completati = %j', (v) => {
    expect(() => leggiConteggiControlli({ ...valido, pneumatici_completati: v })).toThrow(
      /pneumatici_completati/,
    );
  });

  it.each([null, 'x', 3, [], undefined])('rifiuta %j', (dati) => {
    expect(() => leggiConteggiControlli(dati)).toThrow(/non valida/);
  });

  it('rifiuta un conteggio mancante, negativo o non intero', () => {
    expect(() => leggiConteggiControlli({ ...valido, misure_nuove: undefined })).toThrow(
      /misure_nuove/,
    );
    expect(() => leggiConteggiControlli({ ...valido, controlli_nuovi: -1 })).toThrow(
      /controlli_nuovi/,
    );
    expect(() => leggiConteggiControlli({ ...valido, pneumatici_nuovi: 1.5 })).toThrow(
      /pneumatici_nuovi/,
    );
  });

  it('rifiuta targhe che non sono testi', () => {
    expect(() => leggiConteggiControlli({ ...valido, targhe_non_trovate: [1] })).toThrow(
      /targhe_non_trovate/,
    );
    expect(() => leggiConteggiControlli({ ...valido, targhe_non_trovate: 'AB' })).toThrow(
      /targhe_non_trovate/,
    );
  });
});

describe('periodoDate', () => {
  it('senza righe è null', () => {
    expect(periodoDate([])).toBeNull();
  });
  it('con una riga da e a coincidono', () => {
    expect(periodoDate([{ data: '2026-03-05' }])).toEqual({ da: '2026-03-05', a: '2026-03-05' });
  });
  it('trova minimo e massimo con righe in disordine', () => {
    const righe = [{ data: '2026-05-01' }, { data: '2025-12-31' }, { data: '2026-09-14' }];
    expect(periodoDate(righe)).toEqual({ da: '2025-12-31', a: '2026-09-14' });
  });
  it('ignora le date vuote', () => {
    expect(periodoDate([{ data: '' }, { data: '2026-02-02' }])).toEqual({
      da: '2026-02-02',
      a: '2026-02-02',
    });
    expect(periodoDate([{ data: '' }])).toBeNull();
  });
});

describe('periodoSospetto', () => {
  const oggi = '2026-11-01';
  it('14 anni fa non è sospetto', () => {
    expect(periodoSospetto({ da: '2012-11-01', a: '2026-01-01' }, oggi)).toBe(false);
  });
  it('16 anni fa è sospetto', () => {
    expect(periodoSospetto({ da: '2010-11-01', a: '2026-01-01' }, oggi)).toBe(true);
  });
  it('esattamente 15 anni fa non è sospetto', () => {
    expect(periodoSospetto({ da: '2011-11-01', a: '2026-01-01' }, oggi)).toBe(false);
    expect(periodoSospetto({ da: '2011-10-31', a: '2026-01-01' }, oggi)).toBe(true);
  });
  it('senza periodo non è sospetto', () => {
    expect(periodoSospetto(null, oggi)).toBe(false);
  });
  it('il 29 febbraio non manda in errore', () => {
    expect(periodoSospetto({ da: '2009-02-28', a: '2024-01-01' }, '2024-02-29')).toBe(true);
    expect(periodoSospetto({ da: '2009-03-01', a: '2024-01-01' }, '2024-02-29')).toBe(false);
  });
});
