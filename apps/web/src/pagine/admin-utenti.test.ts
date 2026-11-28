// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_admin_pannello from '../lib/admin-pannello';
import type * as M_router from '../lib/router';
import type { UtenteAdmin } from '../lib/admin-pannello';
import { formattaDataOra } from '../lib/admin';
import { traduciErrorePannello } from '../lib/admin-pannello';

const {
  bloccaUtente,
  cambiaRuolo,
  cercaUtenti,
  confermaEmail,
  correggiProfilo,
  disconnettiUtente,
  inviaReimpostaPassword,
  mostraPagina,
} = vi.hoisted(() => ({
  bloccaUtente: vi.fn(),
  cambiaRuolo: vi.fn(),
  cercaUtenti: vi.fn(),
  confermaEmail: vi.fn(),
  correggiProfilo: vi.fn(),
  disconnettiUtente: vi.fn(),
  inviaReimpostaPassword: vi.fn(),
  mostraPagina: vi.fn(),
}));

// Si fingono solo le funzioni che leggono o scrivono sul database
vi.mock('../lib/admin-pannello', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin_pannello>()),
  bloccaUtente,
  cambiaRuolo,
  cercaUtenti,
  confermaEmail,
  correggiProfilo,
  disconnettiUtente,
  inviaReimpostaPassword,
}));
vi.mock('./admin-comune', () => ({ accessoAdmin: vi.fn().mockResolvedValue(true) }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraAdminUtenti, segnaliUtente } from './admin-utenti';
import { ETICHETTE_RUOLO } from './comune';

const utente = (extra: Partial<UtenteAdmin> = {}): UtenteAdmin => ({
  id: 'u-1',
  email: 'mario@esempio.it',
  nome: 'Mario',
  cognome: 'Rossi',
  telefono: null,
  ruolo: 'CLIENTE',
  created_at: '2026-11-01T10:00:00Z',
  ultimo_accesso: null,
  email_confermata: true,
  bloccato: false,
  con_2fa: false,
  officine: '',
  ...extra,
});

const MARIO = utente();
const LUCIA = utente({
  id: 'u-2',
  email: 'lucia@esempio.it',
  nome: 'Lucia',
  cognome: 'Bianchi',
  email_confermata: false,
});
const ADMIN = utente({ id: 'u-3', email: 'davide@esempio.it', nome: 'Davide', ruolo: 'ADMIN' });

const monta = async (utenti: UtenteAdmin[], indirizzo = '/admin/utenti') => {
  cercaUtenti.mockResolvedValue(utenti);
  history.replaceState(null, '', indirizzo);
  document.body.innerHTML = '<main id="tc-app"></main>';
  await mostraAdminUtenti(document.getElementById('tc-app')!);
};

const riga = (id: string) => document.querySelector<HTMLElement>(`[data-utente="${id}"]`)!;
const righe = () =>
  [...document.querySelectorAll<HTMLElement>('[data-utente]')].map((r) => r.dataset.utente);
const azione = (id: string, nome: string) =>
  riga(id).querySelector<HTMLButtonElement>(`[data-azione="${nome}"]`);
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog.tc-dialogo');
const erroreDialogo = () => dialogo()!.querySelector<HTMLElement>('[role="alert"]')!;
const conferma = () => dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;
const annulla = () => dialogo()!.querySelector<HTMLButtonElement>('[data-annulla]')!;

beforeEach(() => {
  for (const f of [
    bloccaUtente,
    cambiaRuolo,
    cercaUtenti,
    confermaEmail,
    correggiProfilo,
    disconnettiUtente,
    inviaReimpostaPassword,
    mostraPagina,
  ]) {
    f.mockReset();
  }
  bloccaUtente.mockResolvedValue(undefined);
  disconnettiUtente.mockResolvedValue(undefined);
  history.replaceState(null, '', '/admin/utenti');
  // happy-dom: showModal/close minimi se mancano
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('segnaliUtente', () => {
  it('un account semplice ha solo il ruolo', () => {
    expect(segnaliUtente(MARIO)).toEqual([{ testo: ETICHETTE_RUOLO.CLIENTE, classe: 'nessuno' }]);
  });

  it('bloccato, email da confermare e 2FA: ruolo per primo, poi nell’ordine del codice', () => {
    const u = utente({ ruolo: 'OFFICINA', bloccato: true, email_confermata: false, con_2fa: true });
    expect(segnaliUtente(u)).toEqual([
      { testo: 'Officina', classe: 'nessuno' },
      { testo: 'Bloccato', classe: 'rosso' },
      { testo: 'Email da confermare', classe: 'giallo' },
      { testo: '2FA', classe: 'verde' },
    ]);
  });

  it('l’email non confermata dà solo il segnale giallo', () => {
    expect(segnaliUtente(LUCIA).map((s) => s.testo)).toEqual(['Cliente', 'Email da confermare']);
  });
});

describe('Account: elenco e ricerca', () => {
  it('una riga per utente con nome, email e segnali', async () => {
    await monta([MARIO, LUCIA]);
    expect(righe()).toEqual(['u-1', 'u-2']);
    expect(riga('u-1').querySelector('strong')?.textContent).toBe('Mario Rossi');
    expect(riga('u-1').textContent).toContain('mario@esempio.it');
    expect(riga('u-1').textContent).toContain(`Iscritto il ${formattaDataOra(MARIO.created_at)}`);
    expect(riga('u-2').textContent).toContain('Email da confermare');
    expect(riga('u-1').textContent).not.toContain('Email da confermare');
    expect(document.querySelector('[data-conteggio]')?.textContent).toBe('2 account trovati');
    expect(cercaUtenti).toHaveBeenCalledWith('');
  });

  it('senza nome né cognome mostra «Senza nome»', async () => {
    await monta([utente({ nome: '', cognome: '' })]);
    expect(riga('u-1').querySelector('strong')?.textContent).toBe('Senza nome');
  });

  it('?filtro=non-confermati mostra solo gli account con l’email da confermare', async () => {
    await monta([MARIO, LUCIA], '/admin/utenti?filtro=non-confermati');
    expect(righe()).toEqual(['u-2']);
    expect(document.body.textContent).toContain('Solo gli account con l’email da confermare.');
    expect(document.querySelector('[data-conteggio]')?.textContent).toBe('1 account trovati');
  });

  it('senza filtro il testo del filtro non compare', async () => {
    await monta([MARIO, LUCIA]);
    expect(document.body.textContent).not.toContain('Solo gli account con l’email da confermare.');
  });

  it('nessun utente: stato vuoto normale', async () => {
    await monta([]);
    expect(righe()).toEqual([]);
    expect(document.querySelector('.tc-vuoto__titolo')?.textContent).toBe('Nessun account trovato');
    expect(document.querySelector('[data-conteggio]')?.textContent).toBe('0 account trovati');
  });

  it('solo filtro e nessun non confermato: stato vuoto normale', async () => {
    await monta([MARIO], '/admin/utenti?filtro=non-confermati');
    expect(document.querySelector('.tc-vuoto__titolo')?.textContent).toBe('Nessun account trovato');
  });

  it('ricerca vuota: cerca di nuovo senza testo e toglie ?q= dall’indirizzo', async () => {
    await monta([MARIO], '/admin/utenti?q=mario');
    expect(cercaUtenti).toHaveBeenLastCalledWith('mario');
    document.querySelector<HTMLInputElement>('#tc-cerca')!.value = '';
    document
      .querySelector<HTMLFormElement>('[data-cerca]')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(cercaUtenti).toHaveBeenLastCalledWith(''));
    expect(location.pathname + location.search).toBe('/admin/utenti');
  });

  it('ricerca con testo: indirizzo con ?q= codificato', async () => {
    await monta([MARIO]);
    document.querySelector<HTMLInputElement>('#tc-cerca')!.value = 'a&b c';
    document
      .querySelector<HTMLFormElement>('[data-cerca]')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(cercaUtenti).toHaveBeenLastCalledWith('a&b c'));
    expect(location.pathname + location.search).toBe('/admin/utenti?q=a%26b%20c');
  });
});

describe('Account: blocca, sblocca, sessioni', () => {
  it('«Blocca» chiede conferma e solo la conferma blocca l’account', async () => {
    await monta([MARIO]);
    azione('u-1', 'blocca')!.click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Bloccare l’account?');
    expect(bloccaUtente).not.toHaveBeenCalled();

    cercaUtenti.mockResolvedValue([utente({ bloccato: true })]);
    conferma().click();
    await vi.waitFor(() =>
      expect(riga('u-1').querySelector<HTMLElement>('[data-ok-utente]')?.textContent).toBe(
        'Account bloccato.',
      ),
    );
    expect(bloccaUtente).toHaveBeenCalledTimes(1);
    expect(bloccaUtente).toHaveBeenCalledWith('u-1', true);
    expect(cercaUtenti).toHaveBeenCalledTimes(2);
    expect(riga('u-1').querySelector<HTMLElement>('[data-ok-utente]')?.hidden).toBe(false);
    expect(dialogo()).toBeNull();
  });

  it('annullando il dialogo non blocca nulla', async () => {
    await monta([MARIO]);
    azione('u-1', 'blocca')!.click();
    annulla().click();
    expect(dialogo()).toBeNull();
    expect(bloccaUtente).not.toHaveBeenCalled();
  });

  it('se il blocco fallisce, l’errore resta nel dialogo che resta aperto', async () => {
    // L'errore tradotto nasce dal codice d'origine (42501 del database), non dal testo scritto qui
    let atteso = '';
    bloccaUtente.mockImplementation(async () => {
      try {
        traduciErrorePannello({ code: '42501' });
      } catch (errore) {
        atteso = (errore as Error).message;
        throw errore;
      }
    });
    await monta([MARIO]);
    azione('u-1', 'blocca')!.click();
    conferma().click();
    await vi.waitFor(() => expect(erroreDialogo().hidden).toBe(false));
    expect(atteso).toContain('verifica in due passaggi');
    expect(erroreDialogo().textContent).toBe(atteso);
    expect(dialogo()?.open).toBe(true);
    expect(conferma().disabled).toBe(false);
    expect(cercaUtenti).toHaveBeenCalledTimes(1);
  });

  it('un amministratore non si blocca né si cambia di ruolo', async () => {
    await monta([ADMIN]);
    expect(azione('u-3', 'blocca')).toBeNull();
    expect(azione('u-3', 'sblocca')).toBeNull();
    expect(riga('u-3').querySelector('select[name="ruolo"]')).toBeNull();
    expect(azione('u-3', 'disconnetti')).not.toBeNull();
  });

  it('un utente non amministratore ha «Blocca» e il menu del ruolo', async () => {
    await monta([MARIO]);
    expect(azione('u-1', 'blocca')).not.toBeNull();
    expect(azione('u-1', 'sblocca')).toBeNull();
    expect(riga('u-1').querySelector('select[name="ruolo"]')).not.toBeNull();
  });

  it('«Sblocca» agisce subito, senza dialogo', async () => {
    await monta([utente({ bloccato: true })]);
    expect(azione('u-1', 'blocca')).toBeNull();
    cercaUtenti.mockResolvedValue([MARIO]);
    azione('u-1', 'sblocca')!.click();
    expect(dialogo()).toBeNull();
    await vi.waitFor(() =>
      expect(riga('u-1').querySelector<HTMLElement>('[data-ok-utente]')?.textContent).toBe(
        'Account sbloccato.',
      ),
    );
    expect(bloccaUtente).toHaveBeenCalledTimes(1);
    expect(bloccaUtente).toHaveBeenCalledWith('u-1', false);
  });

  it('«Chiudi le sessioni» chiede conferma e chiama la funzione solo dopo', async () => {
    await monta([MARIO]);
    azione('u-1', 'disconnetti')!.click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Chiudere le sessioni?');
    expect(disconnettiUtente).not.toHaveBeenCalled();
    conferma().click();
    await vi.waitFor(() =>
      expect(riga('u-1').querySelector<HTMLElement>('[data-ok-utente]')?.textContent).toBe(
        'Sessioni chiuse.',
      ),
    );
    expect(disconnettiUtente).toHaveBeenCalledTimes(1);
    expect(disconnettiUtente).toHaveBeenCalledWith('u-1');
  });
});
