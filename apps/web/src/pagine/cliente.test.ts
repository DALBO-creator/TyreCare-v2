// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_officina from '../lib/officina';
import type * as M_profilo from '../lib/profilo';
import type * as M_inviti from '../lib/inviti';
import type * as M_router from '../lib/router';
import { ErroreModulo } from '../lib/errori';

const { caricaCliente, caricaVeicoli, scollegaCliente, caricaDatiUtente, caricaInvitoInCorso } =
  vi.hoisted(() => ({
    caricaCliente: vi.fn(),
    caricaVeicoli: vi.fn(),
    scollegaCliente: vi.fn(),
    caricaDatiUtente: vi.fn(),
    caricaInvitoInCorso: vi.fn(),
  }));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// Si fingono solo le letture e la scrittura: le funzioni pure (eTitolare, nominativo) restano vere
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaCliente,
  caricaVeicoli,
  scollegaCliente,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/inviti', async (importOriginal) => ({
  ...(await importOriginal<typeof M_inviti>()),
  caricaInvitoInCorso,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraCliente } from './cliente';

const ID_CLIENTE = '11111111-1111-4111-8111-111111111111';
const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const TESTO_PULSANTE = "Scollega l'account";
const MESSAGGIO_42501 = 'Solo il titolare può scollegare un cliente.';

const cliente = (profileId: string | null) => ({
  id: ID_CLIENTE,
  officina_id: ID_OFFICINA,
  profile_id: profileId,
  nome: 'Mario',
  cognome: 'Rossi',
  ragione_sociale: null,
  telefono: null,
  email: null,
  note: null,
  veicoli: [{ count: 0 }],
});

const utente = (ruolo: 'TITOLARE' | 'OPERATORE') => ({
  email: 'o@example.com',
  profilo: {},
  officine: [
    {
      ruolo,
      officina: {
        id: ID_OFFICINA,
        ragione_sociale: 'Gomme Rossi',
        citta: 'Milano',
        stato_affiliazione: 'ATTIVA',
      },
    },
  ],
});

const monta = async (ruolo: 'TITOLARE' | 'OPERATORE', profileId: string | null) => {
  caricaCliente.mockResolvedValue(cliente(profileId));
  caricaDatiUtente.mockResolvedValue(utente(ruolo));
  history.replaceState(null, '', `/cliente?id=${ID_CLIENTE}`);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraCliente(document.getElementById('app')!);
  // Pagina già disegnata (dritta T145): il titolo del cliente c'è prima di controllare le assenze
  expect(document.querySelector('h1')?.textContent).toBe('Rossi Mario');
};

const pulsante = () => document.querySelector<HTMLButtonElement>('[data-scollega-cliente]');
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog');
const conferma = () => dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;
const focoSuApp = () => document.activeElement === document.getElementById('tc-app');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  for (const f of [caricaCliente, caricaVeicoli, scollegaCliente, caricaDatiUtente, mostraPagina]) {
    f.mockReset();
  }
  caricaInvitoInCorso.mockReset().mockResolvedValue(null);
  caricaVeicoli.mockResolvedValue([]);
  scollegaCliente.mockResolvedValue(undefined);
  mostraPagina.mockResolvedValue(undefined);
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
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('scheda cliente: «Scollega l’account»', () => {
  it('il titolare di un cliente con account vede il pulsante', async () => {
    await monta('TITOLARE', 'p-1');
    expect(pulsante()?.textContent?.replace(/\s+/g, ' ').trim()).toBe(TESTO_PULSANTE);
  });

  it('l’operatore non lo vede', async () => {
    await monta('OPERATORE', 'p-1');
    expect(pulsante()).toBeNull();
  });

  it('un cliente senza account non lo ha, neanche per il titolare', async () => {
    await monta('TITOLARE', null);
    expect(pulsante()).toBeNull();
  });

  it('confermando chiama scollegaCliente una volta con l’id, ridisegna e dà il focus con setTimeout', async () => {
    await monta('TITOLARE', 'p-1');
    pulsante()!.click();
    expect(dialogo()).not.toBeNull();
    conferma().click();
    // Solo microtask: vi.waitFor farebbe avanzare i timer finti e darebbe il focus in anticipo
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(mostraPagina).toHaveBeenCalledTimes(1);
    expect(scollegaCliente).toHaveBeenCalledTimes(1);
    expect(scollegaCliente).toHaveBeenCalledWith(ID_CLIENTE);
    // Il focus non è dato subito: solo dopo il timer, a dialogo chiuso
    expect(focoSuApp()).toBe(false);
    await vi.runAllTimersAsync();
    expect(focoSuApp()).toBe(true);
  });

  it('con 42501 il messaggio di lib/officina resta nel dialogo aperto e non si ripete nella pagina', async () => {
    scollegaCliente.mockRejectedValue(new ErroreModulo(MESSAGGIO_42501));
    await monta('TITOLARE', 'p-1');
    pulsante()!.click();
    conferma().click();
    const avviso = () => dialogo()!.querySelector<HTMLElement>('[role="alert"]')!;
    await vi.waitFor(() => expect(avviso().hidden).toBe(false));
    expect(avviso().textContent).toBe(MESSAGGIO_42501);
    expect(dialogo()!.open).toBe(true);
    // Fuori dal dialogo il testo non compare
    dialogo()!.remove();
    expect(document.body.textContent).not.toContain(MESSAGGIO_42501);
    expect(mostraPagina).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(focoSuApp()).toBe(false);
  });
});
