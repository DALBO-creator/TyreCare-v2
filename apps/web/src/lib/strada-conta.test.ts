import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contaRichiesteStradaVicine } from './strada-conta';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc }) }));

const OFFICINA = 'b0000000-0000-4000-8000-000000000001';

describe('contaRichiesteStradaVicine', () => {
  beforeEach(() => rpc.mockReset());

  it('restituisce il numero di righe e passa l’officina alla rpc', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null });
    expect(await contaRichiesteStradaVicine(OFFICINA)).toBe(3);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('richieste_strada_vicine', { p_officina_id: OFFICINA });
  });

  it('data nullo → 0', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await contaRichiesteStradaVicine(OFFICINA)).toBe(0);
  });

  it('elenco vuoto → 0', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await contaRichiesteStradaVicine(OFFICINA)).toBe(0);
  });

  it('errore della rpc → rifiuta con quell’errore', async () => {
    const errore = new Error('rete');
    rpc.mockResolvedValue({ data: null, error: errore });
    await expect(contaRichiesteStradaVicine(OFFICINA)).rejects.toBe(errore);
  });
});
