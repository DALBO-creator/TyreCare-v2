import {
  AlarmClock,
  Ban,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ClipboardCheck,
  Smartphone,
  ThermometerSnowflake,
  type IconNode,
} from 'lucide';
import type { Enums } from '@tyrecare/shared';
import { esc } from '../lib/html';
import { caricaNotifiche, segnaLette, tempoTrascorso, type Notifica } from '../lib/notifiche';
import { caricaDatiUtente } from '../lib/profilo';
import { attivaPush, disattivaPush, statoPush, type StatoPush } from '../lib/push';
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
  PROMEMORIA: AlarmClock,
  ESITO_CONTROLLO: ClipboardCheck,
  CAMBIO_STAGIONE: ThermometerSnowflake,
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

// Testo e pulsante della sezione "Avvisi sul telefono" per ogni stato delle push
const PUSH: Record<
  StatoPush,
  { testo: string; pulsante?: string; azione?: 'attiva' | 'disattiva' }
> = {
  spente: {
    testo: "Ricevi un avviso anche quando l'app è chiusa: richieste, conferme, cambi di orario.",
    pulsante: 'Avvisami su questo dispositivo',
    azione: 'attiva',
  },
  attive: {
    testo: 'Gli avvisi sono attivi su questo dispositivo.',
    pulsante: 'Disattiva gli avvisi',
    azione: 'disattiva',
  },
  bloccate: {
    testo:
      "Gli avvisi sono bloccati per TyreCare: riattivali dalle impostazioni del browser (icona accanto all'indirizzo).",
  },
  installa: {
    testo: `Su iPhone gli avvisi arrivano solo con l'app nella schermata Home: tocca Condividi, poi "Aggiungi alla schermata Home", e apri TyreCare da lì.`,
  },
  'non-supportate': { testo: 'Questo browser non riceve avvisi: le notifiche restano qui.' },
};

function sezionePush(stato: StatoPush, errore = ''): string {
  const p = PUSH[stato];
  return `
    <section class="tc-push" aria-labelledby="tc-push-titolo">
      <span class="tc-lista__icona">${icona(Smartphone)}</span>
      <div class="tc-push__testo">
        <h2 id="tc-push-titolo" class="tc-push__titolo">Avvisi sul telefono</h2>
        <p class="mb-0">${esc(p.testo)}</p>
        ${errore ? `<p class="tc-push__errore mb-0" role="alert">${esc(errore)}</p>` : ''}
        ${
          p.azione
            ? `<button type="button" class="btn ${
                p.azione === 'attiva' ? 'btn-primary' : 'btn-outline-light'
              } mt-3" data-push="${p.azione}">${esc(p.pulsante!)}</button>`
            : ''
        }
      </div>
    </section>`;
}

/** Disegna la sezione delle push e collega il pulsante (dopo un tocco si chiede il permesso). */
async function collegaPush(contenitore: HTMLElement): Promise<void> {
  const disegna = (stato: StatoPush, errore = '') => {
    contenitore.innerHTML = sezionePush(stato, errore);
    contenitore.querySelector<HTMLButtonElement>('[data-push]')?.addEventListener('click', (e) => {
      const pulsante = e.currentTarget as HTMLButtonElement;
      pulsante.disabled = true;
      const azione = pulsante.dataset.push === 'attiva' ? attivaPush : disattivaPush;
      azione()
        .then((nuovo) => disegna(nuovo))
        .catch(() =>
          disegna(
            stato,
            'Non è stato possibile cambiare gli avvisi. Controlla la connessione e riprova.',
          ),
        );
    });
  };
  try {
    disegna(await statoPush());
  } catch {
    disegna('non-supportate');
  }
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
      <div data-sezione-push></div>
      ${
        notifiche.length
          ? `<div class="tc-lista">${notifiche.map(rigaNotifica).join('')}</div>`
          : nessunaNotifica()
      }
    </div>`);

  const push = app.querySelector<HTMLElement>('[data-sezione-push]');
  if (push) void collegaPush(push);

  // Viste: il badge si azzera. Se non riesce (rete) resteranno da leggere, nessun danno
  if (notifiche.some((x) => x.letta_il === null)) segnaLette().catch(() => undefined);
}
