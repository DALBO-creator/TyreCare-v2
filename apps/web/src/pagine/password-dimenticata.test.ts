// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resetPasswordForEmail } = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ auth: { resetPasswordForEmail } }),
  chiaveSessione: () => 'chiave',
}));

import { mostraPasswordDimenticata } from './password-dimenticata';

const email = () => document.querySelector<HTMLInputElement>('[name="email"]')!;
const invia = () => document.querySelector('form')!.requestSubmit();

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  history.replaceState(null, '', '/password-dimenticata');
  document.body.innerHTML = '<div id="app"></div>';
  mostraPasswordDimenticata(document.getElementById('app')!);
});

describe('pagina Password dimenticata', () => {
  it('con un’email non valida mostra l’errore e non invia nulla', async () => {
    email().value = 'mario@';
    invia();
    await vi.waitFor(() => expect(email().getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById('campo-email-errore')!.textContent).toBe(
      "Controlla l'email: sembra incompleta (es. nome@esempio.it)",
    );
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('con un’email valida mostra «Controlla la posta»', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    email().value = 'mario@esempio.it';
    invia();
    await vi.waitFor(() =>
      expect(document.querySelector('h1')!.textContent).toContain('Controlla la posta'),
    );
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail.mock.calls[0]![0]).toBe('mario@esempio.it');
    expect(document.body.textContent).toContain('mario@esempio.it');
  });
});
