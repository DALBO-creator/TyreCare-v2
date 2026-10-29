import { describe, expect, it } from 'vitest';
import { daRicontrollare, gommeFuoriStagione } from './stagioni';

describe('gommeFuoriStagione', () => {
  it('dal 15 ottobre le estive sono fuori stagione, il 14 no', () => {
    expect(gommeFuoriStagione(['ESTIVO'], '2026-10-14')).toBe(false);
    expect(gommeFuoriStagione(['ESTIVO'], '2026-10-15')).toBe(true);
  });

  it('le invernali sono fuori stagione dal 15 marzo, il 14 no', () => {
    expect(gommeFuoriStagione(['INVERNALE'], '2027-03-14')).toBe(false);
    expect(gommeFuoriStagione(['INVERNALE'], '2027-03-15')).toBe(true);
  });

  it("d'inverno le invernali vanno bene e d'estate le estive", () => {
    expect(gommeFuoriStagione(['INVERNALE'], '2026-10-15')).toBe(false);
    expect(gommeFuoriStagione(['INVERNALE'], '2027-01-10')).toBe(false);
    expect(gommeFuoriStagione(['ESTIVO'], '2027-03-15')).toBe(false);
    expect(gommeFuoriStagione(['ESTIVO'], '2026-10-14')).toBe(false);
  });

  it('basta una gomma sbagliata tra quelle montate', () => {
    expect(gommeFuoriStagione(['INVERNALE', 'ESTIVO'], '2026-12-01')).toBe(true);
    expect(gommeFuoriStagione(['INVERNALE', 'ESTIVO'], '2026-06-01')).toBe(true);
  });

  it('le quattro stagioni non sono mai fuori stagione', () => {
    for (const oggi of ['2026-01-10', '2026-06-01', '2026-10-15', '2027-03-15'])
      expect(gommeFuoriStagione(['QUATTRO_STAGIONI'], oggi)).toBe(false);
  });

  it('senza gomme montate è falso', () => {
    expect(gommeFuoriStagione([], '2026-12-01')).toBe(false);
  });
});

describe('daRicontrollare', () => {
  it('365 giorni non bastano, 366 sì', () => {
    expect(daRicontrollare('2025-10-30', '2026-10-30')).toBe(false);
    expect(daRicontrollare('2025-10-29', '2026-10-30')).toBe(true);
  });

  it("conta bene il passaggio d'anno e l'anno bisestile", () => {
    expect(daRicontrollare('2025-10-29', '2026-10-29')).toBe(false);
    expect(daRicontrollare('2023-03-01', '2024-02-29')).toBe(false);
    expect(daRicontrollare('2023-02-28', '2024-02-29')).toBe(true);
  });

  it('mai controllato non è da ricontrollare', () => {
    expect(daRicontrollare(null, '2026-10-30')).toBe(false);
  });
});
