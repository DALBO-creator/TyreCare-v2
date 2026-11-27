// @vitest-environment happy-dom
import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_auth from '../lib/auth';
import type * as M_mfa from '../lib/mfa';
import type * as M_router from '../lib/router';

const { esci, sessioneCorrente } = vi.hoisted(() => ({
  esci: vi.fn(),
  sessioneCorrente: vi.fn(),
}));
const { disattiva, iniziaAttivazione, verificaCodice } = vi.hoisted(() => ({
  disattiva: vi.fn(),
  iniziaAttivazione: vi.fn(),
  verificaCodice: vi.fn(),
}));
const { tornaAlProfilo } = vi.hoisted(() => ({ tornaAlProfilo: vi.fn() }));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// `messaggioErrore` resta vero: la traduzione del codice errato si prova dal codice di Supabase
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof M_auth>()),
  esci,
  sessioneCorrente,
}));
// `fattoreAttivo` resta vera: lo stato «2FA attiva» dipende dai fattori della sessione finta
vi.mock('../lib/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof M_mfa>()),
  disattiva,
  iniziaAttivazione,
  verificaCodice,
}));
vi.mock('./profilo', () => ({ tornaAlProfilo }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraAdminSenza2fa, mostraCodiceAccesso, mostraSicurezza } from './sicurezza';

const QR_SVG = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const ID_FATTORE = 'fattore-1';
const SEGRETO = 'JBSWY3DPEHPK3PXP';
const MSG_ATTIVATA =
  'Verifica in due passaggi attivata: al prossimo accesso ti chiederemo il codice.';
const MSG_CODICE_ERRATO = 'Codice non valido o scaduto: riprova con quello nuovo.';

const sessione = (conFattore: boolean) => ({
  access_token: 'x.y.z',
  user: {
    factors: conFattore ? [{ id: ID_FATTORE, factor_type: 'totp', status: 'verified' }] : [],
  },
});

const erroreCodice = () =>
  new AuthApiError('Invalid TOTP code entered', 400, 'mfa_verification_failed');

const app = () => document.getElementById('app')!;
const testo = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
const pulsante = (nome: string) =>
  [...app().querySelectorAll<HTMLElement>('button, a')].find((b) => testo(b) === nome);
const riquadro = () => app().querySelector<HTMLElement>('[data-errore-modulo]')!;

const scriviEInvia = async (codice: string) => {
  const input = app().querySelector<HTMLInputElement>('input[name="codice"]')!;
  input.value = codice;
  app().querySelector('form')!.requestSubmit();
};

const apriAttivazione = async () => {
  iniziaAttivazione.mockResolvedValue({ id: ID_FATTORE, qr: QR_SVG, segreto: SEGRETO });
  mostraSicurezza(app());
  pulsante('Attiva la verifica in due passaggi')!.click();
  await vi.waitFor(() => expect(app().querySelector('[data-segreto]')).not.toBeNull());
};

beforeEach(() => {
  for (const f of [esci, sessioneCorrente, disattiva, iniziaAttivazione, verificaCodice]) {
    f.mockReset();
  }
  tornaAlProfilo.mockReset();
  mostraPagina.mockReset();
  sessioneCorrente.mockReturnValue(sessione(false));
  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('/profilo/sicurezza senza verifica in due passaggi', () => {
  it('mostra il testo introduttivo e il pulsante di attivazione', () => {
    mostraSicurezza(app());
    expect(app().textContent).toContain(
      'Oltre alla password ti chiediamo un codice di 6 cifre generato da un',
    );
    expect(pulsante('Attiva la verifica in due passaggi')).toBeDefined();
    expect(iniziaAttivazione).not.toHaveBeenCalled();
  });

  it('il clic chiama iniziaAttivazione e mostra i tre passi, il QR e il segreto', async () => {
    await apriAttivazione();
    expect(iniziaAttivazione).toHaveBeenCalledTimes(1);
    expect(app().querySelectorAll('ol li')).toHaveLength(3);
    expect(app().querySelector<HTMLImageElement>('[data-qr]')!.getAttribute('src')).toBe(QR_SVG);
    expect(testo(app().querySelector('[data-segreto]'))).toBe(SEGRETO);
    expect(pulsante('Attiva')).toBeDefined();
  });

  it('un qr con schema javascript: non finisce nel src', async () => {
    iniziaAttivazione.mockResolvedValue({
      id: ID_FATTORE,
      qr: 'javascript:alert(1)',
      segreto: SEGRETO,
    });
    mostraSicurezza(app());
    pulsante('Attiva la verifica in due passaggi')!.click();
    await vi.waitFor(() => expect(app().querySelector('[data-segreto]')).not.toBeNull());
    expect(app().querySelector('[data-qr]')!.hasAttribute('src')).toBe(false);
    expect(app().querySelector('img[src^="javascript:"]')).toBeNull();
  });

  it('un qr https:// non finisce nel src', async () => {
    iniziaAttivazione.mockResolvedValue({
      id: ID_FATTORE,
      qr: 'https://esempio.test/qr.png',
      segreto: SEGRETO,
    });
    mostraSicurezza(app());
    pulsante('Attiva la verifica in due passaggi')!.click();
    await vi.waitFor(() => expect(app().querySelector('[data-segreto]')).not.toBeNull());
    expect(app().querySelector('[data-qr]')!.hasAttribute('src')).toBe(false);
    expect(app().querySelector('img[src^="https:"]')).toBeNull();
  });

  it('se iniziaAttivazione fallisce torna alla pagina iniziale con il messaggio di messaggioErrore', async () => {
    iniziaAttivazione.mockRejectedValue(new Error('boom'));
    mostraSicurezza(app());
    pulsante('Attiva la verifica in due passaggi')!.click();
    await vi.waitFor(() =>
      expect(testo(app().querySelector('[data-errore]'))).toBe(
        'Qualcosa è andato storto. Riprova tra poco.',
      ),
    );
    expect(pulsante('Attiva la verifica in due passaggi')).toBeDefined();
    expect(app().querySelector('[data-segreto]')).toBeNull();
  });

  it('inviando il codice chiama verificaCodice(codice, id) e torna al profilo con il messaggio', async () => {
    verificaCodice.mockResolvedValue(undefined);
    await apriAttivazione();
    await scriviEInvia('123456');
    await vi.waitFor(() => expect(tornaAlProfilo).toHaveBeenCalledTimes(1));
    expect(verificaCodice).toHaveBeenCalledWith('123456', ID_FATTORE);
    expect(tornaAlProfilo).toHaveBeenCalledWith(MSG_ATTIVATA);
  });

  it('un codice errato (mfa_verification_failed) mostra il messaggio tradotto e non torna al profilo', async () => {
    verificaCodice.mockRejectedValue(erroreCodice());
    await apriAttivazione();
    await scriviEInvia('123456');
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    expect(testo(riquadro())).toBe(MSG_CODICE_ERRATO);
    expect(tornaAlProfilo).not.toHaveBeenCalled();
  });

  it('un codice che non ha 6 cifre non chiama verificaCodice', async () => {
    await apriAttivazione();
    await scriviEInvia('12');
    await vi.waitFor(() =>
      expect(app().querySelector('input[name="codice"]')!.getAttribute('aria-invalid')).toBe(
        'true',
      ),
    );
    expect(verificaCodice).not.toHaveBeenCalled();
  });
});

describe('/profilo/sicurezza con verifica in due passaggi attiva', () => {
  beforeEach(() => {
    sessioneCorrente.mockReturnValue(sessione(true));
  });

  it('dice che è attiva e mostra il modulo «Disattiva», senza il pulsante di attivazione', () => {
    mostraSicurezza(app());
    expect(testo(app().querySelector('[role="status"]'))).toBe(
      'La verifica in due passaggi è attiva.',
    );
    expect(pulsante('Disattiva')).toBeDefined();
    expect(pulsante('Attiva la verifica in due passaggi')).toBeUndefined();
  });

  it('inviando il codice chiama disattiva(codice) e torna al profilo', async () => {
    disattiva.mockResolvedValue(undefined);
    mostraSicurezza(app());
    await scriviEInvia('654321');
    await vi.waitFor(() => expect(tornaAlProfilo).toHaveBeenCalledTimes(1));
    expect(disattiva).toHaveBeenCalledWith('654321');
    expect(tornaAlProfilo).toHaveBeenCalledWith('Verifica in due passaggi disattivata.');
  });

  it('un codice errato nella disattivazione mostra il messaggio tradotto', async () => {
    disattiva.mockRejectedValue(erroreCodice());
    mostraSicurezza(app());
    await scriviEInvia('654321');
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    expect(testo(riquadro())).toBe(MSG_CODICE_ERRATO);
    expect(tornaAlProfilo).not.toHaveBeenCalled();
  });
});

describe('richiesta del codice dopo la password', () => {
  it('«Continua» chiama verificaCodice con il codice scritto', async () => {
    verificaCodice.mockResolvedValue(undefined);
    mostraCodiceAccesso(app());
    expect(app().querySelector('h1')?.textContent).toBe('Verifica in due passaggi');
    await scriviEInvia('111 222');
    await vi.waitFor(() => expect(verificaCodice).toHaveBeenCalledTimes(1));
    expect(verificaCodice).toHaveBeenCalledWith('111222');
  });

  it('un codice errato mostra il messaggio tradotto', async () => {
    verificaCodice.mockRejectedValue(erroreCodice());
    mostraCodiceAccesso(app());
    await scriviEInvia('111222');
    await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
    expect(testo(riquadro())).toBe(MSG_CODICE_ERRATO);
  });

  it('«Esci» chiama esci e non verificaCodice', () => {
    mostraCodiceAccesso(app());
    pulsante('Esci')!.click();
    expect(esci).toHaveBeenCalledTimes(1);
    expect(verificaCodice).not.toHaveBeenCalled();
  });
});

describe('pagine di amministrazione senza 2FA', () => {
  it('il link porta a /profilo/sicurezza', () => {
    mostraAdminSenza2fa(app());
    const link = pulsante('Attiva la verifica in due passaggi')!;
    expect(link.getAttribute('href')).toBe('/profilo/sicurezza');
  });
});
