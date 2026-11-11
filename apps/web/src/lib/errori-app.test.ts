// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
const sessione = vi.fn();
vi.mock('./supabase', () => ({
  getSupabase: () => ({ from: (t: string) => ({ insert: (r: unknown) => insert(t, r) }) }),
}));
vi.mock('./auth', () => ({ sessioneCorrente: () => sessione() }));

import { ErroreModulo } from './errori';
import { _azzeraPerTest, preparaErrore, segnalaErrore } from './errori-app';

beforeEach(() => {
  _azzeraPerTest();
  insert.mockReset().mockResolvedValue({ error: null });
  sessione.mockReturnValue({ user: { id: 'u' } });
  history.replaceState(null, '', '/pagina');
});
afterEach(() => vi.restoreAllMocks());

describe('preparaErrore', () => {
  it('tronca ai limiti della tabella', () => {
    const e = new Error('m'.repeat(900));
    e.stack = 's'.repeat(5000);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('a'.repeat(900));
    history.replaceState(null, '', '/' + 'p'.repeat(400));
    const r = preparaErrore(e);
    expect(r.messaggio).toHaveLength(500);
    expect(r.dettaglio).toHaveLength(2000);
    expect(r.agente).toHaveLength(300);
    expect(r.percorso).toHaveLength(200);
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('percorso senza query e hash', () => {
    history.replaceState(null, '', '/invito/ABC?codice=x#y');
    expect(preparaErrore(new Error('x')).percorso).toBe('/invito/ABC');
  });

  it('versione assente = stringa vuota, presente troncata a 40', () => {
    expect(preparaErrore(new Error('x')).versione).toBe('');
    vi.stubGlobal('__VERSIONE_APP__', 'v'.repeat(80));
    expect(preparaErrore(new Error('x')).versione).toHaveLength(40);
    vi.unstubAllGlobals();
  });

  it('messaggio mai vuoto, stringhe accettate, contesto in testa, niente autore_id', () => {
    expect(preparaErrore(new Error('')).messaggio).toBe('Errore sconosciuto');
    expect(preparaErrore(undefined).messaggio).toBe('Errore sconosciuto');
    expect(preparaErrore('boom').messaggio).toBe('boom');
    expect(preparaErrore(new Error('x'), 'caricamento').messaggio).toBe('[caricamento] x');
    expect(preparaErrore(new Error('x'))).not.toHaveProperty('autore_id');
  });
});

describe('segnalaErrore', () => {
  it('invia la riga a errori_app (caso positivo)', () => {
    segnalaErrore(new Error('guasto'));
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]![0]).toBe('errori_app');
    expect(insert.mock.calls[0]![1]).toMatchObject({ messaggio: 'guasto', percorso: '/pagina' });
  });

  it('non invia senza sessione', () => {
    sessione.mockReturnValue(null);
    segnalaErrore(new Error('guasto'));
    expect(insert).not.toHaveBeenCalled();
    sessione.mockReturnValue({});
    segnalaErrore(new Error('guasto'));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('non invia offline', () => {
    const spia = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    segnalaErrore(new Error('guasto'));
    expect(insert).not.toHaveBeenCalled();
    spia.mockReturnValue(true);
    segnalaErrore(new Error('guasto'));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('non invia errori di rete né ErroreModulo', () => {
    segnalaErrore(new TypeError('Failed to fetch'));
    segnalaErrore({ message: 'TypeError: Failed to fetch' });
    segnalaErrore(new ErroreModulo('campo'));
    expect(insert).not.toHaveBeenCalled();
    segnalaErrore(new Error('altro'));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("non ripete lo stesso messaggio nella stessa pagina, ma sì in un'altra", () => {
    segnalaErrore(new Error('uguale'));
    segnalaErrore(new Error('uguale'));
    expect(insert).toHaveBeenCalledTimes(1);
    segnalaErrore(new Error('diverso'));
    expect(insert).toHaveBeenCalledTimes(2);
    history.replaceState(null, '', '/altra');
    segnalaErrore(new Error('uguale'));
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it('al massimo 5 invii per caricamento', () => {
    for (let i = 0; i < 8; i++) segnalaErrore(new Error(`e${i}`));
    expect(insert).toHaveBeenCalledTimes(5);
  });

  it("ignora i rifiuti e le eccezioni dell'invio, e non lancia", async () => {
    insert.mockRejectedValueOnce(new Error('rifiutato'));
    expect(() => segnalaErrore(new Error('a'))).not.toThrow();
    insert.mockImplementationOnce(() => {
      throw new Error('sincrono');
    });
    expect(() => segnalaErrore(new Error('b'))).not.toThrow();
    await Promise.resolve();
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
