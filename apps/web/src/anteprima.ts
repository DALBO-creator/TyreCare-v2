import { Bell, CalendarDays, Car, History, House, UserRound } from 'lucide';
import {
  SOGLIE_BATTISTRADA_MM,
  statoBattistrada,
  type Stagione,
  type StatoSalute,
} from '@tyrecare/shared';
import { icona } from './ui/icone';
import { STATI, badgeStato } from './ui/stato';

/** Profondità di uno pneumatico nuovo (mm), usata come 100% del misuratore. */
const BATTISTRADA_NUOVO_MM = 8;

interface PneumaticoDemo {
  posizione: string;
  mm: number;
  stagione: Stagione;
}

const DEMO: PneumaticoDemo[] = [
  { posizione: 'Anteriore sinistro', mm: 6.2, stagione: 'INVERNALE' },
  { posizione: 'Anteriore destro', mm: 3.4, stagione: 'INVERNALE' },
  { posizione: 'Posteriore sinistro', mm: 1.4, stagione: 'INVERNALE' },
  { posizione: 'Posteriore destro', mm: 5.8, stagione: 'INVERNALE' },
];

function schedaPneumatico(p: PneumaticoDemo): string {
  const stato = statoBattistrada(p.mm, p.stagione);
  const livello = Math.min(100, Math.round((p.mm / BATTISTRADA_NUOVO_MM) * 100));
  const mm = p.mm.toLocaleString('it-IT', { minimumFractionDigits: 1 });
  return `
    <article class="tc-pneumatico">
      <div class="tc-pneumatico__intestazione">
        <h3 class="tc-pneumatico__posizione">${p.posizione}</h3>
        ${badgeStato(stato)}
      </div>
      <div>
        <span class="tc-pneumatico__valore">${mm}</span><span class="tc-pneumatico__unita">mm</span>
      </div>
      <div class="tc-battistrada tc-battistrada--${STATI[stato].classe}" role="meter"
        aria-label="Battistrada ${p.posizione}" aria-valuemin="0" aria-valuemax="${BATTISTRADA_NUOVO_MM}"
        aria-valuenow="${p.mm}" aria-valuetext="${mm} millimetri, ${STATI[stato].etichetta.toLowerCase()}">
        <div class="tc-battistrada__livello" style="width: ${livello}%"></div>
      </div>
    </article>`;
}

const VOCI_NAV = [
  { etichetta: 'Home', icona: House, attiva: true },
  { etichetta: 'Garage', icona: Car, attiva: false },
  { etichetta: 'Prenota', icona: CalendarDays, attiva: false },
  { etichetta: 'Storico', icona: History, attiva: false },
  { etichetta: 'Profilo', icona: UserRound, attiva: false },
];

/**
 * Pagina di anteprima del design system (Fase 1): mostra token e componenti con dati finti.
 * Verrà sostituita dalle schermate reali.
 */
export function mostraAnteprima(app: HTMLElement): void {
  const stati: StatoSalute[] = ['VERDE', 'GIALLO', 'ROSSO'];
  const soglia = SOGLIE_BATTISTRADA_MM.consigliato.INVERNALE;

  app.innerHTML = `
    <header class="tc-appbar">
      <h1 class="tc-appbar__titolo">TyreCare</h1>
      <button type="button" class="btn btn-link ms-auto p-2 text-reset" aria-label="Notifiche">
        ${icona(Bell)}
      </button>
    </header>

    <main class="container py-4 tc-con-bottomnav">
      <p class="text-body-secondary small mb-1">Anteprima design system</p>
      <h2 class="h3 mb-1">Fiat Panda · AB 123 CD</h2>
      <p class="text-body-secondary">Ultimo controllo il 14 settembre 2026 · Gomme invernali</p>

      <div class="alert alert-danger d-flex gap-2 align-items-start" role="alert">
        <span>Uno pneumatico è <strong>sotto il limite di legge</strong> (1,6 mm). Prenota la sostituzione.</span>
      </div>

      <section class="row g-3 mb-4" aria-label="Stato degli pneumatici">
        ${DEMO.map((p) => `<div class="col-12 col-sm-6">${schedaPneumatico(p)}</div>`).join('')}
      </section>

      <div class="d-grid gap-2 d-sm-flex mb-5">
        <button type="button" class="btn btn-primary">${icona(CalendarDays)} Prenota un controllo</button>
        <button type="button" class="btn btn-outline-secondary">Vedi lo storico</button>
      </div>

      <h2 class="h5">Stati</h2>
      <p class="d-flex flex-wrap gap-2">${stati.map(badgeStato).join('')}</p>
      <p class="text-body-secondary small">
        Gomme invernali: verde da ${soglia} mm, giallo tra 1,6 e ${soglia} mm, rosso sotto 1,6 mm.
      </p>

      <h2 class="h5 mt-4">Modulo</h2>
      <form class="card card-body mb-4" novalidate>
        <div class="mb-3">
          <label class="form-label" for="demo-targa">Targa</label>
          <input class="form-control" id="demo-targa" autocomplete="off" placeholder="AB 123 CD"
            aria-describedby="demo-targa-aiuto" />
          <div id="demo-targa-aiuto" class="form-text">La trovi sul libretto di circolazione.</div>
        </div>
        <div class="mb-3">
          <label class="form-label" for="demo-servizio">Servizio</label>
          <select class="form-select" id="demo-servizio">
            <option>Cambio gomme stagionale</option>
            <option>Controllo pressione e usura</option>
            <option>Equilibratura e convergenza</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Invia richiesta</button>
      </form>
    </main>

    <nav class="tc-bottomnav" aria-label="Navigazione principale">
      ${VOCI_NAV.map(
        (v) => `
        <a class="tc-bottomnav__voce" href="#"${v.attiva ? ' aria-current="page"' : ''}>
          ${icona(v.icona)}<span>${v.etichetta}</span>
        </a>`,
      ).join('')}
    </nav>
  `;

  app.querySelector('form')?.addEventListener('submit', (e) => e.preventDefault());
}
