import { CalendarDays, House, Store, UserRound, Users, type IconNode } from 'lucide';
import { esc } from '../lib/html';
import { lavoraInOfficina } from '../lib/profilo';
import { icona } from './icone';

const MARCHIO = '<span class="tc-marchio">Tyre<span>Care</span></span>';

interface PaginaAuth {
  titolo: string;
  sottotitolo?: string;
  /** HTML del contenuto (di solito il modulo). */
  corpo: string;
  /** HTML sotto il modulo (es. "Non hai un account? Registrati"). */
  piede?: string;
}

/** Layout delle pagine di accesso: marchio, titolo grande e sottile, modulo al centro. */
export function paginaAuth({ titolo, sottotitolo, corpo, piede }: PaginaAuth): string {
  return `
    <main class="tc-auth">
      <a class="tc-auth__marchio" href="/" aria-label="TyreCare, home">${MARCHIO}</a>
      <div class="tc-auth__contenuto">
        <h1 class="tc-auth__titolo" tabindex="-1">${esc(titolo)}</h1>
        ${sottotitolo ? `<p class="tc-auth__sottotitolo">${esc(sottotitolo)}</p>` : ''}
        ${corpo}
        ${piede ? `<p class="tc-auth__piede">${piede}</p>` : ''}
      </div>
    </main>`;
}

interface VoceNav {
  percorso: string;
  etichetta: string;
  icona: IconNode;
  /** Altre pagine in cui la voce resta evidenziata (es. la scheda `/cliente` per "Clienti"). */
  anche?: string[];
  soloOfficina?: boolean;
  /** Solo per chi non lavora in un'officina (es. "Officine", per prenotare). */
  soloCliente?: boolean;
}

const VOCI_NAV: VoceNav[] = [
  { percorso: '/', etichetta: 'Home', icona: House, anche: ['/garage'] },
  {
    percorso: '/clienti',
    etichetta: 'Clienti',
    icona: Users,
    anche: ['/cliente'],
    soloOfficina: true,
  },
  {
    percorso: '/officine',
    etichetta: 'Officine',
    icona: Store,
    anche: ['/officina', '/prenota'],
    soloCliente: true,
  },
  {
    percorso: '/appuntamenti',
    etichetta: 'Appuntamenti',
    icona: CalendarDays,
    anche: ['/appuntamento', '/servizi'],
  },
  {
    percorso: '/profilo',
    etichetta: 'Profilo',
    icona: UserRound,
    anche: ['/officina/orari', '/officina/chiusura'],
  },
];

// La voce resta evidenziata anche nelle sottopagine (es. /profilo/password)
const attiva = ({ percorso, anche = [] }: VoceNav) =>
  [percorso, ...anche].some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );

/**
 * Impaginazione da computer (da 992 px, `_desktop.scss`): le pagine con elenchi o schede usano tutta
 * la larghezza e alcune si dividono in colonne; le altre (moduli) restano strette e leggibili.
 * Il valore finisce in `data-pagina` sul `<main>`: nessuna pagina deve saperlo.
 */
const IMPAGINAZIONE: Record<string, string> = {
  '/clienti': 'elenco',
  '/appuntamenti': 'elenco',
  '/officine': 'elenco',
  '/officina': 'elenco',
  '/servizi': 'elenco',
  '/cliente': 'cliente',
  '/veicolo': 'veicolo',
  '/garage/veicolo': 'veicolo',
  '/appuntamento': 'appuntamento',
  '/appuntamenti/calendario': 'calendario',
};

const impaginazione = (): string =>
  location.pathname === '/'
    ? lavoraInOfficina()
      ? 'home-officina'
      : 'home-cliente'
    : (IMPAGINAZIONE[location.pathname] ?? 'modulo');

let scorciatoieAttive = false;

/** Scorciatoie da tastiera, registrate una volta sola: comode soprattutto in officina, al computer. */
function attivaScorciatoie(): void {
  if (scorciatoieAttive) return;
  scorciatoieAttive = true;

  // "/" porta nel campo di ricerca della pagina (come in GitHub o Gmail), se non si sta già scrivendo
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const dove = evento.target as HTMLElement | null;
    if (dove?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const ricerca = document.querySelector<HTMLInputElement>('main input[type="search"]');
    if (!ricerca) return;
    evento.preventDefault();
    ricerca.focus();
  });

  // "Salta al contenuto": in fase di cattura, prima del router (che intercetta tutti i link interni)
  document.addEventListener(
    'click',
    (evento) => {
      if (!(evento.target as Element | null)?.closest('.tc-salta')) return;
      evento.preventDefault();
      document.getElementById('tc-principale')?.focus();
    },
    true,
  );
}

/**
 * Guscio delle pagine con login: barra superiore, contenuto, navigazione inferiore. Al computer la
 * navigazione diventa una barra laterale con il marchio e la barra superiore sparisce.
 */
export function paginaApp(corpo: string): string {
  attivaScorciatoie();
  return `
    <a class="tc-salta" href="#tc-principale">Salta al contenuto</a>
    <header class="tc-appbar">
      <a class="text-decoration-none" href="/" aria-label="TyreCare, home">${MARCHIO}</a>
    </header>
    <main id="tc-principale" class="tc-pagina tc-con-bottomnav" tabindex="-1"
      data-pagina="${impaginazione()}">${corpo}</main>
    <nav class="tc-bottomnav" aria-label="Navigazione principale">
      <span class="tc-bottomnav__marchio" aria-hidden="true">${MARCHIO}</span>
      ${VOCI_NAV.filter((v) => (lavoraInOfficina() ? !v.soloCliente : !v.soloOfficina))
        .map(
          (v) => `
        <a class="tc-bottomnav__voce" href="${v.percorso}"${
          attiva(v) ? ' aria-current="page"' : ''
        }>${icona(v.icona)}<span>${v.etichetta}</span></a>`,
        )
        .join('')}
    </nav>`;
}

/** Indicatore di caricamento accessibile (annunciato dai lettori di schermo). */
export function caricamento(testo = 'Caricamento…'): string {
  return `
    <div class="tc-caricamento" role="status">
      <span class="spinner-border" aria-hidden="true"></span>
      <span class="visually-hidden">${esc(testo)}</span>
    </div>`;
}
