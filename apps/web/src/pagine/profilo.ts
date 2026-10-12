import {
  ChevronRight,
  ClipboardList,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserPen,
  Wrench,
} from 'lucide';
import { esci, messaggioErrore } from '../lib/auth';
import { esc } from '../lib/html';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  ETICHETTE_RUOLO,
  ETICHETTE_RUOLO_OFFICINA,
  avvisoConferma,
  gestisciErroreCaricamento,
  vaiConConferma,
} from './comune';

function riga(ic: Parameters<typeof icona>[0], etichetta: string, valore: string): string {
  return `
    <div class="tc-lista__riga">
      <span class="tc-lista__icona">${icona(ic)}</span>
      <span class="tc-lista__testo">${esc(etichetta)}<small>${valore}</small></span>
    </div>`;
}

function link(ic: Parameters<typeof icona>[0], etichetta: string, href: string): string {
  return `
    <a class="tc-lista__riga" href="${href}">
      <span class="tc-lista__icona">${icona(ic)}</span>
      <span class="tc-lista__testo">${esc(etichetta)}</span>
      ${icona(ChevronRight)}
    </a>`;
}

/** Torna al profilo mostrando un messaggio di conferma (es. "Dati salvati"). */
export function tornaAlProfilo(messaggio: string): void {
  vaiConConferma('/profilo', messaggio);
}

export async function mostraProfilo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let dati: DatiUtente;
  try {
    dati = await caricaDatiUtente();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const { email, profilo, officine } = dati;
  const nomeCompleto = `${profilo.nome} ${profilo.cognome}`.trim();

  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">Profilo</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">
        ${esc(nomeCompleto) || 'Il tuo account'}
      </h1>
    </section>

    <div class="tc-contenuto">
      ${avvisoConferma()}
      <section aria-labelledby="tc-dati">
        <h2 id="tc-dati" class="tc-etichetta">I tuoi dati</h2>
        <div class="tc-lista">
          ${riga(Mail, 'Email', esc(email))}
          ${riga(Phone, 'Telefono', esc(profilo.telefono) || 'Non indicato')}
          ${riga(ShieldCheck, 'Tipo di account', ETICHETTE_RUOLO[profilo.ruolo])}
          ${officine
            .map(({ ruolo, officina }) =>
              riga(Wrench, officina.ragione_sociale, ETICHETTE_RUOLO_OFFICINA[ruolo]),
            )
            .join('')}
        </div>
      </section>

      ${
        officine.length
          ? `<section aria-labelledby="tc-officina">
              <h2 id="tc-officina" class="tc-etichetta">Officina</h2>
              <nav class="tc-lista" aria-labelledby="tc-officina">
                ${link(ClipboardList, 'Servizi e prezzi', '/servizi')}
              </nav>
            </section>`
          : ''
      }

      <section aria-labelledby="tc-account">
        <h2 id="tc-account" class="tc-etichetta">Account</h2>
        <nav class="tc-lista" aria-labelledby="tc-account">
          ${link(UserPen, 'Modifica i tuoi dati', '/profilo/dati')}
          ${link(KeyRound, 'Cambia password', '/profilo/password')}
        </nav>
      </section>

      <section class="tc-azione">
        <div class="tc-avviso tc-avviso--rosso" data-errore-esci role="alert" tabindex="-1" hidden></div>
        <button type="button" class="btn btn-outline-light btn-lg w-100" data-esci>
          ${icona(LogOut)} Esci
        </button>
      </section>
    </div>`);

  app.querySelector('[data-esci]')?.addEventListener('click', async () => {
    try {
      // Il ritorno alla pagina di accesso lo fa main.ts, quando Supabase segnala SIGNED_OUT
      await esci();
    } catch (errore) {
      const box = app.querySelector<HTMLElement>('[data-errore-esci]');
      if (box) {
        box.innerHTML = `<p class="mb-0">${esc(messaggioErrore(errore))}</p>`;
        box.hidden = false;
        box.focus();
      }
    }
  });
}
