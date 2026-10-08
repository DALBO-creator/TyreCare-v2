import { describe, expect, it, vi } from 'vitest';
import { conRiprova, erroreDiRete } from './rete';

const errRete = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' };
const errDb = { message: 'duplicate key value', details: '', hint: '', code: '23505' };

describe('erroreDiRete', () => {
  it('riconosce gli errori di fetch dei vari browser', () => {
    expect(erroreDiRete(errRete)).toBe(true);
    expect(erroreDiRete({ ...errRete, message: 'TypeError: Load failed' })).toBe(true); // Safari
    expect(erroreDiRete(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      true,
    );
  });

  it('non confonde gli errori del database', () => {
    expect(erroreDiRete(errDb)).toBe(false);
    expect(erroreDiRete(null)).toBe(false);
  });
});

describe('conRiprova', () => {
  it('ripete una volta dopo un errore di rete', async () => {
    const richiesta = vi
      .fn()
      .mockResolvedValueOnce({ error: errRete, status: 0 })
      .mockResolvedValueOnce({ error: null, status: 201 });
    await expect(conRiprova(richiesta)).resolves.toEqual({ error: null, status: 201 });
    expect(richiesta).toHaveBeenCalledTimes(2);
  });

  it('non ripete gli errori del database né le richieste riuscite', async () => {
    const errore = vi.fn().mockResolvedValue({ error: errDb, status: 409 });
    await conRiprova(errore);
    expect(errore).toHaveBeenCalledTimes(1);

    const riuscita = vi.fn().mockResolvedValue({ error: null, status: 201 });
    await conRiprova(riuscita);
    expect(riuscita).toHaveBeenCalledTimes(1);
  });

  it('ripete una sola volta', async () => {
    const richiesta = vi.fn().mockResolvedValue({ error: errRete, status: 0 });
    await expect(conRiprova(richiesta)).resolves.toMatchObject({ status: 0 });
    expect(richiesta).toHaveBeenCalledTimes(2);
  });
});
