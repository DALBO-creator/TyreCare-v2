/**
 * Router minimo basato sulla History API: URL puliti (`/accedi`, `/profilo`) senza dipendenze.
 * Ogni rotta dichiara chi può vederla; il router reindirizza chi non ha accesso.
 */

import { esc } from './html';

/** `pubblica`: tutti · `ospite`: solo senza login (accedi, registrati) · `utente`: solo con login. */
export type Accesso = 'pubblica' | 'ospite' | 'utente';

export interface Rotta {
  percorso: string;
  accesso: Accesso;
  /** Titolo della scheda del browser (si aggiunge " · TyreCare"). */
  titolo: string;
  mostra: (app: HTMLElement) => void | Promise<void>;
}

interface OpzioniRouter {
  rotte: Rotta[];
  nonTrovata: Rotta;
  /** Vero se c'è un utente autenticato. */
  autenticato: () => boolean;
}

let opzioni: OpzioniRouter | undefined;
let contenitore: HTMLElement | undefined;
let primaVisualizzazione = true;
// Contatore delle visualizzazioni: se una pagina asincrona finisce dopo un nuovo cambio di pagina,
// non deve sovrascriverla
let generazione = 0;

// Percorso della pagina lasciata con l'ultimo cambio di pagina (vuoto se non c'è stato)
let precedente = '';

/** Percorso della pagina da cui l'utente è arrivato in questa (vuoto se non c'è). */
export const paginaPrecedente = (): string => precedente;

export const PAGINA_ACCESSO = '/accedi';
export const PAGINA_INIZIALE = '/';

function rottaPer(percorso: string): Rotta {
  return opzioni?.rotte.find((r) => r.percorso === percorso) ?? opzioni!.nonTrovata;
}

/** La rotta della pagina mostrata ora. */
export function rottaCorrente(): Rotta {
  return rottaPer(location.pathname);
}

/** Vero se la visualizzazione `n` è ancora quella sullo schermo (per le pagine asincrone). */
export function ancoraAttuale(n: number): boolean {
  return n === generazione;
}

/** Numero della visualizzazione in corso: le pagine asincrone lo confrontano con `ancoraAttuale`. */
export function visualizzazioneCorrente(): number {
  return generazione;
}

/** Porta alla pagina indicata. `sostituisci` non aggiunge una voce alla cronologia (redirect). */
export function vaiA(destinazione: string, { sostituisci = false } = {}): void {
  if (sostituisci) history.replaceState(null, '', destinazione);
  else {
    precedente = location.pathname;
    history.pushState(null, '', destinazione);
  }
  void mostraPagina();
}

/** Riquadro mostrato quando una pagina non si carica; "Riprova" è un link all'URL attuale. */
export function riquadroPaginaNonDisponibile(url: string): string {
  return `
    <main class="tc-auth">
      <div class="tc-auth__contenuto">
        <h1 class="tc-auth__titolo" tabindex="-1">Pagina non disponibile</h1>
        <p class="tc-auth__sottotitolo">Pagina non disponibile: controlla la connessione e riprova.</p>
        <a class="btn btn-primary btn-lg w-100" href="${esc(url)}">Riprova</a>
      </div>
    </main>`;
}

/** Mostra la pagina dell'URL attuale, applicando le regole di accesso. */
export async function mostraPagina(): Promise<void> {
  if (!opzioni || !contenitore) return;
  const rotta = rottaCorrente();
  const autenticato = opzioni.autenticato();

  if (rotta.accesso === 'utente' && !autenticato) {
    // Dopo l'accesso si torna alla pagina richiesta
    const dopo = encodeURIComponent(location.pathname + location.search);
    return vaiA(`${PAGINA_ACCESSO}?dopo=${dopo}`, { sostituisci: true });
  }
  if (rotta.accesso === 'ospite' && autenticato) {
    return vaiA(destinazioneDopoAccesso(), { sostituisci: true });
  }

  generazione++;
  const n = generazione;
  document.title = rotta.titolo ? `${rotta.titolo} · TyreCare` : 'TyreCare';
  window.scrollTo(0, 0);
  try {
    await rotta.mostra(contenitore);
  } catch (err) {
    console.error(err);
    // Solo se nel frattempo non è partita un'altra navigazione
    if (ancoraAttuale(n)) {
      contenitore.innerHTML = riquadroPaginaNonDisponibile(location.pathname + location.search);
    }
  }

  // Per chi usa un lettore di schermo: dopo un cambio di pagina il focus va sul titolo, così la
  // nuova pagina viene annunciata (al primo caricamento no, il browser parte già dall'inizio)
  if (!primaVisualizzazione) contenitore.querySelector<HTMLElement>('h1')?.focus();
  primaVisualizzazione = false;
}

/** Pagina a cui andare dopo l'accesso: `?dopo=` se è un percorso interno, altrimenti la home. */
export function destinazioneDopoAccesso(): string {
  const dopo = new URLSearchParams(location.search).get('dopo');
  // Solo percorsi interni ("/…" ma non "//…", che porterebbe a un altro sito): evita redirect aperti
  return dopo && dopo.startsWith('/') && !dopo.startsWith('//') ? dopo : PAGINA_INIZIALE;
}

/** Avvia il router: intercetta i link interni e i pulsanti avanti/indietro del browser. */
export function avviaRouter(app: HTMLElement, opz: OpzioniRouter): Promise<void> {
  opzioni = opz;
  contenitore = app;

  document.addEventListener('click', (evento) => {
    const link = (evento.target as Element | null)?.closest('a');
    if (
      !link ||
      evento.defaultPrevented ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey ||
      link.target ||
      link.hasAttribute('download') ||
      link.origin !== location.origin
    ) {
      return;
    }
    evento.preventDefault();
    // Link alla pagina stessa (es. "Riprova"): la si ricarica senza aggiungerla alla cronologia
    if (link.pathname + link.search === location.pathname + location.search) void mostraPagina();
    else vaiA(link.pathname + link.search);
  });

  window.addEventListener('popstate', () => void mostraPagina());
  return mostraPagina();
}
