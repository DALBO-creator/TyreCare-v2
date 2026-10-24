import { describe, expect, it, vi } from 'vitest';
import { leggiTutte } from './a-pagine';

/** Finto database con `n` righe numerate: risponde come `.range(da, a)`. */
function finto(n: number) {
  return vi.fn((da: number, a: number) => {
    const righe = Array.from({ length: n }, (_, i) => i).slice(da, a + 1);
    return Promise.resolve({ data: righe, error: null });
  });
}

describe('leggiTutte', () => {
  it('con 0 righe fa una sola chiamata', async () => {
    const pagina = finto(0);
    expect(await leggiTutte(pagina)).toEqual([]);
    expect(pagina).toHaveBeenCalledTimes(1);
    expect(pagina).toHaveBeenCalledWith(0, 999);
  });

  it('con 1001 righe fa due chiamate e le restituisce tutte in ordine', async () => {
    const pagina = finto(1001);
    const r = await leggiTutte(pagina);
    expect(r).toHaveLength(1001);
    expect(r[0]).toBe(0);
    expect(r[1000]).toBe(1000);
    expect(pagina).toHaveBeenCalledTimes(2);
    expect(pagina).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("con 2000 righe esatte fa tre chiamate, l'ultima vuota", async () => {
    const pagina = finto(2000);
    expect(await leggiTutte(pagina)).toHaveLength(2000);
    expect(pagina).toHaveBeenCalledTimes(3);
    expect(pagina).toHaveBeenNthCalledWith(3, 2000, 2999);
  });

  it("rifiuta con l'errore della seconda pagina", async () => {
    const errore = new Error('rete');
    const pagina = vi
      .fn()
      .mockResolvedValueOnce({ data: new Array(1000).fill(1), error: null })
      .mockResolvedValueOnce({ data: null, error: errore });
    await expect(leggiTutte(pagina)).rejects.toBe(errore);
    expect(pagina).toHaveBeenCalledTimes(2);
  });

  it('rispetta una dimensione diversa', async () => {
    const pagina = finto(5);
    expect(await leggiTutte(pagina, 2)).toHaveLength(5);
    expect(pagina).toHaveBeenCalledTimes(3);
    expect(pagina).toHaveBeenNthCalledWith(2, 2, 3);
  });
});
