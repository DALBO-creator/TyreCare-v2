import { SOGLIE_BATTISTRADA_MM, type StatoSalute } from '@tyrecare/shared';
import { icona } from './icone';
import { STATI } from './stato';

/** Profondità di uno pneumatico nuovo (mm): fondo scala dell'indicatore. */
export const BATTISTRADA_NUOVO_MM = 8;

// Geometria dell'arco: 270° (come un contagiri), apertura in basso
const R = 42;
const CIRC = 2 * Math.PI * R;
const ARCO = CIRC * 0.75;
const INIZIO_GRADI = 135;

/** Coordinate di un punto sulla circonferenza di raggio `r` a una frazione `f` (0–1) dell'arco. */
function punto(f: number, r: number): [number, number] {
  const rad = ((INIZIO_GRADI + 270 * f) * Math.PI) / 180;
  return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)];
}

/** Una tacca per ogni millimetro; quella del limite di legge (1,6 mm) è evidenziata. */
function tacche(): string {
  const linee: string[] = [];
  for (let mm = 0; mm <= BATTISTRADA_NUOVO_MM; mm++) {
    const [x1, y1] = punto(mm / BATTISTRADA_NUOVO_MM, 49);
    const [x2, y2] = punto(mm / BATTISTRADA_NUOVO_MM, 46);
    linee.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
  }
  const limite = SOGLIE_BATTISTRADA_MM.limiteLegale / BATTISTRADA_NUOVO_MM;
  const [lx1, ly1] = punto(limite, 50);
  const [lx2, ly2] = punto(limite, 45);
  return `<g class="tc-indicatore__tacche">${linee.join('')}</g>
    <line class="tc-indicatore__limite" x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" />`;
}

interface Opzioni {
  /** Posizione per esteso, letta dai lettori di schermo (es. "Anteriore sinistro"). */
  posizione: string;
  /** Posizione abbreviata mostrata a video (es. "Ant. SX"). */
  sigla: string;
  mm: number;
  stato: StatoSalute;
}

/**
 * Indicatore circolare del battistrada, in stile contagiri: arco colorato secondo lo stato,
 * valore in mm al centro, sotto la posizione e lo stato con icona e testo.
 */
export function indicatoreBattistrada({ posizione, sigla, mm, stato }: Opzioni): string {
  const s = STATI[stato];
  const frazione = Math.min(1, mm / BATTISTRADA_NUOVO_MM);
  const valore = mm.toLocaleString('it-IT', { minimumFractionDigits: 1 });

  return `
  <figure class="tc-indicatore tc-indicatore--${s.classe}" role="meter"
    aria-label="Battistrada ${posizione}" aria-valuemin="0" aria-valuemax="${BATTISTRADA_NUOVO_MM}"
    aria-valuenow="${mm}" aria-valuetext="${valore} millimetri, ${s.etichetta.toLowerCase()}">
    <div class="tc-indicatore__quadrante">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        ${tacche()}
        <circle class="tc-indicatore__binario" cx="50" cy="50" r="${R}"
          stroke-dasharray="${ARCO} ${CIRC}" transform="rotate(${INIZIO_GRADI} 50 50)" />
        <circle class="tc-indicatore__arco" cx="50" cy="50" r="${R}"
          stroke-dasharray="${ARCO * frazione} ${CIRC}" transform="rotate(${INIZIO_GRADI} 50 50)" />
      </svg>
      <div class="tc-indicatore__valore" aria-hidden="true">${valore}<small>mm</small></div>
    </div>
    <figcaption aria-hidden="true">
      <span class="tc-indicatore__sigla">${sigla}</span>
      <span class="tc-indicatore__stato">${icona(s.icona)}${s.etichetta}</span>
    </figcaption>
  </figure>`;
}
