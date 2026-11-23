// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_auth from '../lib/auth';
import type * as M_prenotazioni from '../lib/prenotazioni';
import type { Prenotazione } from '../lib/prenotazioni';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';

const {
  caricaPrenotazione,
  caricaClienteDellaPrenotazione,
  rispondiPrenotazione,
  rispondiProposta,
  annullaPrenotazione,
  caricaDatiUtente,
  rpc,
  vaiA,
} = vi.hoisted(() => ({
  caricaPrenotazione: vi.fn(),
  caricaClienteDellaPrenotazione: vi.fn(),
  rispondiPrenotazione: vi.fn(),
  rispondiProposta: vi.fn(),
  annullaPrenotazione: vi.fn(),
  caricaDatiUtente: vi.fn(),
  rpc: vi.fn(),
  vaiA: vi.fn(),
}));

// Si fingono le letture e le scritture: le funzioni pure e gli errori tradotti restano veri
vi.mock('../lib/prenotazioni', async (importOriginal) => ({
  ...(await importOriginal<typeof M_prenotazioni>()),
  caricaPrenotazione,
  caricaClienteDellaPrenotazione,
  rispondiPrenotazione,
  rispondiProposta,
  annullaPrenotazione,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
  lavoraInOfficina: () => false,
}));
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof M_auth>()),
  sessioneCorrente: () => ({ user: { id: 'cliente-1' } }),
}));
vi.mock('../lib/notifiche', () => ({
  // usate dal layout e dalla pagina
  avviaNotifiche: () => undefined,
  notificheNonLette: () => 0,
  numeroBadge: String,
  testoNonLette: () => '',
  segnaLette: vi.fn(),
}));
vi.mock('../ui/avvisi-push', () => ({ collegaAvvisiPush: vi.fn() }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  vaiA,
}));
// Il veicolo non è registrato in officina (maybeSingle → nessuna riga); rpc serve all'errore tradotto
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({
    rpc,
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = () => Promise.resolve({ data: null, error: null });
      return q;
    },
  }),
  chiaveSessione: () => 'chiave',
}));

import { ErroreModulo } from '../lib/errori';
import { mostraAppuntamento } from './appuntamenti';

const ID = '33333333-3333-4333-8333-333333333333';
const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
// Mezzogiorno UTC: a Roma è lo stesso giorno
const OGGI = '2026-12-10';
const IERI = '2026-12-09';
const DOMANI = '2026-12-11';

const prenotazione = (extra: Partial<Prenotazione> = {}): Prenotazione =>
  ({
    id: ID,
    officina_id: ID_OFFICINA,
    cliente_id: 'cliente-1',
    stato: 'RICHIESTA',
    giorno: DOMANI,
    fascia: 'MATTINA',
    appuntamento: null,
    servizio: 'Cambio gomme',
    veicolo: 'Fiat Panda',
    targa: 'AB123CD',
    nome_cliente: 'Mario Rossi',
    telefono_cliente: '333 1234567',
    note: '',
    messaggio_officina: '',
    officina: {
      ragione_sociale: 'Gomme Rossi',
      indirizzo: 'Via Roma 1',
      citta: 'Milano',
      telefono: null,
    },
    ...extra,
  }) as Prenotazione;

const datiUtente = (officinaId: string | null) => ({
  email: 'u@example.com',
  profilo: {},
  officine: officinaId
    ? [{ ruolo: 'TITOLARE', officina: { id: officinaId, ragione_sociale: 'Gomme Rossi' } }]
    : [],
});

const app = () => document.getElementById('app')!;
const azioni = () => app().querySelector('.tc-azioni-appuntamento')!;
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const pulsanti = () =>
  [...azioni().querySelectorAll<HTMLElement>('button, a.btn')].map((e) => norm(e.textContent));
const trova = (testo: string) =>
  [...azioni().querySelectorAll<HTMLElement>('button, a.btn')].find(
    (e) => norm(e.textContent) === testo,
  );
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog');
const confermaDialogo = () => dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;

/** Apre la pagina dell'appuntamento come cliente o come officina e attende che sia disegnata. */
async function apri(extra: Partial<Prenotazione>, comeOfficina = false) {
  caricaPrenotazione.mockResolvedValue(prenotazione(extra));
  caricaDatiUtente.mockResolvedValue(datiUtente(comeOfficina ? ID_OFFICINA : null));
  history.replaceState(null, '', `/appuntamento?id=${ID}`);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraAppuntamento(app());
  // Pagina già disegnata (dritta T145): c'è il titolo prima di controllare le assenze
  expect(app().querySelector('.tc-azioni-appuntamento')).not.toBeNull();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${OGGI}T12:00:00Z`));
  for (const f of [
    caricaPrenotazione,
    caricaClienteDellaPrenotazione,
    rispondiPrenotazione,
    rispondiProposta,
    annullaPrenotazione,
    caricaDatiUtente,
    rpc,
    vaiA,
  ]) {
    f.mockReset();
  }
  caricaClienteDellaPrenotazione.mockResolvedValue(null);
  rispondiPrenotazione.mockResolvedValue(undefined);
  rispondiProposta.mockResolvedValue(undefined);
  annullaPrenotazione.mockResolvedValue(undefined);
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

describe('appuntamento: pulsanti del cliente', () => {
  it('RICHIESTA: solo «Annulla la richiesta»', async () => {
    await apri({ stato: 'RICHIESTA' });
    expect(pulsanti()).toEqual(['Annulla la richiesta']);
  });

  it('CONFERMATA futura: «Annulla l’appuntamento»', async () => {
    await apri({ stato: 'CONFERMATA', giorno: DOMANI, appuntamento: `${DOMANI}T09:30:00Z` });
    expect(pulsanti()).toEqual(["Annulla l'appuntamento"]);
  });

  it('CONFERMATA di oggi: nessun annullo', async () => {
    await apri({ stato: 'CONFERMATA', giorno: OGGI, appuntamento: `${OGGI}T15:00:00Z` });
    expect(pulsanti()).toEqual([]);
  });

  it('CONFERMATA passata: nessun annullo', async () => {
    await apri({ stato: 'CONFERMATA', giorno: IERI, appuntamento: `${IERI}T09:00:00Z` });
    expect(pulsanti()).toEqual([]);
  });

  it('PROPOSTA: «Accetta il nuovo orario» e «Non va bene, annulla»', async () => {
    await apri({ stato: 'PROPOSTA', appuntamento: `${DOMANI}T14:00:00Z` });
    expect(pulsanti()).toEqual(['Accetta il nuovo orario', 'Non va bene, annulla']);
  });

  it('con il telefono dell’officina c’è il link tel: «Chiama …»', async () => {
    await apri({
      officina: {
        ragione_sociale: 'Gomme Rossi',
        indirizzo: 'Via Roma 1',
        citta: 'Milano',
        telefono: '02 123 456',
      },
    });
    const chiama = trova('Chiama Gomme Rossi');
    expect(chiama?.getAttribute('href')).toBe('tel:02123456');
  });
});

describe('appuntamento: pulsanti dell’officina', () => {
  it('RICHIESTA: modulo con «Ora, …», «Conferma appuntamento», proponi e rifiuta', async () => {
    await apri({ stato: 'RICHIESTA' }, true);
    const campoOra = app().querySelector<HTMLInputElement>(
      'form[data-conferma] input[name="ora"]',
    )!;
    expect(campoOra.type).toBe('time');
    const etichetta = app().querySelector(`label[for="${campoOra.id}"]`)!;
    expect(norm(etichetta.textContent)).toMatch(/^Ora, /);
    expect(pulsanti()).toEqual([
      'Conferma appuntamento',
      'Proponi un altro orario',
      'Rifiuta la richiesta',
    ]);
    expect(trova('Proponi un altro orario')!.getAttribute('href')).toBe(
      `/appuntamento/proponi?id=${ID}`,
    );
    expect(trova('Rifiuta la richiesta')!.getAttribute('href')).toBe(
      `/appuntamento/rifiuta?id=${ID}`,
    );
  });

  it('CONFERMATA di oggi: «Completato» e «Non presentato»', async () => {
    await apri({ stato: 'CONFERMATA', giorno: OGGI, appuntamento: `${OGGI}T15:00:00Z` }, true);
    const esiti = [...app().querySelectorAll<HTMLElement>('[data-esito]')];
    expect(esiti.map((e) => [e.dataset.esito, norm(e.textContent)])).toEqual([
      ['COMPLETATA', 'Completato'],
      ['NON_PRESENTATO', 'Non presentato'],
    ]);
    expect(trova("Annulla l'appuntamento")).toBeUndefined();
  });

  it('CONFERMATA futura: «Sposta (proponi un altro orario)» e «Annulla l’appuntamento»', async () => {
    await apri({ stato: 'CONFERMATA', giorno: DOMANI, appuntamento: `${DOMANI}T09:30:00Z` }, true);
    expect(pulsanti()).toEqual(['Sposta (proponi un altro orario)', "Annulla l'appuntamento"]);
    expect(app().querySelector('[data-esito]')).toBeNull();
  });
});

describe('appuntamento: azioni', () => {
  it('«Accetta il nuovo orario» chiama rispondiProposta(id, true) una volta e disattiva il pulsante', async () => {
    let finisci!: () => void;
    rispondiProposta.mockReturnValue(new Promise<void>((r) => (finisci = r)));
    await apri({ stato: 'PROPOSTA', appuntamento: `${DOMANI}T14:00:00Z` });
    const accetta = trova('Accetta il nuovo orario') as HTMLButtonElement;
    accetta.click();
    accetta.click(); // il secondo clic non parte: il pulsante è disattivato
    expect(accetta.disabled).toBe(true);
    expect(rispondiProposta).toHaveBeenCalledTimes(1);
    expect(rispondiProposta).toHaveBeenCalledWith(ID, true);
    expect(vaiA).not.toHaveBeenCalled();
    finisci();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));
    expect(vaiA).toHaveBeenCalledWith(`/appuntamento?id=${ID}`, { sostituisci: true });
  });

  it('«Completato» chiama rispondiPrenotazione(id, COMPLETATA)', async () => {
    await apri({ stato: 'CONFERMATA', giorno: OGGI, appuntamento: `${OGGI}T15:00:00Z` }, true);
    (trova('Completato') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));
    expect(rispondiPrenotazione).toHaveBeenCalledTimes(1);
    expect(rispondiPrenotazione).toHaveBeenCalledWith(ID, 'COMPLETATA');
  });

  it('un errore tradotto dalla funzione SQL va nel riquadro e il pulsante torna attivo', async () => {
    // Percorso d'origine: la vera rispondiPrenotazione traduce STATO_NON_VALIDO in ErroreModulo
    const vera = (await vi.importActual<typeof M_prenotazioni>('../lib/prenotazioni'))
      .rispondiPrenotazione;
    rpc.mockResolvedValue({ error: { message: 'STATO_NON_VALIDO' }, status: 400 });
    rispondiPrenotazione.mockImplementation(vera);
    await apri({ stato: 'CONFERMATA', giorno: OGGI, appuntamento: `${OGGI}T15:00:00Z` }, true);
    const completato = trova('Completato') as HTMLButtonElement;
    completato.click();
    const riquadro = app().querySelector<HTMLElement>('[data-errore-azione]')!;
    await vi.waitFor(() => expect(riquadro.hidden).toBe(false));
    expect(norm(riquadro.textContent)).toBe(
      "Questa prenotazione è cambiata nel frattempo: ricarica la pagina per vedere com'è ora.",
    );
    expect(completato.disabled).toBe(false);
    expect(vaiA).not.toHaveBeenCalled();
  });

  it('un ErroreModulo della funzione mostra il suo messaggio e riattiva il pulsante', async () => {
    rispondiProposta.mockRejectedValue(new ErroreModulo('Orario non più disponibile.'));
    await apri({ stato: 'PROPOSTA', appuntamento: `${DOMANI}T14:00:00Z` });
    const accetta = trova('Accetta il nuovo orario') as HTMLButtonElement;
    accetta.click();
    const riquadro = app().querySelector<HTMLElement>('[data-errore-azione]')!;
    await vi.waitFor(() => expect(riquadro.hidden).toBe(false));
    expect(norm(riquadro.textContent)).toBe('Orario non più disponibile.');
    expect(accetta.disabled).toBe(false);
  });

  it('«Annulla la richiesta» apre il dialogo e solo la conferma chiama annullaPrenotazione', async () => {
    await apri({ stato: 'RICHIESTA' });
    (trova('Annulla la richiesta') as HTMLButtonElement).click();
    expect(dialogo()!.querySelector('h2')!.textContent).toBe('Annullare la richiesta?');
    expect(annullaPrenotazione).not.toHaveBeenCalled();
    confermaDialogo().click();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));
    expect(annullaPrenotazione).toHaveBeenCalledTimes(1);
    expect(annullaPrenotazione).toHaveBeenCalledWith(ID);
  });

  it('chiudere il dialogo con «Annulla» non cancella nulla', async () => {
    await apri({ stato: 'RICHIESTA' });
    (trova('Annulla la richiesta') as HTMLButtonElement).click();
    dialogo()!.querySelector<HTMLButtonElement>('[data-annulla]')!.click();
    expect(dialogo()).toBeNull();
    expect(annullaPrenotazione).not.toHaveBeenCalled();
  });
});
