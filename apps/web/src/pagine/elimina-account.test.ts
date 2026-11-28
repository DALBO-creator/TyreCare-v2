// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_auth from '../lib/auth';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';

const { esci, sessioneCorrente, rpc, signOut, vaiA, impostaConferma } = vi.hoisted(() => ({
  esci: vi.fn(),
  sessioneCorrente: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  vaiA: vi.fn(),
  impostaConferma: vi.fn(),
}));

// Si fingono solo uscita e sessione: messaggioErrore resta vera
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof M_auth>()),
  esci,
  sessioneCorrente,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  vaiA,
}));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  impostaConferma,
}));
// lib/profilo resta vero: l'errore tradotto nasce da `rpc('elimina_account')`
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ rpc, auth: { signOut } }),
  chiaveSessione: () => 'chiave',
}));

import { mostraEliminaAccount } from './elimina-account';

const TITOLO = 'Eliminare il tuo account?';
const TESTO =
  "Account, profilo, notifiche, commenti, richieste di aiuto su strada e prenotazioni passate verranno eliminati. L'operazione non si può annullare.";
const MESSAGGIO_TITOLARE =
  "Sei il titolare di un'officina: scrivici con «Invia un commento» per chiudere l'officina e l'account.";

const apri = () => document.querySelector<HTMLButtonElement>('[data-elimina]')!;
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog');
const conferma = () => dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;
const annulla = () => dialogo()!.querySelector<HTMLButtonElement>('[data-annulla]')!;
const erroreDialogo = () => dialogo()!.querySelector<HTMLElement>('[role="alert"]')!;
const attendi = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  for (const f of [esci, sessioneCorrente, rpc, signOut, vaiA, impostaConferma]) f.mockReset();
  esci.mockResolvedValue(undefined);
  sessioneCorrente.mockReturnValue(null);
  signOut.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
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
  document.body.innerHTML = '<div id="app"></div>';
  mostraEliminaAccount(document.getElementById('app')!);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('elimina account', () => {
  it('il pulsante apre la conferma con titolo e testo del codice, senza eliminare', () => {
    expect(document.querySelector('h1')?.textContent).toBe('Elimina il tuo account');
    expect(dialogo()).toBeNull();
    apri().click();
    expect(dialogo()!.querySelector('h2')?.textContent).toBe(TITOLO);
    expect(dialogo()!.querySelector('p')?.textContent).toBe(TESTO);
    expect(conferma().textContent?.replace(/\s+/g, ' ').trim()).toBe('Sì, elimina');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('annullando nel dialogo non elimina nulla', () => {
    apri().click();
    annulla().click();
    expect(dialogo()).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(esci).not.toHaveBeenCalled();
  });

  it('solo la conferma chiama elimina_account, poi imposta il messaggio e poi esce', async () => {
    apri().click();
    expect(rpc).not.toHaveBeenCalled();
    conferma().click();
    await attendi();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('elimina_account');
    expect(impostaConferma).toHaveBeenCalledWith('Il tuo account è stato eliminato.');
    expect(esci).toHaveBeenCalledTimes(1);
    expect(impostaConferma.mock.invocationCallOrder[0]).toBeLessThan(
      esci.mock.invocationCallOrder[0]!,
    );
    // sessione chiusa: il ritorno all'accesso spetta a main.ts
    expect(vaiA).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('se dopo esci la sessione c’è ancora, pulisce in locale e va a /accedi', async () => {
    sessioneCorrente.mockReturnValue({ user: { id: 'u-1' } });
    apri().click();
    conferma().click();
    await attendi();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(vaiA).toHaveBeenCalledWith('/accedi', { sostituisci: true });
  });

  it('errore noto (titolare di officina): messaggio tradotto nel dialogo, che resta aperto', async () => {
    rpc.mockResolvedValue({ error: { message: 'TITOLARE_DI_OFFICINA' } });
    apri().click();
    conferma().click();
    await attendi();
    expect(erroreDialogo().hidden).toBe(false);
    expect(erroreDialogo().textContent).toBe(MESSAGGIO_TITOLARE);
    expect(dialogo()!.open).toBe(true);
    expect(conferma().disabled).toBe(false);
    expect(esci).not.toHaveBeenCalled();
    expect(impostaConferma).not.toHaveBeenCalled();
    expect(vaiA).not.toHaveBeenCalled();
  });
});
