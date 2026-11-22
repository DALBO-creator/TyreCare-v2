import { AuthApiError } from '@supabase/supabase-js';
import { PASSWORD_MIN } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Supabase from './supabase';
import { messaggioErrore } from './auth';

describe('messaggioErrore', () => {
  it("riconosce l'email di conferma non inviata", () => {
    const errore = new AuthApiError('Error sending confirmation email', 500, 'unexpected_failure');
    expect(messaggioErrore(errore)).toMatch(/Non riusciamo a inviarti l'email/);
  });

  it('usa il messaggio del codice quando lo conosce', () => {
    const errore = new AuthApiError('User already registered', 422, 'user_already_exists');
    expect(messaggioErrore(errore)).toBe(
      'Esiste già un account con questa email. Prova ad accedere.',
    );
  });

  it('weak_password dice i requisiti della password', () => {
    const errore = new AuthApiError(
      'Password is known to be weak and easy to guess',
      422,
      'weak_password',
    );
    const messaggio = messaggioErrore(errore);
    expect(messaggio).toBe(
      'Password troppo debole: usa almeno 10 caratteri, con una maiuscola, una minuscola e un numero, ed evita le password più comuni.',
    );
    // il 10 è scritto nel testo (auth.ts non importa shared): questo lo tiene allineato
    expect(messaggio).toContain(`almeno ${PASSWORD_MIN} caratteri`);
  });
});

describe('esci', () => {
  const signOut = vi.fn();
  const removeItem = vi.fn();
  const assign = vi.fn();
  const getSession = vi.fn();

  beforeEach(() => {
    signOut.mockReset();
    removeItem.mockReset();
    assign.mockReset();
    getSession.mockReset();
    vi.stubGlobal('localStorage', { removeItem });
    vi.stubGlobal('location', { assign });
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd.supabase.co');
    vi.doMock('./supabase', async (originale) => ({
      ...(await originale<typeof Supabase>()),
      getSupabase: () => ({ auth: { signOut, getSession, onAuthStateChange: vi.fn() } }),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./supabase');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('senza rete cancella la sessione locale e torna ad /accedi senza errore', async () => {
    signOut.mockResolvedValue({ error: new Error('Failed to fetch') });
    const { esci } = await import('./auth');
    await expect(esci()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith('sb-abcd-auth-token');
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/accedi');
  });

  it('senza rete azzera anche la sessione in memoria', async () => {
    const utente = { access_token: 't', user: { id: 'u1' } };
    getSession.mockResolvedValue({ data: { session: utente } });
    signOut.mockResolvedValue({ error: new Error('Failed to fetch') });
    const { esci, inizializzaAuth, sessioneCorrente } = await import('./auth');
    await inizializzaAuth(() => {});
    expect(sessioneCorrente()).toBe(utente);
    await esci();
    expect(sessioneCorrente()).toBeNull();
  });

  it('senza errore non tocca localStorage né la pagina', async () => {
    signOut.mockResolvedValue({ error: null });
    const { esci } = await import('./auth');
    await esci();
    expect(removeItem).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
