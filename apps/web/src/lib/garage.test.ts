import { describe, expect, it } from 'vitest';
import type { Pneumatico } from './officina';
import { unisciPerTarga, type ControlloScheda, type SchedaGarage } from './garage';

const officina = (id: string, ragione_sociale: string) => ({
  id,
  ragione_sociale,
  indirizzo: '',
  citta: 'Torino',
  telefono: null,
});

const scheda = (s: Partial<SchedaGarage> & Pick<SchedaGarage, 'id' | 'targa'>): SchedaGarage => ({
  marca: '',
  modello: '',
  anno: null,
  created_at: '2026-01-01T10:00:00Z',
  officina: null,
  pneumatici: [],
  controlli: [],
  ...s,
});

const controllo = (id: string, eseguito_il: string, mm: number): ControlloScheda => ({
  id,
  eseguito_il,
  km: null,
  note: '',
  created_at: `${eseguito_il}T10:00:00Z`,
  misure: [
    {
      battistrada_mm: mm,
      pressione_bar: null,
      usura: null,
      danni: '',
      pneumatico: { id: 'p1', posizione: 'ANT_SX', stagione: 'ESTIVO' },
    },
  ],
});

const pneumatico = (id: string, montato_il: string, marca: string) =>
  ({ id, posizione: 'ANT_SX', stagione: 'ESTIVO', marca, montato_il }) as Pneumatico;

describe('unisciPerTarga', () => {
  it('unisce le schede della stessa targa con lo storico di tutte le officine', () => {
    const [panda, ...altri] = unisciPerTarga([
      scheda({
        id: 'a',
        targa: 'AB123CD',
        marca: 'Fiat',
        modello: 'Panda',
        officina: officina('o1', 'Gomme Rossi'),
        controlli: [controllo('c1', '2026-03-01', 6)],
      }),
      scheda({
        id: 'b',
        targa: 'AB123CD',
        marca: 'FIAT',
        modello: 'Panda 1.2',
        officina: officina('o2', 'Pneus Express'),
        controlli: [controllo('c2', '2026-09-14', 1.4)],
      }),
    ]);

    expect(altri).toHaveLength(0);
    expect(panda!.controlli.map((c) => [c.id, c.officina])).toEqual([
      ['c2', 'Pneus Express'],
      ['c1', 'Gomme Rossi'],
    ]);
    // Stato, nome e officine dall'officina che l'ha visto per ultima
    expect(panda!.stato).toBe('ROSSO');
    expect(panda!.modello).toBe('Panda 1.2');
    expect(panda!.officine.map((o) => o.ragione_sociale)).toEqual(['Pneus Express', 'Gomme Rossi']);
  });

  it("prende gli pneumatici dall'officina che li ha montati più di recente", () => {
    const [v] = unisciPerTarga([
      scheda({
        id: 'a',
        targa: 'AB123CD',
        officina: officina('o1', 'Gomme Rossi'),
        pneumatici: [pneumatico('p1', '2025-11-10', 'Michelin')],
      }),
      scheda({
        id: 'b',
        targa: 'AB123CD',
        officina: officina('o2', 'Pneus Express'),
        pneumatici: [pneumatico('p2', '2026-04-02', 'Pirelli')],
      }),
      // Officina che ha registrato l'auto senza pneumatici: non li cancella
      scheda({ id: 'c', targa: 'AB123CD', created_at: '2026-06-01T10:00:00Z' }),
    ]);
    expect(v!.pneumatici.map((p) => p.marca)).toEqual(['Pirelli']);
    expect(v!.officinaPneumatici).toBe('Pneus Express');
  });

  it("un nome vuoto non copre quello di un'altra officina", () => {
    const [v] = unisciPerTarga([
      scheda({ id: 'a', targa: 'AB123CD', marca: 'Fiat', modello: 'Panda', anno: 2019 }),
      scheda({ id: 'b', targa: 'AB123CD', created_at: '2026-06-01T10:00:00Z' }),
    ]);
    expect([v!.marca, v!.modello, v!.anno]).toEqual(['Fiat', 'Panda', 2019]);
  });

  it('ordina per urgenza e poi per targa; senza controlli lo stato è nullo', () => {
    const veicoli = unisciPerTarga([
      scheda({ id: 'a', targa: 'AA111AA' }),
      scheda({ id: 'b', targa: 'ZZ999ZZ', controlli: [controllo('c1', '2026-09-01', 1)] }),
      scheda({ id: 'c', targa: 'BB222BB', controlli: [controllo('c2', '2026-09-01', 7)] }),
    ]);
    expect(veicoli.map((v) => [v.targa, v.stato])).toEqual([
      ['ZZ999ZZ', 'ROSSO'],
      ['BB222BB', 'VERDE'],
      ['AA111AA', null],
    ]);
  });
});
