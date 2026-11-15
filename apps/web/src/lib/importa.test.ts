import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc }) }));

import { ErroreModulo } from './errori';
import { annullaImport } from './importa';

const ESITO = { veicoli_tolti: 3, clienti_tolti: 2, veicoli_tenuti: 1, clienti_tenuti: 0 };

describe('annullaImport', () => {
  beforeEach(() => rpc.mockReset());

  it('chiama la funzione e restituisce i quattro numeri', async () => {
    rpc.mockResolvedValue({ data: ESITO, error: null });
    await expect(annullaImport('i1')).resolves.toEqual(ESITO);
    expect(rpc).toHaveBeenCalledWith('annulla_import', { p_import_id: 'i1' });
  });

  it.each([
    ['numero mancante', { ...ESITO, clienti_tenuti: undefined }],
    ['numero negativo', { ...ESITO, veicoli_tolti: -1 }],
    ['numero con decimali', { ...ESITO, clienti_tolti: 1.5 }],
    ['testo al posto del numero', { ...ESITO, veicoli_tenuti: '1' }],
    ['risposta nulla', null],
  ])('risposta non valida (%s): ErroreModulo', async (_nome, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const e = await annullaImport('i1').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroreModulo);
    expect((e as Error).message).toBe(
      "Risposta inattesa dal server: ricarica la pagina per vedere com'è andata.",
    );
  });

  it.each([
    [
      'IMPORT_NON_ULTIMO',
      "Si può annullare solo l'ultimo import di clienti e veicoli, e ce n'è uno più recente: ricarica la pagina.",
    ],
    ['IMPORT_SCADUTO', 'Sono passati più di 7 giorni: questo import non si può più annullare.'],
    ['IMPORT_GIA_ANNULLATO', 'Questo import è già stato annullato: ricarica la pagina.'],
  ])('%s: messaggio in italiano e chiave nel codice', async (chiave, messaggio) => {
    rpc.mockResolvedValue({ data: null, error: { message: chiave, code: 'P0001' } });
    const e = await annullaImport('i1').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroreModulo);
    expect((e as Error).message).toBe(messaggio);
    expect((e as ErroreModulo).codice).toBe(chiave);
  });

  it('42501: solo il titolare', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Accesso riservato', code: '42501' } });
    await expect(annullaImport('i1')).rejects.toThrow(
      "Solo il titolare dell'officina può annullare un import.",
    );
  });

  it('errore sconosciuto: rilanciato', async () => {
    const errore = { message: 'boh', code: 'XX000' };
    rpc.mockResolvedValue({ data: null, error: errore });
    await expect(annullaImport('i1')).rejects.toBe(errore);
  });
});
