import { beforeEach, describe, expect, it, vi } from 'vitest';
import { caricaErroriApp, raggruppaErrori, type RigaErrore } from './admin-errori';

const catena = {
  select: vi.fn(),
  gte: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
};
const from = vi.fn();
vi.mock('./supabase', () => ({ getSupabase: () => ({ from }) }));

const r = (id: string, over: Partial<RigaErrore> = {}): RigaErrore => ({
  id,
  autore_id: 'u1',
  percorso: '/garage',
  messaggio: 'guasto',
  dettaglio: '',
  versione: 'v1',
  agente: 'x',
  created_at: '2026-11-10T10:00:00Z',
  ...over,
});

describe('raggruppaErrori', () => {
  it('elenco vuoto → nessun gruppo', () => {
    expect(raggruppaErrori([])).toEqual([]);
  });

  it('due messaggi: gruppi dal più recente', () => {
    const g = raggruppaErrori([
      r('a', { messaggio: 'A', created_at: '2026-11-01T10:00:00Z' }),
      r('b', { messaggio: 'B', created_at: '2026-11-05T10:00:00Z' }),
      r('c', { messaggio: 'A', created_at: '2026-11-03T10:00:00Z' }),
    ]);
    expect(g.map((x) => x.messaggio)).toEqual(['B', 'A']);
    expect(g[1]!.volte).toBe(2);
    expect(g[1]!.ultima).toBe('2026-11-03T10:00:00Z');
  });

  it('stesso messaggio da 2 utenti con stesso percorso', () => {
    const [g] = raggruppaErrori([r('a'), r('b', { autore_id: 'u2' }), r('c', { autore_id: 'u2' })]);
    expect(g!.volte).toBe(3);
    expect(g!.utenti).toBe(2);
    expect(g!.percorsi).toEqual(['/garage']);
    expect(g!.versioni).toEqual(['v1']);
  });

  it('12 occorrenze → ne tiene 10, le più recenti per prime', () => {
    const righe = Array.from({ length: 12 }, (_, i) =>
      r(`id${i}`, { created_at: `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z` }),
    );
    const [g] = raggruppaErrori(righe);
    expect(g!.volte).toBe(12);
    expect(g!.occorrenze).toHaveLength(10);
    expect(g!.occorrenze[0]!.id).toBe('id11');
    expect(g!.occorrenze[9]!.id).toBe('id2');
  });

  it('esclude i valori vuoti da percorsi e versioni, senza doppioni', () => {
    const [g] = raggruppaErrori([
      r('a', { percorso: '', versione: '' }),
      r('b', { percorso: '/a', versione: 'v2' }),
      r('c', { percorso: '/b', versione: 'v1' }),
      r('d', { percorso: '/a', versione: 'v2' }),
    ]);
    expect(g!.percorsi.sort()).toEqual(['/a', '/b']);
    expect(g!.versioni.sort()).toEqual(['v1', 'v2']);
  });

  it('non modifica l’elenco ricevuto', () => {
    const entrata = [
      r('a', { created_at: '2026-11-01T10:00:00Z' }),
      r('b', { created_at: '2026-11-02T10:00:00Z' }),
    ];
    raggruppaErrori(entrata);
    expect(entrata.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('caricaErroriApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue(catena);
    catena.select.mockReturnValue(catena);
    catena.gte.mockReturnValue(catena);
    catena.order.mockReturnValue(catena);
    catena.range.mockResolvedValue({ data: [r('a')], error: null });
  });

  it('filtra gli ultimi 30 giorni e ordina per data e poi per id', async () => {
    const righe = await caricaErroriApp(new Date('2026-11-13T12:00:00Z'));
    expect(righe).toHaveLength(1);
    expect(from).toHaveBeenCalledWith('errori_app');
    expect(catena.gte).toHaveBeenCalledWith('created_at', '2026-10-14T12:00:00.000Z');
    expect(catena.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(catena.order).toHaveBeenNthCalledWith(2, 'id');
    expect(catena.range).toHaveBeenCalledWith(0, 999);
  });

  it('lancia l’errore del database', async () => {
    catena.range.mockResolvedValue({ data: null, error: new Error('no') });
    await expect(caricaErroriApp()).rejects.toThrow('no');
  });
});
