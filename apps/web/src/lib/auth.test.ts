import { AuthApiError } from '@supabase/supabase-js';
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
});

describe('esci', () => {
  const signOut = vi.fn();
  const removeItem = vi.fn();

  beforeEach(() => {
    signOut.mockReset();
    removeItem.mockReset();
    vi.stubGlobal('localStorage', { removeItem });
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd.supabase.co');
    vi.doMock('./supabase', async (originale) => ({
      ...(await originale<typeof Supabase>()),
      getSupabase: () => ({ auth: { signOut } }),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./supabase');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('senza rete cancella la sessione locale e rilancia l’errore', async () => {
    const errore = new Error('Failed to fetch');
    signOut.mockResolvedValue({ error: errore });
    const { esci } = await import('./auth');
    await expect(esci()).rejects.toBe(errore);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(removeItem).toHaveBeenCalledWith('sb-abcd-auth-token');
  });

  it('senza errore non tocca localStorage', async () => {
    signOut.mockResolvedValue({ error: null });
    const { esci } = await import('./auth');
    await esci();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
