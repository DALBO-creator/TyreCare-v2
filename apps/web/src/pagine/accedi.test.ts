// @vitest-environment happy-dom
import { AuthError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ auth: { signInWithPassword } }),
  chiaveSessione: () => 'chiave',
}));

import { mostraAccedi } from './accedi';

const campoDi = (nome: string) => document.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const invia = () => document.querySelector('form')!.requestSubmit();
const riquadro = () => document.querySelector<HTMLElement>('[data-errore-modulo]')!;

beforeEach(() => {
  signInWithPassword.mockReset();
  history.replaceState(null, '', '/accedi');
  document.body.innerHTML = '<div id="app"></div>';
  mostraAccedi(document.getElementById('app')!);
});

describe('pagina Accedi', () => {
  it('con i campi vuoti segnala gli errori con aria-invalid e non chiama l’accesso', async () => {
    invia();
    await vi.waitFor(() => expect(campoDi('email').getAttribute('aria-invalid')).toBe('true'));
    expect(campoDi('password').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('campo-email-errore')!.textContent).toBe(
      'Inserisci la tua email',
    );
    expect(document.getElementById('campo-password-errore')!.textContent).toBe(
      'Inserisci la password',
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('con credenziali errate mostra il messaggio della pagina', async () => {
    signInWithPassword.mockResolvedValue({
      error: new AuthError('Invalid login credentials', 400, 'invalid_credentials'),
    });
    campoDi('email').value = 'mario@esempio.it';
    campoDi('password').value = 'sbagliata1';
    invia();
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    expect(riquadro().textContent?.trim()).toBe('Email o password non corrette.');
  });

  it('con dati validi chiama l’accesso con email e password', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    campoDi('email').value = ' mario@esempio.it ';
    campoDi('password').value = 'Password123';
    invia();
    await vi.waitFor(() => expect(signInWithPassword).toHaveBeenCalledTimes(1));
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'mario@esempio.it',
      password: 'Password123',
    });
    expect(riquadro().hidden).toBe(true);
  });
});
