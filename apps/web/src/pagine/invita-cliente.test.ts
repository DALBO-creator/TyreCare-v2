// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_inviti from '../lib/inviti';
import type * as M_officina from '../lib/officina';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';

const { caricaCliente, caricaDatiUtente, creaInvito } = vi.hoisted(() => ({
  caricaCliente: vi.fn(),
  caricaDatiUtente: vi.fn(),
  creaInvito: vi.fn(),
}));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// Si fingono solo letture e scrittura: linkInvito, mailtoInvito e GIORNI_VALIDITA restano veri
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaCliente,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/inviti', async (importOriginal) => ({
  ...(await importOriginal<typeof M_inviti>()),
  creaInvito,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraInvitaCliente } from './invita-cliente';

const ID_CLIENTE = '11111111-1111-4111-8111-111111111111';
const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'mario.rossi@esempio.it';
const CODICE = 'codice-segreto';

const cliente = (profileId: string | null, officinaId = ID_OFFICINA) => ({
  id: ID_CLIENTE,
  officina_id: officinaId,
  profile_id: profileId,
  nome: 'Mario',
  cognome: 'Rossi',
  ragione_sociale: null,
  telefono: null,
  email: EMAIL,
  note: null,
  veicoli: [{ count: 0 }],
});

const utente = {
  email: 'o@example.com',
  profilo: {},
  officine: [
    {
      ruolo: 'TITOLARE',
      officina: {
        id: ID_OFFICINA,
        ragione_sociale: 'Gomme Rossi',
        citta: 'Milano',
        stato_affiliazione: 'ATTIVA',
      },
    },
  ],
};

const monta = async (id: string = ID_CLIENTE) => {
  history.replaceState(null, '', `/cliente/invito?id=${id}`);
  document.body.innerHTML = '<div id="app"></div>';
  const app = document.getElementById('app')!;
  await mostraInvitaCliente(app);
  return app;
};

const pulsante = (app: HTMLElement, nome: string) =>
  [...app.querySelectorAll('button, a')].find(
    (e) => e.textContent?.replace(/\s+/g, ' ').trim() === nome,
  ) as HTMLElement | undefined;

/** Invia il modulo e aspetta la schermata «Invito pronto». */
const creaEAttendi = async (app: HTMLElement) => {
  app.querySelector('form')!.requestSubmit();
  await vi.waitFor(() => expect(app.querySelector('h1')?.textContent).toBe('Invito pronto'));
};

const descrittori = {
  clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
  share: Object.getOwnPropertyDescriptor(navigator, 'share'),
};
const imposta = (nome: 'clipboard' | 'share', value: unknown) =>
  Object.defineProperty(navigator, nome, { value, configurable: true, writable: true });

beforeEach(() => {
  for (const f of [caricaCliente, caricaDatiUtente, creaInvito, mostraPagina]) f.mockReset();
  caricaCliente.mockResolvedValue(cliente(null));
  caricaDatiUtente.mockResolvedValue(utente);
  creaInvito.mockResolvedValue({ codice: CODICE, scade_il: '2026-12-07T10:00:00Z' });
  // Senza share per default (come un computer); i test lo aggiungono se serve
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});

afterEach(() => {
  for (const nome of ['clipboard', 'share'] as const) {
    const d = descrittori[nome];
    if (d) Object.defineProperty(navigator, nome, d);
    else Reflect.deleteProperty(navigator, nome);
  }
  document.body.innerHTML = '';
});

describe('invita il cliente nell’app', () => {
  it('un id non valido dà «Cliente non trovato» senza leggere nulla', async () => {
    const app = await monta('non-un-id');
    expect(app.querySelector('h1')?.textContent).toBe('Cliente non trovato');
    expect(caricaCliente).not.toHaveBeenCalled();
    expect(app.querySelector('form')).toBeNull();
  });

  it('un cliente di un’altra officina (nessuna riga per la RLS) dà «Cliente non trovato»', async () => {
    caricaCliente.mockResolvedValue(null);
    const app = await monta();
    expect(caricaCliente).toHaveBeenCalledWith(ID_CLIENTE);
    expect(app.querySelector('h1')?.textContent).toBe('Cliente non trovato');
    expect(app.querySelector('form')).toBeNull();
  });

  it('un cliente di un’officina che l’utente non ha dà «Cliente non trovato»', async () => {
    caricaCliente.mockResolvedValue(cliente(null, '33333333-3333-4333-8333-333333333333'));
    const app = await monta();
    expect(app.querySelector('h1')?.textContent).toBe('Cliente non trovato');
    expect(app.querySelector('form')).toBeNull();
  });

  it('un cliente con account collegato non ha il modulo', async () => {
    caricaCliente.mockResolvedValue(cliente('profilo-1'));
    const app = await monta();
    expect(app.querySelector('h1')?.textContent).toBe("Invita nell'app");
    expect(app.textContent).toContain(
      'Questo cliente ha già collegato il suo account: vede i suoi veicoli nel garage.',
    );
    expect(app.querySelector('form')).toBeNull();
    expect(pulsante(app, 'Torna al cliente')?.getAttribute('href')).toBe(
      `/cliente?id=${ID_CLIENTE}`,
    );
  });

  it('il modulo ha l’email del cliente già scritta', async () => {
    const app = await monta();
    expect(app.querySelector<HTMLInputElement>('input[name="email"]')!.value).toBe(EMAIL);
    expect(creaInvito).not.toHaveBeenCalled();
  });

  it('inviando crea l’invito una volta e mostra «Invito pronto» con email, scadenza e mailto', async () => {
    const app = await monta();
    await creaEAttendi(app);
    expect(creaInvito).toHaveBeenCalledTimes(1);
    expect(creaInvito).toHaveBeenCalledWith(ID_CLIENTE, EMAIL);
    expect(app.querySelector('strong')?.textContent).toBe(EMAIL);
    expect(app.textContent?.replace(/\s+/g, ' ')).toContain('Vale fino al 7 dicembre 2026.');
    const href = pulsante(app, "Scrivi l'email")!.getAttribute('href')!;
    expect(href.startsWith(`mailto:${EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain(`${location.origin}/invito?codice=${CODICE}`);
    expect(document.activeElement).toBe(app.querySelector('h1'));
  });

  it('«Copia il link» scrive il link negli appunti e lo dice', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    imposta('clipboard', { writeText });
    const app = await monta();
    await creaEAttendi(app);
    const esito = app.querySelector<HTMLElement>('[role="status"]')!;
    expect(esito.hidden).toBe(true);
    pulsante(app, 'Copia il link')!.click();
    await vi.waitFor(() => expect(esito.hidden).toBe(false));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/invito?codice=${CODICE}`);
    expect(esito.textContent).toBe('Link copiato.');
  });

  it('senza navigator.share non c’è «Condividi il link»', async () => {
    const app = await monta();
    await creaEAttendi(app);
    expect(pulsante(app, 'Copia il link')).toBeDefined();
    expect(pulsante(app, 'Condividi il link')).toBeUndefined();
  });

  it('con navigator.share «Condividi il link» lo chiama col link', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    imposta('share', share);
    const app = await monta();
    await creaEAttendi(app);
    pulsante(app, 'Condividi il link')!.click();
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share).toHaveBeenCalledWith({
      title: 'Gomme Rossi ti invita su TyreCare',
      text: `Collega i tuoi veicoli su TyreCare accedendo con ${EMAIL}:`,
      url: `${location.origin}/invito?codice=${CODICE}`,
    });
  });
});
