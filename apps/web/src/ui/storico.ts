import { Pencil } from 'lucide';
import { statoPeggiore } from '@tyrecare/shared';
import { esc } from '../lib/html';
import type { Controllo, Misura } from '../lib/officina';
import {
  ETICHETTE_USURA,
  ORDINE_POSIZIONI,
  POSIZIONI,
  formattaData,
  formattaDecimale,
  formattaKm,
} from '../pagine/comune';
import { statoMisura } from './cruscotto';
import { icona } from './icone';
import { badgeStato } from './stato';

// Storico dei controlli di un veicolo: scheda dell'officina (con "Correggi o elimina") e garage del
// cliente (con l'officina che ha eseguito ogni controllo, senza correzioni).

/** Controllo nello storico; `officina` (garage del cliente) è chi l'ha eseguito. */
export type VoceStorico = Controllo & { officina?: string };

export function sezioneStorico(controlli: VoceStorico[], { correggi = false } = {}): string {
  return `
    <section aria-labelledby="tc-storico">
      <h2 id="tc-storico" class="tc-etichetta">Storico dei controlli</h2>
      ${
        controlli.length > 0
          ? `<div class="tc-storico">${controlli.map((c) => voceStorico(c, correggi)).join('')}</div>`
          : `<p class="text-body-secondary mb-0">Nessun controllo registrato.</p>`
      }
    </section>`;
}

/** Un controllo: riassunto sempre visibile, misure e note aprendo la voce. */
function voceStorico(c: VoceStorico, correggi: boolean): string {
  const misure = [...c.misure].sort(
    (a, b) =>
      ORDINE_POSIZIONI.indexOf(a.pneumatico.posizione) -
      ORDINE_POSIZIONI.indexOf(b.pneumatico.posizione),
  );
  const stato = statoPeggiore(misure.map(statoMisura));
  const dettagli = [c.km !== null ? formattaKm(c.km) : 'Km non indicati', c.officina ?? ''];
  return `
    <details class="tc-storico__voce">
      <summary class="tc-storico__riassunto">
        <span class="tc-lista__testo">
          ${formattaData(c.eseguito_il)}
          <small>${esc(dettagli.filter(Boolean).join(' · '))}</small>
        </span>
        ${stato ? badgeStato(stato) : ''}
      </summary>
      <div class="tc-storico__dettaglio">
        <ul class="tc-misure">
          ${misure.map(rigaMisura).join('')}
        </ul>
        ${c.note ? `<p class="tc-storico__note">${esc(c.note)}</p>` : ''}
        ${
          correggi
            ? `<a class="tc-storico__correggi" href="/controllo/modifica?id=${c.id}">
                ${icona(Pencil)} Correggi o elimina
              </a>`
            : ''
        }
      </div>
    </details>`;
}

function rigaMisura(m: Misura): string {
  const valori = [
    `${formattaDecimale(m.battistrada_mm)} mm`,
    m.pressione_bar !== null ? `${formattaDecimale(m.pressione_bar)} bar` : '',
    m.usura && m.usura !== 'REGOLARE' ? `usura ${ETICHETTE_USURA[m.usura].toLowerCase()}` : '',
    m.danni,
  ].filter(Boolean);
  return `
    <li class="tc-misure__riga">
      <span class="tc-lista__testo">
        ${POSIZIONI[m.pneumatico.posizione].nome}
        <small>${esc(valori.join(' · '))}</small>
      </span>
      ${badgeStato(statoMisura(m))}
    </li>`;
}
