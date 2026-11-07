import {
  AlarmClock,
  BadgeCheck,
  Ban,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  LifeBuoy,
  Mail,
  ThermometerSnowflake,
  type IconNode,
} from 'lucide';
import type { Enums } from '@tyrecare/shared';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import {
  caricaNotifiche,
  leggiEmailNotifiche,
  salvaEmailNotifiche,
  segnaLette,
  tempoTrascorso,
  type Notifica,
} from '../lib/notifiche';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { collegaAvvisiPush } from '../ui/avvisi-push';
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
  STRADA_RICHIESTA: LifeBuoy,
  STRADA_ACCETTATA: CircleCheck,
  STRADA_ANNULLATA: CircleX,
  AFFILIAZIONE_RICHIESTA: Building2,
  AFFILIAZIONE_ATTIVATA: BadgeCheck,
  AFFILIAZIONE_RIFIUTATA: CircleX,
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
        Qui trovi le novità su appuntamenti, controlli delle gomme e aiuto su strada.
      </p>
    </div>`;
}

const ETICHETTA_EMAIL = "Ricevi le notifiche anche per email se l'avviso sul telefono non arriva";

function sezioneEmail(attiva: boolean): string {
  return `
    <section class="tc-push mt-3" aria-labelledby="tc-email-titolo">
      <span class="tc-lista__icona">${icona(Mail)}</span>
      <div class="tc-push__testo">
        <h2 id="tc-email-titolo" class="tc-push__titolo">Email</h2>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" role="switch" id="tc-email-notifiche"${
            attiva ? ' checked' : ''
          }>
          <label class="form-check-label" for="tc-email-notifiche">${esc(ETICHETTA_EMAIL)}</label>
        </div>
        <p class="tc-push__errore mb-0" role="alert" data-email-errore hidden></p>
      </div>
    </section>`;
}

/** Salva la scelta al cambio; se non riesce riporta l'interruttore com'era e mostra l'errore. */
function collegaEmail(sezione: HTMLElement): void {
  const input = sezione.querySelector<HTMLInputElement>('input');
  const errore = sezione.querySelector<HTMLElement>('[data-email-errore]');
  if (!input || !errore) return;
  input.addEventListener('change', () => {
    const nuovo = input.checked;
    errore.hidden = true;
    input.disabled = true;
    salvaEmailNotifiche(nuovo)
      .catch((e: unknown) => {
        input.checked = !nuovo;
        errore.textContent =
          e instanceof ErroreModulo
            ? e.message
            : 'Non è stato possibile salvare la scelta. Controlla la connessione e riprova.';
        errore.hidden = false;
      })
      .finally(() => {
        input.disabled = false;
      });
  });
}

export async function mostraNotifiche(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let notifiche: Notifica[];
  let emailAttive: boolean;
  try {
    // I dati dell'utente decidono le voci della navigazione (officina o cliente)
    [notifiche, emailAttive] = await Promise.all([
      caricaNotifiche(),
      leggiEmailNotifiche(),
      caricaDatiUtente(),
    ]);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Notifiche', 'Le tue')}
    <div class="tc-contenuto">
      <div data-sezione-push></div>
      ${sezioneEmail(emailAttive)}
      ${
        notifiche.length
          ? `<div class="tc-lista">${notifiche.map(rigaNotifica).join('')}</div>`
          : nessunaNotifica()
      }
    </div>`);

  const push = app.querySelector<HTMLElement>('[data-sezione-push]');
  if (push) void collegaAvvisiPush(push);
  const email = app.querySelector<HTMLElement>('#tc-email-titolo')?.closest('section');
  if (email) collegaEmail(email);

  // Viste: il badge si azzera. Se non riesce (rete) resteranno da leggere, nessun danno
  if (notifiche.some((x) => x.letta_il === null)) segnaLette().catch(() => undefined);
}
