import { describe, expect, it, vi } from 'vitest';
import {
  bloccaUtente,
  descriviVoce,
  dettagliVoce,
  leggiRiepilogo,
  normalizzaCodice,
  verificaCodice2fa,
} from './admin-pannello';

const rpc = vi.fn();
const challengeAndVerify = vi.fn();
vi.mock('./supabase', () => ({
  getSupabase: () => ({ rpc, auth: { mfa: { challengeAndVerify } } }),
}));

describe('normalizzaCodice', () => {
  it('accetta 6 cifre, anche con spazi', () => {
    expect(normalizzaCodice('123456')).toBe('123456');
    expect(normalizzaCodice(' 123 456 ')).toBe('123456');
  });
  it('rifiuta il resto', () => {
    expect(normalizzaCodice('12345')).toBeNull();
    expect(normalizzaCodice('12345a')).toBeNull();
    expect(normalizzaCodice('1234567')).toBeNull();
  });
});

describe('verificaCodice2fa', () => {
  it('non chiama Supabase con un codice malformato', async () => {
    await expect(verificaCodice2fa('f', 'abc')).rejects.toThrow('6 cifre');
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });
  it('codice sbagliato: messaggio chiaro', async () => {
    challengeAndVerify.mockResolvedValueOnce({ error: { message: 'Invalid TOTP code' } });
    await expect(verificaCodice2fa('f', '000000')).rejects.toThrow('Codice non valido');
  });
});

describe('leggiRiepilogo', () => {
  it('voci mancanti o non numeriche valgono 0', () => {
    const r = leggiRiepilogo({ utenti: 12, officine_attive: '3', controlli: 'x' });
    expect(r.utenti).toBe(12);
    expect(r.officine_attive).toBe(3);
    expect(r.controlli).toBe(0);
    expect(r.veicoli).toBe(0);
  });
  it('json non oggetto: tutto 0', () => {
    expect(leggiRiepilogo(null).utenti).toBe(0);
    expect(leggiRiepilogo([1, 2]).utenti).toBe(0);
  });
});

describe('leggiRiepilogo, abbonamenti', () => {
  it('tiene i decimali del ricavo mensile', () => {
    const r = leggiRiepilogo({ abbonamenti_attivi: 3, prove_in_corso: 2, ricavo_mensile: 175.5 });
    expect(r.ricavo_mensile).toBe(175.5);
    expect(r.abbonamenti_attivi).toBe(3);
    expect(r.prove_in_corso).toBe(2);
  });

  it('vale 0 se le voci mancano', () => {
    const r = leggiRiepilogo({ utenti: 1 });
    expect(r.ricavo_mensile).toBe(0);
    expect(r.abbonamenti_attivi).toBe(0);
    expect(r.prove_in_corso).toBe(0);
  });
});

describe('registro', () => {
  it('descrive le voci', () => {
    expect(descriviVoce({ azione: 'update', tabella: 'officine' })).toBe('Modifica · officina');
    expect(descriviVoce({ azione: 'blocca', tabella: 'auth.users' })).toBe('Account bloccato');
    expect(descriviVoce({ azione: 'nuova', tabella: 'x' })).toBe('nuova · x');
  });
  it('modifiche come vecchio → nuovo', () => {
    expect(
      dettagliVoce({ azione: 'update', dettagli: { stato_affiliazione: ['IN_ATTESA', 'ATTIVA'] } }),
    ).toEqual(['stato_affiliazione: IN_ATTESA → ATTIVA']);
    expect(dettagliVoce({ azione: 'update', dettagli: { telefono: ['+39 1', null] } })).toEqual([
      'telefono: +39 1 → —',
    ]);
  });
  it('eliminazione senza le date', () => {
    expect(
      dettagliVoce({ azione: 'delete', dettagli: { ragione_sociale: 'X', created_at: 'oggi' } }),
    ).toEqual(['ragione_sociale: X']);
  });
});

describe('errori delle funzioni admin', () => {
  it('traduce le chiavi note e il 42501', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'NON_SI_BLOCCA_UN_ADMIN', code: 'P0001' } });
    await expect(bloccaUtente('a', true)).rejects.toThrow('non si può bloccare');
    rpc.mockResolvedValueOnce({ error: { message: 'permission denied', code: '42501' } });
    await expect(bloccaUtente('a', true)).rejects.toThrow('verifica in due passaggi');
  });
});
