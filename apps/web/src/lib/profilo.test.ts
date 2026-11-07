import { describe, expect, it } from 'vitest';
import { messaggioEliminazione } from './profilo';

describe('messaggioEliminazione', () => {
  it('traduce le chiavi della funzione elimina_account', () => {
    expect(messaggioEliminazione('TITOLARE_DI_OFFICINA')).toContain('titolare di un');
    expect(messaggioEliminazione('PRENOTAZIONI_IN_CORSO')).toContain('appuntamenti in corso');
    expect(messaggioEliminazione('ACCOUNT_AMMINISTRATORE')).toContain('amministratore');
  });
  it('spiega la richiesta di aiuto su strada in corso', () => {
    expect(messaggioEliminazione('RICHIESTA_STRADA_IN_CORSO')).toBe(
      'Hai una richiesta di aiuto su strada in corso: annullala da «Aiuto su strada» e riprova.',
    );
  });
  it('lascia sconosciuti gli altri errori', () => {
    expect(messaggioEliminazione('altro')).toBeUndefined();
    expect(messaggioEliminazione(undefined)).toBeUndefined();
  });
});
