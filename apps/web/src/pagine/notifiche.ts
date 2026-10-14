import {
  Ban,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  type IconNode,
} from 'lucide';
import type { Enums } from '@tyrecare/shared';
import { esc } from '../lib/html';
import { caricaNotifiche, segnaLette, tempoTrascorso, type Notifica } from '../lib/notifiche';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// Notifiche (Fase 5): le ultime ricevute, le nuove evidenziate. Aprendo la pagina si considerano
// lette (il badge nella navigazione si azzera), ma restano evidenziate finché non si cambia pagina.

const ICONE: Record<Enums<'tipo_notifica'>, IconNode> = {
  NUOVA_RICHIESTA: CalendarPlus,
  CONFERMATA: CalendarCheck,
  PROPOSTA: CalendarClock,
  RIFIUTATA: CalendarX,
  PROPOSTA_ACCETTATA: CalendarCheck,
  ANNULLATA: Ban,
};

function rigaNotifica(n: Notifica): string {
  const nuova = n.letta_il === null;
  return `
    <a class="tc-lista__riga tc-notifica${nuova ? ' tc-notifica--nuova' : ''}" href="${esc(n.link)}">
      <span class="tc-lista__icona">${icona(ICONE[n.tipo])}</span>
      <span class="tc-lista__testo">
        <span class="tc-notifica__titolo">${
          nuova ? '<span class="visually-hidden">Nuova: </span>' : ''
        }${esc(n.titolo)}</span>
        <span class="tc-notifica__testo">${esc(n.testo)}</span>
        <small><time datetime="${esc(n.created_at)}">${esc(tempoTrascorso(n.created_at))}</time></small>
      </span>
    </a>`;
}

function nessunaNotifica(): string {
  return `
    <div class="tc-vuoto">
      <span class="tc-vuoto__icona">${icona(Bell)}</span>
      <p class="tc-vuoto__titolo">Nessuna notifica</p>
      <p class="tc-vuoto__testo">
        Qui trovi le novità sui tuoi appuntamenti: richieste, conferme, cambi di orario.
      </p>
    </div>`;
}

export async function mostraNotifiche(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let notifiche: Notifica[];
  try {
    // I dati dell'utente decidono le voci della navigazione (officina o cliente)
    [notifiche] = await Promise.all([caricaNotifiche(), caricaDatiUtente()]);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Notifiche', 'Le tue')}
    <div class="tc-contenuto">
      ${
        notifiche.length
          ? `<div class="tc-lista">${notifiche.map(rigaNotifica).join('')}</div>`
          : nessunaNotifica()
      }
    </div>`);

  // Viste: il badge si azzera. Se non riesce (rete) resteranno da leggere, nessun danno
  if (notifiche.some((x) => x.letta_il === null)) segnaLette().catch(() => undefined);
}
