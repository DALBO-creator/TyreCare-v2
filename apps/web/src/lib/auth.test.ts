import { AuthApiError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
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
