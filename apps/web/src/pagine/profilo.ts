import {
  Building2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  MapPin,
  KeyRound,
  LogOut,
  MessageSquare,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserPen,
  Wrench,
} from 'lucide';
import { contaOfficineInAttesa } from '../lib/admin';
import { sessioneAal2 } from '../lib/admin-pannello';
import { esci, messaggioErrore } from '../lib/auth';
import { esc } from '../lib/html';
import { nomeFileMieiDati, raccogliMieiDati } from '../lib/miei-dati';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { ancoraAttuale, paginaPrecedente, visualizzazioneCorrente } from '../lib/router';
import { scaricaJson } from '../lib/scarica';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  ETICHETTE_RUOLO,
  ETICHETTE_RUOLO_OFFICINA,
  avvisoConferma,
  gestisciErroreCaricamento,
  mostraErroreInBox,
  nascondiBox,
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
  // Solo l'amministratore con la 2FA già fatta: quante officine aspettano l'attivazione (senza aal2 il
  // database risponderebbe 0; se la query fallisce, link senza numero)
  const inAttesa =
    dati.profilo.ruolo === 'ADMIN' && (await sessioneAal2())
      ? await contaOfficineInAttesa().catch(() => null)
      : null;
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
                ${
                  officine.some((o) => o.ruolo === 'TITOLARE')
                    ? link(Clock, 'Orari e chiusure', '/officina/orari') +
                      link(MapPin, "Dati dell'officina", '/officina/dati')
                    : ''
                }
              </nav>
            </section>`
          : ''
      }

      ${
        profilo.ruolo === 'ADMIN'
          ? `<section aria-labelledby="tc-admin">
              <h2 id="tc-admin" class="tc-etichetta">Amministrazione</h2>
              <nav class="tc-lista" aria-labelledby="tc-admin">
                ${link(ShieldCheck, 'Pannello amministratore', '/admin')}
                ${link(Building2, `Officine da attivare${inAttesa === null ? '' : ` (${inAttesa})`}`, '/admin/officine')}
                ${link(MessageSquare, 'Commenti degli utenti', '/admin/commenti')}
              </nav>
            </section>`
          : ''
      }

      <section aria-labelledby="tc-account">
        <h2 id="tc-account" class="tc-etichetta">Account</h2>
        <nav class="tc-lista" aria-labelledby="tc-account">
          ${link(UserPen, 'Modifica i tuoi dati', '/profilo/dati')}
          ${link(KeyRound, 'Cambia password', '/profilo/password')}
          ${link(
            MessageSquare,
            'Invia un commento su TyreCare',
            `/commento?da=${encodeURIComponent(paginaPrecedente())}`,
          )}
          ${link(Trash2, 'Elimina il tuo account', '/profilo/elimina')}
        </nav>
        <div class="tc-avviso tc-avviso--rosso mt-3" data-errore-dati role="alert" tabindex="-1" hidden></div>
        <button type="button" class="btn btn-outline-light btn-lg w-100 mt-3" data-scarica-dati>
          ${icona(Download)} Scarica i tuoi dati
        </button>
      </section>

      <section class="tc-azione">
        <button type="button" class="btn btn-outline-light btn-lg w-100" data-esci>
          ${icona(LogOut)} Esci
        </button>
      </section>
    </div>`);

  const scaricaDati = app.querySelector<HTMLButtonElement>('[data-scarica-dati]');
  scaricaDati?.addEventListener('click', async () => {
    const box = app.querySelector<HTMLElement>('[data-errore-dati]');
    nascondiBox(box);
    const html = scaricaDati.innerHTML;
    scaricaDati.disabled = true;
    scaricaDati.textContent = 'Preparazione…';
    try {
      scaricaJson(nomeFileMieiDati(), await raccogliMieiDati());
    } catch (errore) {
      mostraErroreInBox(box, messaggioErrore(errore));
    } finally {
      scaricaDati.innerHTML = html;
      scaricaDati.disabled = false;
    }
  });

  app.querySelector('[data-esci]')?.addEventListener('click', async () => {
    // Il ritorno alla pagina di accesso lo fa main.ts su SIGNED_OUT; senza rete `esci()` toglie la
    // sessione locale e ricarica `/accedi`. Non lancia mai.
    await esci();
  });
}
