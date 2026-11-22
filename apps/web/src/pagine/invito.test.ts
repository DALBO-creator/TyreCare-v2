// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InfoInvito } from '../lib/inviti';
import { ErroreModulo } from '../lib/errori';
import type * as routerReale from '../lib/router';

const MESSAGGIO = 'Messaggio di messaggioErrore';
const { leggiInvito, accettaInvito, sessioneCorrente, esci, mostraPagina } = vi.hoisted(() => ({
  leggiInvito: vi.fn(),
  accettaInvito: vi.fn(),
  sessioneCorrente: vi.fn(),
  esci: vi.fn(),
  mostraPagina: vi.fn(),
}));
vi.mock('../lib/inviti', () => ({ leggiInvito, accettaInvito }));
vi.mock('../lib/auth', () => ({
  sessioneCorrente,
  esci,
  messaggioErrore: () => MESSAGGIO,
}));
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({}),
  chiaveSessione: () => 'chiave',
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof routerReale>()),
  mostraPagina,
}));

import { mostraInvito } from './invito';

const CODICE = '0123456789abcdef0123456789abcdef';
const info = (extra: Partial<InfoInvito> = {}): InfoInvito => ({
  officina: 'Gomme Rossi',
  email: 'mario@esempio.it',
  stato: 'VALIDO',
  scade_il: '2026-12-31T10:00:00Z',
  usato_da_te: false,
  ...extra,
});
const sessione = (email: string) => ({ user: { email } });

const app = () => document.getElementById('app')!;
const apri = () => mostraInvito(app());
const testo = () => app().textContent!.replace(/\s+/g, ' ');
const link = (nome: string) =>
  [...app().querySelectorAll('a')].find((a) => a.textContent!.trim() === nome)!;
const pulsante = (selettore: string) => app().querySelector<HTMLButtonElement>(selettore)!;

beforeEach(() => {
  vi.resetAllMocks();
  sessioneCorrente.mockReturnValue(null);
  history.replaceState(null, '', `/invito?codice=${CODICE}`);
  document.body.innerHTML = '<div id="app"></div>';
});

describe('pagina dell’invito', () => {
  it('da ospite propone "Crea account" e "Ho già un account" con il ritorno all’invito', async () => {
    leggiInvito.mockResolvedValue(info());
    await apri();
    expect(leggiInvito).toHaveBeenCalledWith(CODICE);
    expect(app().querySelector('h1,h2')?.textContent).toContain(
      'Gomme Rossi ti invita su TyreCare',
    );
    expect(testo()).toContain('mario@esempio.it');
    const ritorno = `email=mario%40esempio.it&dopo=%2Finvito%3Fcodice%3D${CODICE}`;
    expect(link('Crea account').getAttribute('href')).toBe(`/registrati?${ritorno}`);
    expect(link('Ho già un account').getAttribute('href')).toBe(`/accedi?${ritorno}`);
    expect(app().querySelector('[data-accetta]')).toBeNull();
  });

  it('con un account di un’altra email mostra l’avviso e il pulsante di uscita', async () => {
    leggiInvito.mockResolvedValue(info());
    sessioneCorrente.mockReturnValue(sessione('Altro@Esempio.it'));
    await apri();
    expect(testo()).toContain(
      "L'invito è per mario@esempio.it, ma sei entrato con altro@esempio.it.",
    );
    expect(pulsante('[data-esci]').textContent!.trim()).toBe('Esci e cambia account');
    expect(app().querySelector('[data-accetta]')).toBeNull();

    esci.mockResolvedValue(undefined);
    pulsante('[data-esci]').click();
    await vi.waitFor(() => expect(mostraPagina).toHaveBeenCalledTimes(1));
    expect(esci).toHaveBeenCalledTimes(1);
  });

  it('se l’uscita fallisce mostra l’errore e riabilita il pulsante', async () => {
    leggiInvito.mockResolvedValue(info());
    sessioneCorrente.mockReturnValue(sessione('altro@esempio.it'));
    esci.mockRejectedValue(new Error('Uscita non riuscita'));
    await apri();
    pulsante('[data-esci]').click();
    await vi.waitFor(() =>
      expect(app().querySelector<HTMLElement>('[data-errore]')!.hidden).toBe(false),
    );
    expect(app().querySelector('[data-errore]')!.textContent!.trim()).toBe(MESSAGGIO);
    expect(pulsante('[data-esci]').disabled).toBe(false);
    expect(mostraPagina).not.toHaveBeenCalled();
  });

  it('con l’account giusto il pulsante accetta l’invito una volta col codice', async () => {
    leggiInvito.mockResolvedValue(info());
    sessioneCorrente.mockReturnValue(sessione('Mario@Esempio.it'));
    accettaInvito.mockReturnValue(new Promise(() => {}));
    await apri();
    expect(pulsante('[data-accetta]').textContent!.trim()).toBe('Collega i miei veicoli');
    expect(accettaInvito).not.toHaveBeenCalled();
    pulsante('[data-accetta]').click();
    await vi.waitFor(() => expect(accettaInvito).toHaveBeenCalledTimes(1));
    expect(accettaInvito).toHaveBeenCalledWith(CODICE);
  });

  it('se l’accettazione fallisce mostra l’errore e riabilita il pulsante', async () => {
    leggiInvito.mockResolvedValue(info());
    sessioneCorrente.mockReturnValue(sessione('mario@esempio.it'));
    accettaInvito.mockRejectedValue(new Error('Accettazione non riuscita'));
    await apri();
    pulsante('[data-accetta]').click();
    await vi.waitFor(() =>
      expect(app().querySelector<HTMLElement>('[data-errore]')!.hidden).toBe(false),
    );
    expect(app().querySelector('[data-errore]')!.textContent!.trim()).toBe(MESSAGGIO);
    expect(pulsante('[data-accetta]').disabled).toBe(false);
  });

  it('se l’accettazione rifiuta con un ErroreModulo mostra il suo testo, non quello di messaggioErrore', async () => {
    leggiInvito.mockResolvedValue(info());
    sessioneCorrente.mockReturnValue(sessione('mario@esempio.it'));
    accettaInvito.mockRejectedValue(new ErroreModulo('Testo del modulo'));
    await apri();
    pulsante('[data-accetta]').click();
    await vi.waitFor(() =>
      expect(app().querySelector<HTMLElement>('[data-errore]')!.hidden).toBe(false),
    );
    const box = app().querySelector('[data-errore]')!.textContent!.trim();
    expect(box).toBe('Testo del modulo');
    expect(box).not.toContain(MESSAGGIO);
    expect(pulsante('[data-accetta]').disabled).toBe(false);
  });

  it.each([
    ['scaduto', info({ stato: 'SCADUTO' }), 'Invito scaduto', "L'invito di Gomme Rossi è scaduto."],
    [
      'annullato',
      info({ stato: 'ANNULLATO' }),
      'Invito annullato',
      'Gomme Rossi ha annullato questo invito.',
    ],
    [
      'usato da un altro account',
      info({ stato: 'USATO' }),
      'Invito già usato',
      'Questo invito è già stato usato da un altro account.',
    ],
    [
      'usato dallo stesso account',
      info({ stato: 'USATO', usato_da_te: true }),
      'Veicoli già collegati',
      'I veicoli registrati da Gomme Rossi sono già nel tuo garage.',
    ],
    ['inesistente', null, 'Invito non valido', 'Controlla di aver aperto il link completo.'],
  ])('invito %s: mostra il messaggio e nessuna azione', async (_nome, risposta, titolo, frase) => {
    leggiInvito.mockResolvedValue(risposta);
    sessioneCorrente.mockReturnValue(sessione('mario@esempio.it'));
    await apri();
    expect(app().querySelector('h1,h2')?.textContent).toContain(titolo);
    expect(testo()).toContain(frase);
    expect(app().querySelector('[data-accetta]')).toBeNull();
    expect(app().querySelector('[data-esci]')).toBeNull();
    expect(accettaInvito).not.toHaveBeenCalled();
  });

  it('con un codice malformato non interroga il servizio e dice "Invito non valido"', async () => {
    history.replaceState(null, '', '/invito?codice=abc');
    await apri();
    expect(leggiInvito).not.toHaveBeenCalled();
    expect(testo()).toContain('Invito non valido');
  });

  it('se leggiInvito fallisce (rete) mostra l’errore di caricamento con "Riprova"', async () => {
    leggiInvito.mockRejectedValue(new Error('Failed to fetch'));
    await apri();
    expect(testo()).toContain(
      'Non riusciamo a caricare i tuoi dati. Controlla la connessione e riprova.',
    );
    expect(link('Riprova').getAttribute('href')).toBe(`/invito?codice=${CODICE}`);
    expect(app().querySelector('[data-accetta]')).toBeNull();
  });
});
