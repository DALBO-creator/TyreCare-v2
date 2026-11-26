// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_officina from '../lib/officina';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';
import { ErroreModulo } from '../lib/errori';

const { caricaCliente, caricaElencoClienti, unisciClienti, caricaDatiUtente } = vi.hoisted(() => ({
  caricaCliente: vi.fn(),
  caricaElencoClienti: vi.fn(),
  unisciClienti: vi.fn(),
  caricaDatiUtente: vi.fn(),
}));
const { vaiConConferma, gestisciErroreCaricamento } = vi.hoisted(() => ({
  vaiConConferma: vi.fn(),
  gestisciErroreCaricamento: vi.fn(),
}));

// Si fingono solo letture e scrittura: le funzioni pure (eTitolare, nominativo) restano vere
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaCliente,
  caricaElencoClienti,
  unisciClienti,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina: vi.fn(),
}));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  vaiConConferma,
  gestisciErroreCaricamento,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraUnisciCliente } from './unisci-cliente';

const ID_CLIENTE = '11111111-1111-4111-8111-111111111111';
const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const ID_ALTRA_OFFICINA = '33333333-3333-4333-8333-333333333333';
const ID_VERDI = '44444444-4444-4444-8444-444444444444';
const ID_BIANCHI = '55555555-5555-4555-8555-555555555555';

const cliente = {
  id: ID_CLIENTE,
  officina_id: ID_OFFICINA,
  profile_id: null,
  nome: 'Mario',
  cognome: 'Rossi',
  ragione_sociale: null,
  telefono: null,
  email: null,
  note: null,
  veicoli: [{ count: 0 }],
};

const altro = (id: string, cognome: string, nome: string, targa: string, telefono: string) => ({
  id,
  nome,
  cognome,
  ragione_sociale: null,
  telefono,
  email: null,
  profile_id: null,
  veicoli: [{ targa }],
});
const verdi = altro(ID_VERDI, 'Verdi', 'Giulia', 'AB123CD', '3331112222');
const bianchi = altro(ID_BIANCHI, 'Bianchi', 'Luca', 'EF456GH', '3334445555');

const utente = (ruolo: 'TITOLARE' | 'OPERATORE', officinaId = ID_OFFICINA) => ({
  email: 'o@example.com',
  profilo: {},
  officine: [
    {
      ruolo,
      officina: {
        id: officinaId,
        ragione_sociale: 'Gomme Rossi',
        citta: 'Milano',
        stato_affiliazione: 'ATTIVA',
      },
    },
  ],
});

const monta = async (
  ruolo: 'TITOLARE' | 'OPERATORE',
  elenco: unknown[] = [verdi, bianchi],
  url = `/cliente/unisci?id=${ID_CLIENTE}`,
) => {
  caricaCliente.mockResolvedValue(cliente);
  caricaDatiUtente.mockResolvedValue(utente(ruolo));
  caricaElencoClienti.mockResolvedValue(elenco);
  history.replaceState(null, '', url);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraUnisciCliente(document.getElementById('app')!);
};

const testo = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
const sceltiInElenco = () =>
  [...document.querySelectorAll<HTMLElement>('[data-scelto]')].map((b) => b.dataset.scelto);
const scegli = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-scelto="${id}"]`)!.click();
const cerca = (valore: string) => {
  const campo = document.querySelector<HTMLInputElement>('#tc-cerca')!;
  campo.value = valore;
  campo.dispatchEvent(new Event('input'));
};
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog');
const pulsanteUnisci = () => dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;
const paragrafo = (inizio: string) =>
  [...document.querySelectorAll('p')].find((p) => p.textContent?.trim().startsWith(inizio));

beforeEach(() => {
  for (const f of [
    caricaCliente,
    caricaElencoClienti,
    unisciClienti,
    caricaDatiUtente,
    vaiConConferma,
    gestisciErroreCaricamento,
  ]) {
    f.mockReset();
  }
  unisciClienti.mockResolvedValue(undefined);
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

describe('unisci clienti: permessi', () => {
  it('l’operatore vede il rifiuto e il ritorno al cliente, senza caricare l’elenco', async () => {
    await monta('OPERATORE');
    expect(testo(paragrafo('Solo il titolare'))).toBe(
      "Solo il titolare dell'officina può unire due clienti.",
    );
    const indietro = [...document.querySelectorAll('a')].find(
      (a) => testo(a) === 'Torna al cliente',
    );
    expect(indietro?.getAttribute('href')).toBe(`/cliente?id=${ID_CLIENTE}`);
    expect(caricaElencoClienti).not.toHaveBeenCalled();
    expect(document.querySelector('#tc-cerca')).toBeNull();
    expect(document.querySelector('[data-scelto]')).toBeNull();
  });

  it('un cliente con id non valido è «Cliente non trovato»', async () => {
    await monta('TITOLARE', [], '/cliente/unisci?id=non-un-uuid');
    expect(testo(document.querySelector('h1'))).toBe('Cliente non trovato');
    expect(caricaCliente).not.toHaveBeenCalled();
  });

  it('un cliente di un’altra officina è «Cliente non trovato»', async () => {
    caricaCliente.mockResolvedValue({ ...cliente, officina_id: ID_ALTRA_OFFICINA });
    caricaDatiUtente.mockResolvedValue(utente('TITOLARE'));
    history.replaceState(null, '', `/cliente/unisci?id=${ID_CLIENTE}`);
    document.body.innerHTML = '<div id="app"></div>';
    await mostraUnisciCliente(document.getElementById('app')!);
    expect(testo(document.querySelector('h1'))).toBe('Cliente non trovato');
    expect(caricaElencoClienti).not.toHaveBeenCalled();
  });

  it('un errore di caricamento passa a gestisciErroreCaricamento', async () => {
    const errore = new ErroreModulo('Rete assente.');
    caricaCliente.mockRejectedValue(errore);
    caricaDatiUtente.mockResolvedValue(utente('TITOLARE'));
    history.replaceState(null, '', `/cliente/unisci?id=${ID_CLIENTE}`);
    document.body.innerHTML = '<div id="app"></div>';
    await mostraUnisciCliente(document.getElementById('app')!);
    expect(gestisciErroreCaricamento).toHaveBeenCalledTimes(1);
    expect(gestisciErroreCaricamento.mock.calls[0]![2]).toBe(errore);
  });
});

describe('unisci clienti: elenco e ricerca', () => {
  it('il titolare vede la scheda che resta col nominativo in evidenza', async () => {
    await monta('TITOLARE');
    const riga = paragrafo('Resta questa scheda:');
    expect(testo(riga)).toBe('Resta questa scheda: Rossi Mario');
    expect(testo(riga!.querySelector('strong'))).toBe('Rossi Mario');
  });

  it('l’elenco ha gli altri clienti e non quello attuale', async () => {
    const attuale = altro(ID_CLIENTE, 'Rossi', 'Mario', 'ZZ999ZZ', '3330000000');
    await monta('TITOLARE', [attuale, verdi, bianchi]);
    expect(sceltiInElenco()).toEqual([ID_VERDI, ID_BIANCHI]);
    expect(testo(document.querySelector('[data-conteggio]'))).toBe('2 clienti trovati');
  });

  it('senza altri clienti mostra lo stato vuoto e nessuna ricerca', async () => {
    const attuale = altro(ID_CLIENTE, 'Rossi', 'Mario', 'ZZ999ZZ', '3330000000');
    await monta('TITOLARE', [attuale]);
    expect(testo(paragrafo('Non ci sono altri'))).toBe(
      'Non ci sono altri clienti da unire a questo.',
    );
    expect(document.querySelector('#tc-cerca')).toBeNull();
    expect(document.querySelector('[data-scelto]')).toBeNull();
  });

  it('la ricerca restringe l’elenco e aggiorna il conteggio', async () => {
    await monta('TITOLARE');
    cerca('verdi');
    expect(sceltiInElenco()).toEqual([ID_VERDI]);
    expect(testo(document.querySelector('[data-conteggio]'))).toBe('1 cliente trovato');
  });

  it('una ricerca senza risultati mostra «Nessun cliente corrisponde alla ricerca.»', async () => {
    await monta('TITOLARE');
    cerca('zzzz');
    expect(sceltiInElenco()).toEqual([]);
    expect(testo(paragrafo('Nessun cliente'))).toBe('Nessun cliente corrisponde alla ricerca.');
    expect(testo(document.querySelector('[data-conteggio]'))).toBe('0 clienti trovati');
  });

  it('una ricerca di soli spazi lascia l’elenco completo', async () => {
    await monta('TITOLARE');
    cerca('   ');
    expect(sceltiInElenco()).toEqual([ID_VERDI, ID_BIANCHI]);
    expect(paragrafo('Nessun cliente')).toBeUndefined();
  });
});

describe('unisci clienti: conferma', () => {
  it('scegliere un cliente apre il dialogo con i due nominativi', async () => {
    await monta('TITOLARE');
    scegli(ID_VERDI);
    expect(dialogo()?.hasAttribute('open')).toBe(true);
    expect(testo(dialogo()!.querySelector('h2'))).toBe('Unire i due clienti?');
    expect(testo(dialogo()!.querySelector('p'))).toBe(
      'I veicoli e i dati di «Verdi Giulia» passano a «Rossi Mario». La scheda di «Verdi Giulia» viene eliminata.',
    );
    expect(testo(pulsanteUnisci())).toBe('Unisci');
    expect(unisciClienti).not.toHaveBeenCalled();
  });

  it('confermare unisce una volta: lo scelto è il doppione, l’attuale resta', async () => {
    await monta('TITOLARE');
    scegli(ID_VERDI);
    pulsanteUnisci().click();
    await vi.waitFor(() => expect(vaiConConferma).toHaveBeenCalledTimes(1));
    expect(unisciClienti).toHaveBeenCalledTimes(1);
    expect(unisciClienti).toHaveBeenCalledWith(ID_VERDI, ID_CLIENTE);
    expect(vaiConConferma).toHaveBeenCalledWith(`/cliente?id=${ID_CLIENTE}`, 'Clienti uniti.');
  });

  it('se l’unione fallisce il dialogo resta aperto con l’errore e non si cambia pagina', async () => {
    unisciClienti.mockRejectedValue(new ErroreModulo('Unione non riuscita.'));
    await monta('TITOLARE');
    scegli(ID_BIANCHI);
    pulsanteUnisci().click();
    await vi.waitFor(() =>
      expect(testo(dialogo()!.querySelector('[role="alert"]'))).toBe('Unione non riuscita.'),
    );
    expect(dialogo()!.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(false);
    expect(dialogo()?.hasAttribute('open')).toBe(true);
    expect(pulsanteUnisci().disabled).toBe(false);
    expect(unisciClienti).toHaveBeenCalledWith(ID_BIANCHI, ID_CLIENTE);
    expect(vaiConConferma).not.toHaveBeenCalled();
  });

  it('«Annulla» chiude il dialogo senza unire', async () => {
    await monta('TITOLARE');
    scegli(ID_VERDI);
    dialogo()!.querySelector<HTMLButtonElement>('[data-annulla]')!.click();
    expect(dialogo()).toBeNull();
    expect(unisciClienti).not.toHaveBeenCalled();
    expect(vaiConConferma).not.toHaveBeenCalled();
  });
});
