// Supabase finto per i test di `lib/`: `rpc` registrata e un costruttore a catena che registra ogni
// chiamata. Lo importano solo i test (mai il codice dell'app: non deve finire nella build).
//
// Uso nel test (`vi.mock` va nel file di test, perché Vitest lo solleva in cima):
//   vi.mock('./supabase', async () => {
//     const f = await import('../test/supabase-finto');
//     return { getSupabase: () => ({ rpc: f.rpc, from: f.from }) };
//   });
//   beforeEach(() => azzeraFinto());
import { vi } from 'vitest';

export type RisultatoFinto = { data?: unknown; count?: number | null; error: unknown };

export const rpc = vi.fn();
export const from = vi.fn();
/** Ogni metodo della catena chiamato, nell'ordine: `[nome, ...argomenti]`. */
export const chiamate: [string, ...unknown[]][] = [];
/** Risultato con cui si risolve la catena (è thenable): lo imposta il test con `finto.risultato = …`. */
export const finto: { risultato: RisultatoFinto } = {
  risultato: { data: [], count: 0, error: null },
};

const METODI = ['select', 'eq', 'gte', 'in', 'order', 'limit', 'maybeSingle'];

export function catena() {
  const c: Record<string, unknown> = {};
  for (const m of METODI) {
    c[m] = (...args: unknown[]) => {
      chiamate.push([m, ...args]);
      return c;
    };
  }
  c.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(finto.risultato).then(ok, ko);
  return c;
}

/** Da chiamare in `beforeEach`: azzera i mock, le chiamate registrate e il risultato di default. */
export function azzeraFinto() {
  vi.clearAllMocks();
  chiamate.length = 0;
  finto.risultato = { data: [], count: 0, error: null };
  from.mockImplementation(() => catena());
  rpc.mockResolvedValue({ data: null, error: null, status: 200 });
}
