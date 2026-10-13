import { CalendarPlus } from 'lucide';
import { statoPeggiore, type StatoSalute } from '@tyrecare/shared';
import { esc } from '../lib/html';
import type { Misura } from '../lib/officina';
import { ORDINE_POSIZIONI, POSIZIONI, formattaDecimale } from '../pagine/comune';
import { statoMisura } from './cruscotto';
import { icona } from './icone';
import { STATI } from './stato';

// Avviso per il cliente sull'esito di un controllo (scheda del garage e report del controllo).

const TESTI: Record<StatoSalute, (uno: boolean) => string> = {
  ROSSO: (uno) => `${uno ? 'è da sostituire' : 'sono da sostituire'}: il battistrada è troppo basso
    per viaggiare sicuri. Contatta la tua officina il prima possibile.`,
  GIALLO: (uno) => `${uno ? 'si sta consumando' : 'si stanno consumando'}: chiedi alla tua officina
    quando conviene ${uno ? 'sostituirlo' : 'sostituirli'}.`,
  VERDE: () => '',
};

/**
 * Se il controllo ha trovato pneumatici da sostituire o da controllare, un avviso che dice quali (dal
 * più grave) e cosa fare. Con `ancheVerde` (report) avvisa anche quando va tutto bene. Con `prenota`
 * (indirizzo del modulo, garage) sotto un avviso rosso o giallo c'è anche "Prenota". Il colore non
 * basta: c'è l'icona e il testo dice lo stato.
 */
export function avvisoPneumatici(
  misure: Misura[],
  { ancheVerde = false, prenota }: { ancheVerde?: boolean; prenota?: string | undefined } = {},
): string {
  const stato = statoPeggiore(misure.map(statoMisura));
  if (!stato || (stato === 'VERDE' && !ancheVerde)) return '';

  const s = STATI[stato];
  let testo = 'Tutti gli pneumatici misurati sono in buono stato.';
  if (stato !== 'VERDE') {
    const peggiori = misure
      .filter((m) => statoMisura(m) === stato)
      .sort(
        (a, b) =>
          ORDINE_POSIZIONI.indexOf(a.pneumatico.posizione) -
          ORDINE_POSIZIONI.indexOf(b.pneumatico.posizione),
      );
    const elenco = peggiori
      .map(
        (m) =>
          `<strong>${POSIZIONI[m.pneumatico.posizione].nome}</strong> (${formattaDecimale(m.battistrada_mm)} mm)`,
      )
      .join(', ');
    testo = `${elenco} ${TESTI[stato](peggiori.length === 1)}`;
  }
  return `
    <section class="tc-azione" aria-label="Intervento consigliato">
      <div class="tc-avviso tc-avviso--${s.classe}" role="status">
        ${icona(s.icona)}
        <p class="mb-0">${testo}</p>
      </div>
      ${
        prenota && stato !== 'VERDE'
          ? `<a class="btn btn-primary btn-lg w-100" href="${esc(prenota)}">
              ${icona(CalendarPlus)} ${stato === 'ROSSO' ? 'Prenota la sostituzione' : 'Prenota un controllo'}
            </a>`
          : ''
      }
    </section>`;
}
