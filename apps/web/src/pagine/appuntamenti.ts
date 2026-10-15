import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Car,
  ChevronRight,
  MessageSquare,
  Phone,
  StickyNote,
  UserPlus,
  UserX,
  Wrench,
} from 'lucide';
import {
  ConfermaPrenotazioneSchema,
  RifiutoPrenotazioneSchema,
  aggiungiGiorni,
  creaPropostaSchema,
  formattaTarga,
  inItalia,
  istanteItaliano,
  oggiInItalia,
} from '@tyrecare/shared';
import { messaggioErrore, sessioneCorrente } from '../lib/auth';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import { notificheNonLette, segnaLette } from '../lib/notifiche';
import { officinaAttiva } from '../lib/officina';
import {
  annullaPrenotazione,
  caricaClienteDellaPrenotazione,
  caricaMiePrenotazioni,
  caricaPrenotazione,
  caricaPrenotazioniOfficina,
  rispondiPrenotazione,
  registraClienteDaPrenotazione,
  rispondiProposta,
  type Prenotazione,
} from '../lib/prenotazioni';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { getSupabase } from '../lib/supabase';
import { collegaAvvisiPush } from '../ui/avvisi-push';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, areaTesto, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { IN_CORSO, badgePrenotazione, formattaGiornoTitolo, quando } from '../ui/prenotazione';
import { selettoreVista } from './calendario';
import {
  avvisoConferma,
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';

// Appuntamenti (Fase 4). Stessa pagina per il cliente (le sue richieste) e per chi lavora in officina
// (le richieste ricevute dall'officina attiva). Le azioni passano dalle funzioni SQL, che controllano
// di nuovo stato e permessi: qui si mostrano solo i pulsanti che hanno senso.

/** Riga di un appuntamento nell'elenco. */
function rigaAppuntamento(p: Prenotazione, perOfficina: boolean): string {
  const chi = perOfficina
    ? [p.nome_cliente || 'Cliente', formattaTarga(p.targa)].join(' · ')
    : p.officina.ragione_sociale;
  return `
    <a class="tc-lista__riga tc-appuntamento-riga" href="/appuntamento?id=${p.id}">
      <span class="tc-lista__testo">
        <span class="tc-appuntamento-riga__quando">${esc(quando(p))}</span>
        <span>${esc(p.servizio)}</span>
        <small>${esc(chi)}</small>
      </span>
      ${badgePrenotazione(p.stato, perOfficina)}
    </a>`;
}

function sezione(id: string, titolo: string, righe: string[]): string {
  if (!righe.length) return '';
  return `
    <section aria-labelledby="${id}">
      <h2 id="${id}" class="tc-etichetta">${esc(titolo)}</h2>
      <div class="tc-lista">${righe.join('')}</div>
    </section>`;
}

function nessunAppuntamento(perOfficina: boolean): string {
  return `
    <div class="tc-vuoto">
      <span class="tc-vuoto__icona">${icona(CalendarDays)}</span>
      <p class="tc-vuoto__titolo">Nessun appuntamento</p>
      <p class="tc-vuoto__testo">
        ${
          perOfficina
            ? "Qui arrivano le richieste dei clienti che prenotano dall'app. Controlla che il catalogo dei servizi sia completo."
            : "Scegli un'officina e chiedi un appuntamento: ti risponde con l'ora precisa."
        }
      </p>
    </div>`;
}

/** Il momento dell'appuntamento è passato (o è oggi)? Serve per "Completato" / "Non presentato". */
const passatoOOggi = (p: Prenotazione, oggi: string) =>
  (p.appuntamento ? inItalia(p.appuntamento).data : p.giorno) <= oggi;

export async function mostraAppuntamenti(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const oggi = oggiInItalia();

  let dati: DatiUtente;
  let prenotazioni: Prenotazione[];
  try {
    dati = await caricaDatiUtente();
    const attiva = officinaAttiva(dati.officine);
    // In officina: anche l'ultimo mese, per chiudere gli appuntamenti passati
    prenotazioni = attiva
      ? await caricaPrenotazioniOfficina(attiva.officina.id, aggiungiGiorni(oggi, -30))
      : await caricaMiePrenotazioni();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const attiva = officinaAttiva(dati.officine);
  let corpo: string;
  if (attiva) {
    const daConfermare = prenotazioni.filter((p) => p.stato === 'RICHIESTA' && p.giorno >= oggi);
    const daChiudere = prenotazioni.filter(
      (p) => p.stato === 'CONFERMATA' && passatoOOggi(p, oggi) && p.giorno < oggi,
    );
    const prossimi = prenotazioni.filter(
      (p) => (p.stato === 'CONFERMATA' || p.stato === 'PROPOSTA') && p.giorno >= oggi,
    );
    const riga = (p: Prenotazione) => rigaAppuntamento(p, true);
    corpo =
      daConfermare.length + daChiudere.length + prossimi.length
        ? [
            sezione('tc-da-confermare', 'Da confermare', daConfermare.map(riga)),
            sezione('tc-prossimi', 'Prossimi appuntamenti', prossimi.map(riga)),
            sezione('tc-da-chiudere', "Passati: com'è andata?", daChiudere.map(riga)),
          ].join('')
        : nessunAppuntamento(true);
    corpo += `<a class="btn btn-outline-light btn-lg w-100" href="/servizi">${icona(Wrench)} Servizi dell'officina</a>`;
  } else {
    const inCorso = prenotazioni
      .filter(
        (p) =>
          IN_CORSO.includes(p.stato) &&
          (p.appuntamento ? inItalia(p.appuntamento).data : p.giorno) >= oggi,
      )
      .reverse();
    const altri = prenotazioni.filter((p) => !inCorso.includes(p));
    const riga = (p: Prenotazione) => rigaAppuntamento(p, false);
    corpo = `
      <a class="btn btn-primary btn-lg w-100" href="/officine">${icona(CalendarPlus)} Nuovo appuntamento</a>
      ${
        prenotazioni.length
          ? sezione('tc-in-corso', 'In programma', inCorso.map(riga)) +
            sezione('tc-storico-app', 'Passati e annullati', altri.map(riga))
          : nessunAppuntamento(false)
      }`;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Appuntamenti', attiva ? attiva.officina.ragione_sociale : 'I tuoi')}
    <div class="tc-contenuto">
      ${attiva ? selettoreVista('elenco') : ''}
      ${avvisoConferma()}
      ${corpo}
    </div>`);
}

// ---------------------------------------------------------------------------------------------------
// Dettaglio
// ---------------------------------------------------------------------------------------------------

function appuntamentoNonTrovato(): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(CalendarX)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">Appuntamento non trovato</h1>
        <p class="tc-vuoto__testo">Non esiste più oppure non riguarda il tuo account.</p>
        <a class="btn btn-outline-light mt-3" href="/appuntamenti">Vai agli appuntamenti</a>
      </div>
    </div>`;
}

function rigaInfo(ic: Parameters<typeof icona>[0], testo: string, dettaglio = ''): string {
  return `
    <div class="tc-lista__riga">
      <span class="tc-lista__icona">${icona(ic)}</span>
      <span class="tc-lista__testo">${esc(testo)}${dettaglio ? `<small>${esc(dettaglio)}</small>` : ''}</span>
    </div>`;
}

const telefonoHref = (t: string) => `tel:${t.replace(/\s/g, '')}`;

/** Carica la prenotazione e decide chi la guarda: il cliente che l'ha chiesta o l'officina. */
async function caricaConRuolo(
  id: string | null,
): Promise<{ p: Prenotazione; perOfficina: boolean } | null> {
  if (!idValido(id)) return null;
  const [p, dati] = await Promise.all([caricaPrenotazione(id), caricaDatiUtente()]);
  if (!p) return null;
  const perOfficina = dati.officine.some((o) => o.officina.id === p.officina_id);
  if (!perOfficina && p.cliente_id !== sessioneCorrente()?.user.id) return null;
  return { p, perOfficina };
}

// Invito ad attivare le push sulla prossima pagina dell'appuntamento (una sola volta)
let invitoPush = false;

/** Dopo una richiesta: la pagina dell'appuntamento invita ad attivare gli avvisi, se sono spenti. */
export function invitaAgliAvvisi(): void {
  invitoPush = true;
}

export async function mostraAppuntamento(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const invito = invitoPush;
  invitoPush = false;
  app.innerHTML = paginaApp(caricamento());
  let trovato: Awaited<ReturnType<typeof caricaConRuolo>>;
  let veicoloId: string | null = null;
  let clienteCollegato: Awaited<ReturnType<typeof caricaClienteDellaPrenotazione>> = null;
  try {
    trovato = await caricaConRuolo(parametro('id'));
    if (trovato?.perOfficina) {
      // Il veicolo è già registrato in officina? Allora si apre la sua scheda
      const { data } = await getSupabase()
        .from('veicoli')
        .select('id')
        .eq('officina_id', trovato.p.officina_id)
        .eq('targa', trovato.p.targa)
        .maybeSingle();
      veicoloId = data?.id ?? null;
      // Altrimenti si può registrare: sulla scheda del cliente già collegato all'account, se c'è
      if (!veicoloId) clienteCollegato = await caricaClienteDellaPrenotazione(trovato.p);
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!trovato) {
    app.innerHTML = paginaApp(appuntamentoNonTrovato());
    return;
  }

  const { p, perOfficina } = trovato;
  // Le notifiche di questo appuntamento ora sono viste (errori ignorati: è solo il contatore)
  if (notificheNonLette()) segnaLette({ prenotazione: p.id }).catch(() => undefined);
  const oggi = oggiInItalia();
  const veicolo = [formattaTarga(p.targa), p.veicolo].filter(Boolean).join(' · ');
  const richiestoIl = `Chiesto per ${formattaGiornoTitolo(p.giorno).toLowerCase()}, ${p.fascia === 'MATTINA' ? 'mattina' : 'pomeriggio'}`;

  const dettagli = [
    rigaInfo(Wrench, p.servizio),
    veicoloId
      ? `<a class="tc-lista__riga" href="/veicolo?id=${veicoloId}">
          <span class="tc-lista__icona">${icona(Car)}</span>
          <span class="tc-lista__testo">${esc(veicolo)}<small>Apri la scheda del veicolo</small></span>
          ${icona(ChevronRight)}
        </a>`
      : rigaInfo(Car, veicolo),
    perOfficina
      ? `<a class="tc-lista__riga" href="${esc(telefonoHref(p.telefono_cliente))}">
          <span class="tc-lista__icona">${icona(Phone)}</span>
          <span class="tc-lista__testo">${esc(p.nome_cliente || 'Cliente')}<small>Chiama ${esc(p.telefono_cliente)}</small></span>
        </a>`
      : '',
    p.note ? rigaInfo(StickyNote, 'Note del cliente', p.note) : '',
    p.messaggio_officina
      ? rigaInfo(MessageSquare, "Messaggio dell'officina", p.messaggio_officina)
      : '',
  ].join('');

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina(quando(p), perOfficina ? 'Appuntamento' : p.officina.ragione_sociale)}
    <div class="tc-contenuto">
      ${avvisoConferma()}
      <div data-sezione-push></div>
      <p class="mb-0">${badgePrenotazione(p.stato, perOfficina)}</p>
      ${p.appuntamento || p.stato !== 'RICHIESTA' ? `<p class="small text-body-secondary mb-0">${esc(richiestoIl)}</p>` : ''}
      <div class="tc-lista">${dettagli}</div>
      <div class="tc-avviso tc-avviso--rosso" data-errore-azione role="alert" tabindex="-1" hidden></div>
      <div class="tc-azioni-appuntamento">${perOfficina ? azioniOfficina(p, oggi) : azioniCliente(p, oggi)}</div>
      ${perOfficina && !veicoloId ? sezioneRegistra(p, clienteCollegato) : ''}
      <a class="btn btn-outline-light btn-lg w-100" href="/appuntamenti">Tutti gli appuntamenti</a>
    </div>`);

  collegaAzioni(app, p);
  collegaRegistra(app, p, clienteCollegato);
  const push = app.querySelector<HTMLElement>('[data-sezione-push]');
  if (push && invito) void collegaAvvisiPush(push, { invito: true });
}

type ClienteCollegato = Awaited<ReturnType<typeof caricaClienteDellaPrenotazione>>;

const nomeCliente = (p: Prenotazione, c: ClienteCollegato) =>
  (c && `${c.nome} ${c.cognome}`.trim()) || p.nome_cliente || 'Chi ha prenotato';

/**
 * Officina, veicolo non ancora registrato: un tocco lo aggiunge (alla scheda del cliente già collegato
 * o a un cliente nuovo, collegato all'account di chi ha prenotato).
 */
function sezioneRegistra(p: Prenotazione, cliente: ClienteCollegato): string {
  if (p.stato === 'RIFIUTATA' || p.stato === 'ANNULLATA') return '';
  return `
    <section class="tc-azione" aria-labelledby="tc-registra">
      <h2 id="tc-registra" class="tc-etichetta">Nella tua officina</h2>
      <p class="text-body-secondary mb-0">
        ${
          cliente
            ? `${esc(nomeCliente(p, cliente))} è già tra i tuoi clienti, ma questo veicolo non è ancora registrato.`
            : `${esc(nomeCliente(p, cliente))} non è ancora tra i tuoi clienti. Aggiungi cliente e veicolo
              per segnare pneumatici e controlli: li vedrà nel suo garage su TyreCare.`
        }
      </p>
      <button type="button" class="btn btn-outline-light btn-lg w-100" data-registra>
        ${icona(UserPlus)} ${cliente ? 'Aggiungi il veicolo' : 'Aggiungi cliente e veicolo'}
      </button>
    </section>`;
}

function collegaRegistra(app: HTMLElement, p: Prenotazione, cliente: ClienteCollegato): void {
  const pulsante = app.querySelector<HTMLButtonElement>('[data-registra]');
  if (!pulsante) return;
  const nome = nomeCliente(p, cliente);
  pulsante.addEventListener('click', () =>
    chiediConferma({
      titolo: cliente ? 'Aggiungere il veicolo?' : 'Aggiungere cliente e veicolo?',
      testo: cliente
        ? `${formattaTarga(p.targa)} va nella scheda di ${nome}, con i dati della richiesta.`
        : `${nome} diventa tuo cliente con nome, telefono ed email del suo account, e ${formattaTarga(p.targa)} il suo veicolo. Vedrà nel suo garage i controlli che registrerai.`,
      pulsante: cliente ? 'Aggiungi il veicolo' : 'Aggiungi',
      iconaPulsante: UserPlus,
      inCorso: 'Salvataggio…',
      origine: pulsante,
      azione: async () => {
        const id = await registraClienteDaPrenotazione(p);
        vaiConConferma(
          `/veicolo?id=${id}`,
          `${cliente ? 'Veicolo aggiunto' : 'Cliente e veicolo aggiunti'}. Controlla i dati e monta gli pneumatici.`,
        );
      },
    }),
  );
}

function azioniCliente(p: Prenotazione, oggi: string): string {
  const officina = p.officina.telefono
    ? `<a class="btn btn-outline-light btn-lg w-100" href="${esc(telefonoHref(p.officina.telefono))}">
        ${icona(Phone)} Chiama ${esc(p.officina.ragione_sociale)}</a>`
    : '';
  if (p.stato === 'PROPOSTA') {
    return `
      <div class="tc-avviso tc-avviso--giallo" role="status">
        ${icona(CalendarClock)}
        <p class="mb-0">L'officina ti propone questo orario. Va bene per te?</p>
      </div>
      <button type="button" class="btn btn-primary btn-lg w-100" data-accetta>
        ${icona(CalendarCheck)} Accetta il nuovo orario
      </button>
      <button type="button" class="btn btn-outline-light btn-lg w-100" data-rifiuta-proposta>
        Non va bene, annulla
      </button>
      ${officina}`;
  }
  const annullabile =
    p.stato === 'RICHIESTA' || (p.stato === 'CONFERMATA' && !passatoOOggi(p, oggi));
  return `
    ${officina}
    ${
      annullabile
        ? `<button type="button" class="btn btn-lg w-100 tc-pulsante-elimina" data-annulla>
            ${icona(Ban)} Annulla ${p.stato === 'RICHIESTA' ? 'la richiesta' : "l'appuntamento"}
          </button>`
        : ''
    }`;
}

function azioniOfficina(p: Prenotazione, oggi: string): string {
  const proponi = `<a class="btn btn-outline-light btn-lg w-100" href="/appuntamento/proponi?id=${p.id}">
      ${icona(CalendarClock)} ${p.stato === 'CONFERMATA' ? 'Sposta (proponi un altro orario)' : 'Proponi un altro orario'}</a>`;
  const rifiuta = `<a class="btn btn-lg w-100 tc-pulsante-elimina" href="/appuntamento/rifiuta?id=${p.id}">
      ${icona(CalendarX)} ${p.stato === 'CONFERMATA' ? "Annulla l'appuntamento" : 'Rifiuta la richiesta'}</a>`;

  if (p.stato === 'RICHIESTA') {
    return `
      <form class="tc-auth__modulo" novalidate data-conferma>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'ora',
          etichetta: `Ora, ${formattaGiornoTitolo(p.giorno).toLowerCase()}`,
          tipo: 'time',
          autocomplete: 'off',
          aiuto: `Il cliente ha chiesto ${p.fascia === 'MATTINA' ? 'la mattina' : 'il pomeriggio'}.`,
          attributi: 'step="300"',
        })}
        ${areaTesto({ nome: 'messaggio', etichetta: 'Messaggio per il cliente (facoltativo)', righe: 2 })}
        ${pulsanteInvio('Conferma appuntamento', 'Conferma…')}
      </form>
      ${proponi}
      ${rifiuta}`;
  }
  if (p.stato === 'PROPOSTA') {
    return `
      <div class="tc-avviso tc-avviso--giallo" role="status">
        ${icona(CalendarClock)}
        <p class="mb-0">Il cliente deve ancora accettare l'orario proposto.</p>
      </div>
      ${proponi}
      ${rifiuta}`;
  }
  if (p.stato === 'CONFERMATA') {
    return passatoOOggi(p, oggi)
      ? `
        <div class="tc-coppia-pulsanti">
          <button type="button" class="btn btn-primary btn-lg" data-esito="COMPLETATA">
            ${icona(CalendarCheck)} Completato
          </button>
          <button type="button" class="btn btn-outline-light btn-lg" data-esito="NON_PRESENTATO">
            ${icona(UserX)} Non presentato
          </button>
        </div>
        ${proponi}`
      : `${proponi}${rifiuta}`;
  }
  return '';
}

function collegaAzioni(app: HTMLElement, p: Prenotazione): void {
  const errore = app.querySelector<HTMLElement>('[data-errore-azione]')!;
  const esegui = async (pulsante: HTMLButtonElement, azione: () => Promise<void>, ok: string) => {
    pulsante.disabled = true;
    errore.hidden = true;
    try {
      await azione();
      vaiConConferma(`/appuntamento?id=${p.id}`, ok, { sostituisci: true });
    } catch (e) {
      pulsante.disabled = false;
      errore.innerHTML = `<p class="mb-0">${esc(
        e instanceof ErroreModulo ? e.message : messaggioErrore(e),
      )}</p>`;
      errore.hidden = false;
      errore.focus();
    }
  };

  // Officina: conferma con l'ora nel giorno chiesto
  const modulo = app.querySelector<HTMLFormElement>('form[data-conferma]');
  if (modulo) {
    collegaModulo(modulo, ConfermaPrenotazioneSchema, async ({ ora, messaggio }) => {
      await rispondiPrenotazione(p.id, 'CONFERMA', {
        appuntamento: istanteItaliano(p.giorno, ora),
        messaggio,
      });
      vaiConConferma(`/appuntamento?id=${p.id}`, 'Appuntamento confermato.', { sostituisci: true });
    });
  }

  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-esito]')) {
    const esito = b.dataset.esito as 'COMPLETATA' | 'NON_PRESENTATO';
    b.addEventListener('click', () =>
      esegui(b, () => rispondiPrenotazione(p.id, esito), 'Appuntamento chiuso.'),
    );
  }

  const accetta = app.querySelector<HTMLButtonElement>('[data-accetta]');
  accetta?.addEventListener('click', () =>
    esegui(accetta, () => rispondiProposta(p.id, true), 'Appuntamento confermato.'),
  );

  const rifiutaProposta = app.querySelector<HTMLButtonElement>('[data-rifiuta-proposta]');
  rifiutaProposta?.addEventListener('click', () =>
    chiediConferma({
      titolo: "Annullare l'appuntamento?",
      testo:
        "L'officina vedrà che l'orario proposto non ti va bene. Potrai chiedere un altro appuntamento.",
      pulsante: 'Sì, annulla',
      iconaPulsante: Ban,
      inCorso: 'Annullamento…',
      origine: rifiutaProposta,
      azione: async () => {
        await rispondiProposta(p.id, false);
        vaiConConferma(`/appuntamento?id=${p.id}`, 'Appuntamento annullato.', {
          sostituisci: true,
        });
      },
    }),
  );

  const annulla = app.querySelector<HTMLButtonElement>('[data-annulla]');
  annulla?.addEventListener('click', () =>
    chiediConferma({
      titolo: p.stato === 'RICHIESTA' ? 'Annullare la richiesta?' : "Annullare l'appuntamento?",
      testo: `${p.officina.ragione_sociale} vedrà che non vieni più. Potrai chiedere un altro appuntamento quando vuoi.`,
      pulsante: 'Sì, annulla',
      iconaPulsante: Ban,
      inCorso: 'Annullamento…',
      origine: annulla,
      azione: async () => {
        await annullaPrenotazione(p.id);
        vaiConConferma(`/appuntamento?id=${p.id}`, 'Appuntamento annullato.', {
          sostituisci: true,
        });
      },
    }),
  );
}

// ---------------------------------------------------------------------------------------------------
// Officina: proponi un altro orario, rifiuta o annulla
// ---------------------------------------------------------------------------------------------------

/** Carica la prenotazione per una pagina dell'officina; `null` (non trovata) se non è dell'officina. */
async function perOfficina(app: HTMLElement, n: number): Promise<Prenotazione | null | undefined> {
  try {
    const trovato = await caricaConRuolo(parametro('id'));
    if (!ancoraAttuale(n)) return undefined;
    return trovato?.perOfficina ? trovato.p : null;
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return undefined;
  }
}

export async function mostraProponi(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const p = await perOfficina(app, n);
  if (p === undefined) return;
  if (!p || !['RICHIESTA', 'PROPOSTA', 'CONFERMATA'].includes(p.stato)) {
    app.innerHTML = paginaApp(appuntamentoNonTrovato());
    return;
  }

  const oggi = oggiInItalia();
  const attuale = p.appuntamento ? inItalia(p.appuntamento) : null;
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Proponi un altro orario', p.nome_cliente || 'Appuntamento')}
    <div class="tc-contenuto">
      <p class="text-body-secondary mb-0">
        Il cliente vede la proposta nell'app e la accetta o la rifiuta. Finché non risponde,
        l'appuntamento resta in attesa.
      </p>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        <div class="tc-auth__coppia">
          ${campo({
            nome: 'giorno',
            etichetta: 'Giorno',
            tipo: 'date',
            autocomplete: 'off',
            valore: attuale?.data ?? p.giorno,
            attributi: `min="${oggi}" max="${aggiungiGiorni(oggi, 60)}"`,
          })}
          ${campo({
            nome: 'ora',
            etichetta: 'Ora',
            tipo: 'time',
            autocomplete: 'off',
            valore: attuale?.ora ?? '',
            attributi: 'step="300"',
          })}
        </div>
        ${areaTesto({
          nome: 'messaggio',
          etichetta: 'Messaggio per il cliente (facoltativo)',
          righe: 2,
          aiuto: 'Es. "Il mattino siamo al completo".',
        })}
        ${pulsanteInvio('Invia la proposta', 'Invio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/appuntamento?id=${p.id}">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, creaPropostaSchema(oggi), async (d) => {
    await rispondiPrenotazione(p.id, 'PROPONI', {
      appuntamento: istanteItaliano(d.giorno, d.ora),
      messaggio: d.messaggio,
    });
    vaiConConferma(`/appuntamento?id=${p.id}`, 'Proposta inviata al cliente.');
  });
}

export async function mostraRifiuta(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const p = await perOfficina(app, n);
  if (p === undefined) return;
  if (!p || !['RICHIESTA', 'PROPOSTA', 'CONFERMATA'].includes(p.stato)) {
    app.innerHTML = paginaApp(appuntamentoNonTrovato());
    return;
  }

  const confermato = p.stato === 'CONFERMATA';
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina(confermato ? "Annulla l'appuntamento" : 'Rifiuta la richiesta', p.nome_cliente || 'Appuntamento')}
    <div class="tc-contenuto">
      <p class="mb-0">${esc(quando(p))} · ${esc(p.servizio)}</p>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${areaTesto({
          nome: 'messaggio',
          etichetta: 'Motivo per il cliente (facoltativo)',
          righe: 3,
          aiuto: 'Il cliente lo legge nell\'app. Es. "Quel giorno siamo chiusi per ferie".',
        })}
        <button type="submit" class="btn btn-lg w-100 tc-pulsante-elimina"
          data-testo="${confermato ? "Annulla l'appuntamento" : 'Rifiuta la richiesta'}"
          data-testo-in-corso="Invio…">
          ${confermato ? "Annulla l'appuntamento" : 'Rifiuta la richiesta'}
        </button>
        <a class="btn btn-outline-light btn-lg w-100" href="/appuntamento?id=${p.id}">Torna indietro</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, RifiutoPrenotazioneSchema, async ({ messaggio }) => {
    await rispondiPrenotazione(p.id, 'RIFIUTA', { messaggio });
    vaiConConferma(
      `/appuntamento?id=${p.id}`,
      confermato ? 'Appuntamento annullato.' : 'Richiesta rifiutata.',
    );
  });
}
