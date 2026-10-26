import { describe, expect, it } from 'vitest';
import {
  MESI_GOMMA_VECCHIA,
  dataSoglia,
  formattaEta,
  gommeVecchie,
  mesiDalDot,
  tendenza,
} from './salute';

describe('mesiDalDot', () => {
  it("calcola l'età dalla settimana e dall'anno", () => {
    // Settimana 38 del 2023 ≈ 17 settembre 2023
    expect(mesiDalDot('3823', '2026-10-09')).toBe(36);
    expect(mesiDalDot('0125', '2026-01-01')).toBe(12);
  });

  it('non conta un mese non ancora compiuto', () => {
    expect(mesiDalDot('0126', '2026-01-31')).toBe(0);
    expect(mesiDalDot('0526', '2026-01-30')).toBe(0);
  });

  it('senza DOT valido o nel futuro non dà età', () => {
    expect(mesiDalDot(null, '2026-10-09')).toBeNull();
    expect(mesiDalDot('', '2026-10-09')).toBeNull();
    expect(mesiDalDot('6023', '2026-10-09')).toBeNull();
    expect(mesiDalDot('0130', '2026-10-09')).toBeNull();
  });
});

describe('formattaEta', () => {
  it('scrive anni e mesi in italiano', () => {
    expect(formattaEta(0)).toBe('meno di un mese');
    expect(formattaEta(1)).toBe('1 mese');
    expect(formattaEta(12)).toBe('1 anno');
    expect(formattaEta(14)).toBe('1 anno e 2 mesi');
    expect(formattaEta(37)).toBe('3 anni e 1 mese');
  });
});

describe('tendenza e dataSoglia', () => {
  const punti = [
    { data: '2025-11-10', km: 30000, mm: 8 },
    { data: '2026-05-10', km: 40000, mm: 6 },
  ];

  it('calcola il consumo al mese e ogni 10.000 km', () => {
    const t = tendenza(punti)!;
    expect(t.mmAlMese).toBeCloseTo(2 / 5.94, 2);
    expect(t.mmOgni10000km).toBeCloseTo(2, 5);
  });

  it('stima quando si arriva alla soglia', () => {
    // 2 mm in 181 giorni: da 6 a 3 mm servono altri ~272 giorni
    expect(dataSoglia(punti, 3)).toBe('2027-02-06');
  });

  it('senza calo, con una sola data o già sotto la soglia non stima nulla', () => {
    expect(tendenza([punti[0]!])).toBeNull();
    expect(tendenza([punti[0]!, { ...punti[0]!, mm: 7 }])).toBeNull();
    expect(tendenza([...punti, { data: '2026-08-10', km: 45000, mm: 7 }])).not.toBeNull();
    expect(
      tendenza([
        { data: '2026-01-01', km: null, mm: 5 },
        { data: '2026-06-01', km: null, mm: 6 },
      ]),
    ).toBeNull();
    expect(dataSoglia(punti, 7)).toBeNull();
  });

  it('senza km il consumo per 10.000 km non c’è', () => {
    const t = tendenza(punti.map((p) => ({ ...p, km: null })))!;
    expect(t.mmOgni10000km).toBeNull();
  });
});

describe('gommeVecchie', () => {
  const oggi = '2026-10-09';

  it('senza DOT o con DOT recente non conta nulla', () => {
    expect(gommeVecchie([], oggi)).toBe(0);
    expect(gommeVecchie([{ dot: null }, { dot: '' }], oggi)).toBe(0);
    expect(gommeVecchie([{ dot: '3823' }], oggi)).toBe(0);
  });

  it('conta una gomma di 6 anni', () => {
    expect(gommeVecchie([{ dot: '3820' }], oggi)).toBe(1);
  });

  it('conta due vecchie su quattro, bordo dei 60 mesi compreso', () => {
    expect(mesiDalDot('3821', oggi)).toBe(MESI_GOMMA_VECCHIA);
    const gomme = [{ dot: '3821' }, { dot: '3823' }, { dot: '1015' }, { dot: null }];
    expect(gommeVecchie(gomme, oggi)).toBe(2);
  });
});
