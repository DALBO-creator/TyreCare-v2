import { MessageSquare } from 'lucide';
import { caricaCommentiAdmin, formattaDataOra, type CommentoAdmin } from '../lib/admin';
import { esc } from '../lib/html';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// Pagina dell'amministratore (T103): i commenti mandati con "Invia un commento". Sola lettura.
// Il controllo vero è nella RLS di `commenti`: qui il ruolo serve solo a non mostrare una pagina vuota.

function riga(c: CommentoAdmin): string {
  return `
    <div class="tc-lista__riga flex-column align-items-stretch">
      <small class="text-body-secondary text-break">
        ${esc(formattaDataOra(c.created_at))} · ${esc(c.autore) || 'Autore non disponibile'}
        ${c.percorso ? `<br />Da: ${esc(c.percorso)}` : ''}
      </small>
      <span class="text-break" style="white-space: pre-wrap">${esc(c.testo)}</span>
    </div>`;
}

export async function mostraAdminCommenti(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let commenti: CommentoAdmin[];
  try {
    const { profilo } = await caricaDatiUtente();
    if (profilo.ruolo !== 'ADMIN') {
      if (!ancoraAttuale(n)) return;
      app.innerHTML = paginaApp(`
        ${intestazioneSottopagina('Commenti degli utenti', 'Amministratore')}
        <div class="tc-contenuto"><p>Pagina riservata all'amministratore.</p></div>`);
      return;
    }
    commenti = await caricaCommentiAdmin();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Commenti degli utenti', 'Amministratore')}
    <div class="tc-contenuto">
      ${
        commenti.length
          ? `<div class="tc-lista">${commenti.map(riga).join('')}</div>`
          : `<div class="tc-vuoto">
              <span class="tc-vuoto__icona">${icona(MessageSquare)}</span>
              <p class="tc-vuoto__titolo">Nessun commento per ora.</p>
            </div>`
      }
    </div>`);
}
