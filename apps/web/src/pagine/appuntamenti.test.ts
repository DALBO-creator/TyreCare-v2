// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_auth from '../lib/auth';
import type * as M_prenotazioni from '../lib/prenotazioni';
import type { Prenotazione } from '../lib/prenotazioni';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';

const {
  caricaMiePrenotazioni,
  caricaPrenotazioniOfficina,
  caricaPrenotazione,
  caricaClienteDellaPrenotazione,
  rispondiPrenotazione,
  rispondiProposta,
  annullaPrenotazione,
  caricaDatiUtente,
  rpc,
  vaiA,
} = vi.hoisted(() => ({
  caricaMiePrenotazioni: vi.fn(),
  caricaPrenotazioniOfficina: vi.fn(),
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
  caricaMiePrenotazioni,
  caricaPrenotazioniOfficina,
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

import { istanteItaliano } from '@tyrecare/shared';
import { ErroreModulo } from '../lib/errori';
import {
  mostraAppuntamento,
  mostraAppuntamenti,
  mostraProponi,
  mostraRifiuta,
} from './appuntamenti';
import { avvisoConferma } from './comune';

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
    caricaMiePrenotazioni,
    caricaPrenotazioniOfficina,
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

// ---------------------------------------------------------------------------------------------------
// T381: elenco, «Proponi un altro orario» e «Rifiuta»
// ---------------------------------------------------------------------------------------------------

/** Id valido (UUID v4) diverso per ogni riga. */
const idRiga = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const href = (n: number) => `/appuntamento?id=${idRiga(n)}`;

const titoliH2 = () => [...app().querySelectorAll('h2')].map((h) => norm(h.textContent));
const linkDi = (sezioneId: string) =>
  [...app().querySelectorAll<HTMLAnchorElement>(`#${sezioneId} ~ .tc-lista a[href]`)].map((a) =>
    a.getAttribute('href'),
  );
const testoVuoto = () => norm(app().querySelector('.tc-vuoto__testo')?.textContent);

/** Apre l'elenco come cliente o come officina e attende che sia disegnato (c'è il titolo h1). */
async function apriElenco(righe: Prenotazione[], comeOfficina: boolean) {
  caricaMiePrenotazioni.mockResolvedValue(righe);
  caricaPrenotazioniOfficina.mockResolvedValue(righe);
  caricaDatiUtente.mockResolvedValue(datiUtente(comeOfficina ? ID_OFFICINA : null));
  history.replaceState(null, '', '/appuntamenti');
  document.body.innerHTML = '<div id="app"></div>';
  await mostraAppuntamenti(app());
  expect(norm(app().querySelector('h1')?.textContent)).toBe('Appuntamenti');
}

describe('elenco appuntamenti', () => {
  const VUOTO_OFFICINA =
    "Qui arrivano le richieste dei clienti che prenotano dall'app. Controlla che il catalogo dei servizi sia completo.";
  const VUOTO_CLIENTE =
    "Scegli un'officina e chiedi un appuntamento: ti risponde con l'ora precisa.";

  it('officina senza righe: testo di «Nessun appuntamento» per l’officina e nessuna sezione', async () => {
    await apriElenco([], true);
    expect(testoVuoto()).toBe(VUOTO_OFFICINA);
    expect(titoliH2()).toEqual([]);
    expect(caricaMiePrenotazioni).not.toHaveBeenCalled();
  });

  it('cliente senza righe: testo di «Nessun appuntamento» per il cliente e nessuna sezione', async () => {
    await apriElenco([], false);
    expect(testoVuoto()).toBe(VUOTO_CLIENTE);
    expect(titoliH2()).toEqual([]);
    expect(caricaPrenotazioniOfficina).not.toHaveBeenCalled();
  });

  it('officina: sezioni nell’ordine del codice, righe con link e lettura dal giorno OGGI - 30', async () => {
    await apriElenco(
      [
        prenotazione({ id: idRiga(1), stato: 'RICHIESTA', giorno: DOMANI }),
        prenotazione({
          id: idRiga(2),
          stato: 'CONFERMATA',
          giorno: DOMANI,
          appuntamento: `${DOMANI}T09:30:00Z`,
        }),
        prenotazione({
          id: idRiga(3),
          stato: 'PROPOSTA',
          giorno: DOMANI,
          appuntamento: `${DOMANI}T14:00:00Z`,
        }),
        prenotazione({
          id: idRiga(4),
          stato: 'CONFERMATA',
          giorno: IERI,
          appuntamento: `${IERI}T09:00:00Z`,
        }),
        // Fuori da ogni sezione: richiesta scaduta, annullata
        prenotazione({ id: idRiga(5), stato: 'RICHIESTA', giorno: IERI }),
        prenotazione({ id: idRiga(6), stato: 'ANNULLATA', giorno: DOMANI }),
      ],
      true,
    );
    expect(caricaPrenotazioniOfficina).toHaveBeenCalledTimes(1);
    expect(caricaPrenotazioniOfficina).toHaveBeenCalledWith(ID_OFFICINA, '2026-11-10');
    expect(caricaMiePrenotazioni).not.toHaveBeenCalled();
    expect(titoliH2()).toEqual([
      'Da confermare',
      'Prossimi appuntamenti',
      "Passati: com'è andata?",
    ]);
    expect([...app().querySelectorAll('h2')].map((h) => h.id)).toEqual([
      'tc-da-confermare',
      'tc-prossimi',
      'tc-da-chiudere',
    ]);
    expect(linkDi('tc-da-confermare')).toEqual([href(1)]);
    expect(linkDi('tc-prossimi')).toEqual([href(2), href(3)]);
    expect(linkDi('tc-da-chiudere')).toEqual([href(4)]);
    expect(app().querySelectorAll(`a[href="${href(5)}"], a[href="${href(6)}"]`)).toHaveLength(0);
    // La riga dice servizio, cliente e targa (non il nome dell'officina)
    const riga = app().querySelector(`a[href="${href(1)}"]`)!;
    expect(norm(riga.querySelector('small')?.textContent)).toBe('Mario Rossi · AB 123 CD');
    expect(app().querySelector('a[href="/servizi"]')).not.toBeNull();
  });

  it('officina con sole prenotazioni fuori sezione: stato vuoto', async () => {
    await apriElenco([prenotazione({ id: idRiga(1), stato: 'ANNULLATA', giorno: DOMANI })], true);
    expect(testoVuoto()).toBe(VUOTO_OFFICINA);
    expect(titoliH2()).toEqual([]);
  });

  it('cliente: «In programma» (dal fondo) e «Passati e annullati», con link e nome dell’officina', async () => {
    await apriElenco(
      [
        prenotazione({ id: idRiga(1), stato: 'RICHIESTA', giorno: DOMANI }),
        prenotazione({
          id: idRiga(2),
          stato: 'CONFERMATA',
          giorno: DOMANI,
          appuntamento: `${DOMANI}T09:30:00Z`,
        }),
        prenotazione({ id: idRiga(3), stato: 'ANNULLATA', giorno: DOMANI }),
        prenotazione({
          id: idRiga(4),
          stato: 'CONFERMATA',
          giorno: IERI,
          appuntamento: `${IERI}T09:00:00Z`,
        }),
      ],
      false,
    );
    expect(caricaMiePrenotazioni).toHaveBeenCalledTimes(1);
    expect(caricaPrenotazioniOfficina).not.toHaveBeenCalled();
    expect(titoliH2()).toEqual(['In programma', 'Passati e annullati']);
    // Le prenotazioni arrivano dalla più recente: «In programma» le mostra dalla più vicina (reverse)
    expect(linkDi('tc-in-corso')).toEqual([href(2), href(1)]);
    expect(linkDi('tc-storico-app')).toEqual([href(3), href(4)]);
    const riga = app().querySelector(`a[href="${href(1)}"]`)!;
    expect(norm(riga.querySelector('small')?.textContent)).toBe('Gomme Rossi');
    expect(app().querySelector('a[href="/officine"]')).not.toBeNull();
    expect(app().querySelector('a[href="/servizi"]')).toBeNull();
  });
});

/** Apre una pagina dell'officina (proponi / rifiuta) e attende che sia disegnata. */
async function apriOfficina(
  mostra: (el: HTMLElement) => Promise<void>,
  percorso: string,
  extra: Partial<Prenotazione>,
  utente: string | null = ID_OFFICINA,
) {
  caricaPrenotazione.mockResolvedValue(prenotazione(extra));
  caricaDatiUtente.mockResolvedValue(datiUtente(utente));
  history.replaceState(null, '', `${percorso}?id=${ID}`);
  document.body.innerHTML = '<div id="app"></div>';
  await mostra(app());
  expect(app().querySelector('h1')).not.toBeNull();
}

const titolo = () => norm(app().querySelector('h1')?.textContent);
const modulo = () => app().querySelector('form')!;
const invia = () => modulo().requestSubmit();
const campoNome = (nome: string) =>
  modulo().querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${nome}"]`)!;
const riquadroErrore = () => modulo().querySelector<HTMLElement>('[data-errore-modulo]')!;
const pulsanteInvio = () => modulo().querySelector<HTMLButtonElement>('[type="submit"]')!;

describe('«Proponi un altro orario»', () => {
  const apriProponi = (extra: Partial<Prenotazione> = {}, utente: string | null = ID_OFFICINA) =>
    apriOfficina(mostraProponi, '/appuntamento/proponi', extra, utente);

  it('prenotazione di un’altra officina e di un altro cliente: «Appuntamento non trovato»', async () => {
    await apriProponi({ cliente_id: 'altro-cliente' }, null);
    expect(titolo()).toBe('Appuntamento non trovato');
    expect(app().querySelector('form')).toBeNull();
  });

  it('il cliente che l’ha chiesta (non officina) non può proporre: «Appuntamento non trovato»', async () => {
    await apriProponi({ cliente_id: 'cliente-1' }, null);
    expect(titolo()).toBe('Appuntamento non trovato');
    expect(app().querySelector('form')).toBeNull();
  });

  it.each(['COMPLETATA', 'ANNULLATA', 'RIFIUTATA', 'NON_PRESENTATO'] as const)(
    'stato %s: «Appuntamento non trovato»',
    async (stato) => {
      await apriProponi({ stato });
      expect(titolo()).toBe('Appuntamento non trovato');
      expect(app().querySelector('form')).toBeNull();
    },
  );

  it('id non valido: «Appuntamento non trovato» senza leggere la prenotazione', async () => {
    caricaDatiUtente.mockResolvedValue(datiUtente(ID_OFFICINA));
    history.replaceState(null, '', '/appuntamento/proponi?id=xyz');
    document.body.innerHTML = '<div id="app"></div>';
    await mostraProponi(app());
    expect(titolo()).toBe('Appuntamento non trovato');
    expect(caricaPrenotazione).not.toHaveBeenCalled();
  });

  it('modulo precompilato col giorno della richiesta e ora vuota', async () => {
    await apriProponi({ stato: 'RICHIESTA', giorno: DOMANI });
    expect(titolo()).toBe('Proponi un altro orario');
    expect(campoNome('giorno').value).toBe(DOMANI);
    expect(campoNome('ora').value).toBe('');
    expect(norm(pulsanteInvio().textContent)).toBe('Invia la proposta');
  });

  it('giorno e ora: una sola chiamata con l’istante italiano (dicembre = UTC+1) e conferma', async () => {
    await apriProponi({ stato: 'RICHIESTA', giorno: DOMANI });
    campoNome('giorno').value = DOMANI;
    campoNome('ora').value = '15:30';
    campoNome('messaggio').value = 'Il mattino siamo al completo';
    invia();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));
    expect(rispondiPrenotazione).toHaveBeenCalledTimes(1);
    const [id, azione, dati] = rispondiPrenotazione.mock.calls[0]!;
    expect(id).toBe(ID);
    expect(azione).toBe('PROPONI');
    // 15:30 a Roma in inverno sono le 14:30 UTC: il valore è scritto a mano per provare il fuso
    expect(dati).toEqual({
      appuntamento: '2026-12-11T14:30:00.000Z',
      messaggio: 'Il mattino siamo al completo',
    });
    expect(dati.appuntamento).toBe(istanteItaliano(DOMANI, '15:30'));
    expect(vaiA).toHaveBeenCalledWith(`/appuntamento?id=${ID}`, { sostituisci: false });
    expect(avvisoConferma()).toContain('Proposta inviata al cliente.');
  });

  it('senza ora il modulo non parte: errore sul campo e nessuna chiamata', async () => {
    await apriProponi({ stato: 'RICHIESTA', giorno: DOMANI });
    invia();
    await vi.waitFor(() => expect(campoNome('ora').getAttribute('aria-invalid')).toBe('true'));
    expect(rispondiPrenotazione).not.toHaveBeenCalled();
    expect(vaiA).not.toHaveBeenCalled();
  });

  it('un errore tradotto dalla funzione SQL va nel riquadro del modulo e il pulsante torna attivo', async () => {
    // Percorso d'origine: la vera rispondiPrenotazione traduce STATO_NON_VALIDO in ErroreModulo
    const vera = (await vi.importActual<typeof M_prenotazioni>('../lib/prenotazioni'))
      .rispondiPrenotazione;
    rpc.mockResolvedValue({ error: { message: 'STATO_NON_VALIDO' }, status: 400 });
    rispondiPrenotazione.mockImplementation(vera);
    await apriProponi({ stato: 'RICHIESTA', giorno: DOMANI });
    campoNome('ora').value = '15:30';
    invia();
    await vi.waitFor(() => expect(riquadroErrore().hidden).toBe(false));
    expect(norm(riquadroErrore().textContent)).toBe(
      "Questa prenotazione è cambiata nel frattempo: ricarica la pagina per vedere com'è ora.",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('rispondi_prenotazione', {
      p_id: ID,
      p_azione: 'PROPONI',
      p_appuntamento: '2026-12-11T14:30:00.000Z',
      p_messaggio: '',
    });
    expect(pulsanteInvio().disabled).toBe(false);
    expect(vaiA).not.toHaveBeenCalled();
  });

  it('un ErroreModulo con il messaggio dell’officina compare nel riquadro', async () => {
    rispondiPrenotazione.mockRejectedValue(new ErroreModulo('Orario non più disponibile.'));
    await apriProponi({ stato: 'CONFERMATA', giorno: DOMANI, appuntamento: `${DOMANI}T09:30:00Z` });
    expect(campoNome('ora').value).toBe('10:30');
    invia();
    await vi.waitFor(() => expect(riquadroErrore().hidden).toBe(false));
    expect(norm(riquadroErrore().textContent)).toBe('Orario non più disponibile.');
    expect(vaiA).not.toHaveBeenCalled();
  });
});

describe('«Rifiuta» / «Annulla l’appuntamento» dell’officina', () => {
  const apriRifiuta = (extra: Partial<Prenotazione> = {}, utente: string | null = ID_OFFICINA) =>
    apriOfficina(mostraRifiuta, '/appuntamento/rifiuta', extra, utente);

  it('prenotazione di un altro cliente e officina: «Appuntamento non trovato»', async () => {
    await apriRifiuta({ cliente_id: 'altro-cliente' }, null);
    expect(titolo()).toBe('Appuntamento non trovato');
    expect(app().querySelector('form')).toBeNull();
  });

  it('il cliente che l’ha chiesta non passa da qui: «Appuntamento non trovato»', async () => {
    await apriRifiuta({ cliente_id: 'cliente-1' }, null);
    expect(titolo()).toBe('Appuntamento non trovato');
  });

  it.each(['COMPLETATA', 'ANNULLATA', 'RIFIUTATA', 'NON_PRESENTATO'] as const)(
    'stato %s: «Appuntamento non trovato»',
    async (stato) => {
      await apriRifiuta({ stato });
      expect(titolo()).toBe('Appuntamento non trovato');
      expect(app().querySelector('form')).toBeNull();
    },
  );

  it('CONFERMATA: titolo e pulsante dicono l’annullo', async () => {
    await apriRifiuta({ stato: 'CONFERMATA', giorno: DOMANI, appuntamento: `${DOMANI}T09:30:00Z` });
    expect(titolo()).toBe("Annulla l'appuntamento");
    expect(norm(pulsanteInvio().textContent)).toBe("Annulla l'appuntamento");
  });

  it('RICHIESTA: titolo e pulsante dicono il rifiuto', async () => {
    await apriRifiuta({ stato: 'RICHIESTA' });
    expect(titolo()).toBe('Rifiuta la richiesta');
    expect(norm(pulsanteInvio().textContent)).toBe('Rifiuta la richiesta');
  });

  it('RICHIESTA, invio col motivo: una chiamata RIFIUTA e conferma «Richiesta rifiutata.»', async () => {
    await apriRifiuta({ stato: 'RICHIESTA' });
    campoNome('messaggio').value = 'Quel giorno siamo chiusi';
    invia();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));
    expect(rispondiPrenotazione).toHaveBeenCalledTimes(1);
    expect(rispondiPrenotazione).toHaveBeenCalledWith(ID, 'RIFIUTA', {
      messaggio: 'Quel giorno siamo chiusi',
    });
    expect(vaiA).toHaveBeenCalledWith(`/appuntamento?id=${ID}`, { sostituisci: false });
    expect(avvisoConferma()).toContain('Richiesta rifiutata.');
  });

  it('CONFERMATA, invio col motivo: una chiamata RIFIUTA e conferma «Appuntamento annullato.»', async () => {
    await apriRifiuta({ stato: 'CONFERMATA', giorno: DOMANI, appuntamento: `${DOMANI}T09:30:00Z` });
    campoNome('messaggio').value = 'Siamo chiusi per ferie';
    invia();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));
    expect(rispondiPrenotazione).toHaveBeenCalledTimes(1);
    expect(rispondiPrenotazione).toHaveBeenCalledWith(ID, 'RIFIUTA', {
      messaggio: 'Siamo chiusi per ferie',
    });
    expect(avvisoConferma()).toContain('Appuntamento annullato.');
  });

  it('un errore della funzione resta nel riquadro e non cambia pagina', async () => {
    rispondiPrenotazione.mockRejectedValue(new ErroreModulo('Richiesta già chiusa.'));
    await apriRifiuta({ stato: 'RICHIESTA' });
    invia();
    await vi.waitFor(() => expect(riquadroErrore().hidden).toBe(false));
    expect(norm(riquadroErrore().textContent)).toBe('Richiesta già chiusa.');
    expect(pulsanteInvio().disabled).toBe(false);
    expect(vaiA).not.toHaveBeenCalled();
  });
});
