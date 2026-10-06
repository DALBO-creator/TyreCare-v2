import {
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarDays,
  Car,
  ChevronRight,
  Gauge,
  History,
  House,
  MapPin,
  Phone,
  Snowflake,
  UserRound,
  type IconNode,
} from 'lucide';
import { SOGLIE_BATTISTRADA_MM, statoBattistrada, type StatoSalute } from '@tyrecare/shared';
import { autoDallAlto } from './ui/auto';
import { icona } from './ui/icone';
import { indicatoreBattistrada } from './ui/indicatore';
import { STATI, badgeStato } from './ui/stato';

// --- Dati finti per l'anteprima -------------------------------------------------------------
const STAGIONE = 'INVERNALE' as const;
const RUOTE = {
  as: { posizione: 'Anteriore sinistro', sigla: 'Ant. SX', mm: 6.2 },
  ad: { posizione: 'Anteriore destro', sigla: 'Ant. DX', mm: 3.4 },
  ps: { posizione: 'Posteriore sinistro', sigla: 'Post. SX', mm: 1.4 },
  pd: { posizione: 'Posteriore destro', sigla: 'Post. DX', mm: 5.8 },
};
type Ruota = keyof typeof RUOTE;

const stato = (r: Ruota): StatoSalute => statoBattistrada(RUOTE[r].mm, STAGIONE);
const indicatore = (r: Ruota): string => indicatoreBattistrada({ ...RUOTE[r], stato: stato(r) });

function riga(ic: IconNode, etichetta: string, valore: string): string {
  return `
    <a class="tc-lista__riga" href="#">
      <span class="tc-lista__icona">${icona(ic)}</span>
      <span class="tc-lista__testo">${etichetta}<small>${valore}</small></span>
      ${icona(ChevronRight)}
    </a>`;
}

const VOCI_NAV = [
  { etichetta: 'Home', icona: House, attiva: true },
  { etichetta: 'Garage', icona: Car, attiva: false },
  { etichetta: 'Prenota', icona: CalendarDays, attiva: false },
  { etichetta: 'Storico', icona: History, attiva: false },
  { etichetta: 'Profilo', icona: UserRound, attiva: false },
];

/**
 * Pagina di anteprima del design system (Fase 1): la home del cliente con dati finti.
 * Verrà sostituita dalle schermate reali.
 */
export function mostraAnteprima(app: HTMLElement): void {
  const stati: StatoSalute[] = ['VERDE', 'GIALLO', 'ROSSO'];
  const soglia = SOGLIE_BATTISTRADA_MM.consigliato[STAGIONE];
  const critiche = (Object.keys(RUOTE) as Ruota[]).filter((r) => stato(r) === 'ROSSO');

  app.innerHTML = `
    <header class="tc-appbar">
      <span class="tc-marchio">Tyre<span>Care</span></span>
      <button type="button" class="tc-appbar__azione ms-auto" aria-label="Notifiche, 1 nuova">
        ${icona(Bell)}<span class="tc-punto" aria-hidden="true"></span>
      </button>
    </header>

    <main class="tc-pagina tc-con-bottomnav">
      <section class="tc-hero" aria-labelledby="tc-veicolo">
        <p class="tc-etichetta">Fiat</p>
        <h1 id="tc-veicolo" class="tc-hero__modello">Panda</h1>
        <p class="tc-hero__dettagli">
          <span class="tc-targa">AB 123 CD</span>
          <span>${icona(Snowflake)} Gomme invernali</span>
        </p>

        <div class="tc-cruscotto" aria-label="Stato degli pneumatici" role="group">
          <div class="tc-cruscotto__as">${indicatore('as')}</div>
          <div class="tc-cruscotto__veicolo">${autoDallAlto({
            as: stato('as'),
            ad: stato('ad'),
            ps: stato('ps'),
            pd: stato('pd'),
          })}</div>
          <div class="tc-cruscotto__ad">${indicatore('ad')}</div>
          <div class="tc-cruscotto__ps">${indicatore('ps')}</div>
          <div class="tc-cruscotto__pd">${indicatore('pd')}</div>
        </div>
      </section>

      <div class="tc-contenuto">
        ${
          critiche.length > 0
            ? `<section class="tc-azione" aria-label="Intervento consigliato">
                <div class="tc-avviso tc-avviso--rosso" role="alert">
                  ${icona(STATI.ROSSO.icona)}
                  <p class="mb-0">
                    <strong>${RUOTE[critiche[0]!].posizione}</strong> sotto il limite di legge di
                    ${SOGLIE_BATTISTRADA_MM.limiteLegale.toLocaleString('it-IT')} mm.
                    Sostituiscilo il prima possibile.
                  </p>
                </div>
                <button type="button" class="btn btn-primary btn-lg w-100">
                  Prenota la sostituzione ${icona(ArrowRight)}
                </button>
              </section>`
            : ''
        }

        <section aria-labelledby="tc-panoramica">
          <h2 id="tc-panoramica" class="tc-etichetta">Panoramica</h2>
          <nav class="tc-lista">
            ${riga(Gauge, 'Pressione', '2,3 bar · nella norma')}
            ${riga(CalendarClock, 'Età degli pneumatici', '3 anni · DOT 3823')}
            ${riga(History, 'Ultimo controllo', '14 settembre 2026 · 41.250 km')}
            ${riga(CalendarDays, 'Prossimo controllo consigliato', 'Dicembre 2026')}
          </nav>
        </section>

        <section aria-labelledby="tc-officina">
          <h2 id="tc-officina" class="tc-etichetta">La tua officina</h2>
          <article class="tc-officina">
            <h3 class="tc-officina__nome">Gomme Rossi</h3>
            <p class="tc-officina__indirizzo">${icona(MapPin)} Via Emilia 112, Modena · Aperto fino alle 19</p>
            <div class="tc-officina__azioni">
              <a class="btn btn-outline-light" href="#">${icona(Phone)} Chiama</a>
              <a class="btn btn-outline-light" href="#">${icona(MapPin)} Indicazioni</a>
            </div>
          </article>
        </section>

        <section aria-labelledby="tc-componenti" class="tc-componenti">
          <h2 id="tc-componenti" class="tc-etichetta">Altri componenti</h2>
          <p class="d-flex flex-wrap gap-2">${stati.map((s) => badgeStato(s)).join('')}</p>
          <p class="text-body-secondary small">
            Gomme invernali: verde da ${soglia} mm, giallo tra 1,6 e ${soglia} mm, rosso sotto 1,6 mm.
          </p>
          <form class="tc-modulo" novalidate>
            <div class="mb-3">
              <label class="form-label" for="demo-targa">Targa</label>
              <input class="form-control" id="demo-targa" autocomplete="off" placeholder="AB 123 CD"
                aria-describedby="demo-targa-aiuto" />
              <div id="demo-targa-aiuto" class="form-text">La trovi sul libretto di circolazione.</div>
            </div>
            <div class="mb-4">
              <label class="form-label" for="demo-servizio">Servizio</label>
              <select class="form-select" id="demo-servizio">
                <option>Cambio gomme stagionale</option>
                <option>Controllo pressione e usura</option>
                <option>Equilibratura e convergenza</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary w-100">Invia richiesta</button>
          </form>
        </section>
      </div>
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
