import { SOGLIE_BATTISTRADA_MM, statoBattistrada, type Stagione } from '@tyrecare/shared';
import type { PuntoMisura } from '../lib/salute';
import { formattaData, formattaDecimale } from '../pagine/comune';
import { BATTISTRADA_NUOVO_MM } from './indicatore';
import { STATI } from './stato';

// Andamento del battistrada di uno pneumatico: una sola serie (senza legenda della serie: la nomina il titolo
// della sezione), linea neutra di 2 px, punti del colore dello stato con anello della superficie,
// soglie tratteggiate spiegate nella legenda sotto (dentro il grafico le etichette si scontravano
// con i punti vicini alla soglia). I valori esatti sono nell'elenco delle misure sotto,
// che fa da tabella; ogni punto ha anche un <title> (suggerimento al passaggio o al tocco lungo).

const L = 340; // larghezza del viewBox
const A = 190; // altezza
const M = { su: 14, destra: 14, giu: 26, sinistra: 30 };

const MESE = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
const meseAnno = (iso: string) => MESE.format(new Date(`${iso}T12:00:00Z`));

/** Grafico SVG; vuoto con meno di due misure (con un punto solo non c'è andamento). */
export function graficoBattistrada(punti: PuntoMisura[], stagione: Stagione): string {
  if (punti.length < 2) return '';
  const t = punti.map((p) => Date.parse(`${p.data}T12:00:00Z`));
  const [t0, t1] = [Math.min(...t), Math.max(...t)];
  const max = Math.max(BATTISTRADA_NUOVO_MM, Math.ceil(Math.max(...punti.map((p) => p.mm))));
  const x = (ms: number) =>
    t1 === t0 ? L / 2 : M.sinistra + ((ms - t0) / (t1 - t0)) * (L - M.sinistra - M.destra);
  const y = (mm: number) => M.su + (1 - mm / max) * (A - M.su - M.giu);

  const griglia = Array.from({ length: max / 2 + 1 }, (_, i) => i * 2)
    .map(
      (mm) => `
      <line class="tc-grafico__griglia" x1="${M.sinistra}" x2="${L - M.destra}" y1="${y(mm)}" y2="${y(mm)}" />
      <text class="tc-grafico__asse" x="${M.sinistra - 6}" y="${y(mm) + 4}" text-anchor="end">${mm}</text>`,
    )
    .join('');

  const { limiteLegale, consigliato } = SOGLIE_BATTISTRADA_MM;
  const soglia = (mm: number, classe: string) => `
    <line class="tc-grafico__soglia tc-grafico__soglia--${classe}" x1="${M.sinistra}" x2="${L - M.destra}"
      y1="${y(mm)}" y2="${y(mm)}" />`;
  const voce = (classe: string, testo: string) =>
    `<span><span class="tc-grafico__campione tc-grafico__campione--${classe}"></span>${testo}</span>`;

  const linea = punti.map((p, i) => `${x(t[i]!)},${y(p.mm)}`).join(' ');
  const cerchi = punti
    .map((p, i) => {
      const s = STATI[statoBattistrada(p.mm, stagione)];
      return `
      <circle class="tc-grafico__punto tc-grafico__punto--${s.classe}" cx="${x(t[i]!)}" cy="${y(p.mm)}" r="5">
        <title>${formattaData(p.data)}: ${formattaDecimale(p.mm)} mm, ${s.etichetta.toLowerCase()}</title>
      </circle>`;
    })
    .join('');
  const ultimo = punti.at(-1)!;
  const xu = x(t.at(-1)!);

  return `
    <figure class="tc-grafico">
      <svg viewBox="0 0 ${L} ${A}" role="img"
        aria-label="Battistrada da ${formattaDecimale(punti[0]!.mm)} mm il ${formattaData(punti[0]!.data)} a ${formattaDecimale(ultimo.mm)} mm il ${formattaData(ultimo.data)}">
        ${griglia}
        ${soglia(consigliato[stagione], 'giallo')}
        ${soglia(limiteLegale, 'rosso')}
        <polyline class="tc-grafico__linea" points="${linea}" />
        ${cerchi}
        <text class="tc-grafico__valore" x="${xu}" y="${y(ultimo.mm) - 12}"
          text-anchor="${xu > L - 60 ? 'end' : 'middle'}">${formattaDecimale(ultimo.mm)} mm</text>
        <text class="tc-grafico__asse" x="${M.sinistra}" y="${A - 6}">${meseAnno(punti[0]!.data)}</text>
        <text class="tc-grafico__asse" x="${L - M.destra}" y="${A - 6}" text-anchor="end">${meseAnno(ultimo.data)}</text>
      </svg>
      <figcaption class="tc-grafico__legenda">
        ${voce('giallo', `${consigliato[stagione]} mm consigliati`)}
        ${voce('rosso', `${formattaDecimale(limiteLegale)} mm limite di legge`)}
      </figcaption>
    </figure>`;
}
