import { describe, expect, it } from 'vitest';
import { distanzaKm, formattaDistanza, ordinaPerDistanza } from './distanza';

const torino = { latitudine: 45.070312, longitudine: 7.686856 };
const milano = { latitudine: 45.464211, longitudine: 9.191383 };

describe('distanzaKm', () => {
  it('Torino-Milano è circa 126 km', () => {
    expect(distanzaKm(torino, milano)).toBeCloseTo(126, -1);
    expect(Math.abs(distanzaKm(torino, milano) - 126)).toBeLessThan(2);
  });

  it('è simmetrica e lo stesso punto dista 0', () => {
    expect(distanzaKm(torino, torino)).toBe(0);
    expect(distanzaKm(torino, milano)).toBeCloseTo(distanzaKm(milano, torino), 9);
  });
});

describe('formattaDistanza', () => {
  it.each([
    [0.35, '350 m'],
    [0.37, '350 m'],
    [0.38, '400 m'],
    [0.01, '0 m'],
    [0.99, '1,0 km'],
    [3.2, '3,2 km'],
    [1.04, '1,0 km'],
    [9.96, '10 km'],
    [25.4, '25 km'],
    [126.4, '126 km'],
  ])('%d km -> %s', (km, atteso) => {
    expect(formattaDistanza(km)).toBe(atteso);
  });
});

describe('ordinaPerDistanza', () => {
  const o = (nome: string, latitudine: number | null, longitudine: number | null) => ({
    nome,
    latitudine,
    longitudine,
  });

  it("mette prima le più vicine e dopo, nell'ordine di partenza, quelle senza coordinate", () => {
    const elenco = [
      o('senza1', null, null),
      o('milano', milano.latitudine, milano.longitudine),
      o('senza2', 45, null),
      o('torino', torino.latitudine, torino.longitudine),
    ];
    const r = ordinaPerDistanza(elenco, torino);
    expect(r.map((x) => x.nome)).toEqual(['torino', 'milano', 'senza1', 'senza2']);
    expect(r[0]!.distanza_km).toBe(0);
    expect(r[1]!.distanza_km).toBeGreaterThan(120);
    expect(r[2]!.distanza_km).toBeNull();
    // l'elenco ricevuto non cambia
    expect(elenco[0]!.nome).toBe('senza1');
  });
});
