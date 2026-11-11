// @vitest-environment happy-dom
import { PASSWORD_MIN, VERSIONE_TERMINI } from '@tyrecare/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ auth: { signUp } }),
  chiaveSessione: () => 'chiave',
}));

import { mostraRegistrati } from './registrati';

const campoDi = (nome: string) => document.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const invia = () => document.querySelector('form')!.requestSubmit();
const errore = (nome: string) => document.getElementById(`campo-${nome}-errore`)!;

function compila(password = 'password123', accetto = true) {
  campoDi('nome').value = 'Mario';
  campoDi('cognome').value = 'Rossi';
  campoDi('email').value = 'mario@esempio.it';
  campoDi('password').value = password;
  campoDi('accetto').checked = accetto;
}

beforeEach(() => {
  signUp.mockReset();
  history.replaceState(null, '', '/registrati');
  document.body.innerHTML = '<div id="app"></div>';
  mostraRegistrati(document.getElementById('app')!);
});

describe('pagina Registrati', () => {
  it('con i termini non spuntati mostra l’errore e non registra', async () => {
    compila('password123', false);
    invia();
    await vi.waitFor(() => expect(campoDi('accetto').getAttribute('aria-invalid')).toBe('true'));
    expect(errore('accetto').textContent).toBe("Per creare l'account devi accettare i termini");
    expect(signUp).not.toHaveBeenCalled();
  });

  it('con la password corta mostra l’errore e non registra', async () => {
    compila('a'.repeat(PASSWORD_MIN - 1));
    invia();
    await vi.waitFor(() => expect(campoDi('password').getAttribute('aria-invalid')).toBe('true'));
    expect(errore('password').textContent).toBe(
      `La password deve avere almeno ${PASSWORD_MIN} caratteri`,
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('con dati validi chiama signUp con la versione dei termini nei metadati', async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    compila();
    invia();
    await vi.waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'mario@esempio.it',
        password: 'password123',
        options: expect.objectContaining({
          data: { nome: 'Mario', cognome: 'Rossi', termini_versione: VERSIONE_TERMINI },
        }),
      }),
    );
    await vi.waitFor(() =>
      expect(document.querySelector('h1')!.textContent).toContain('Controlla la posta'),
    );
  });
});
