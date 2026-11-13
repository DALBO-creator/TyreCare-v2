import { Bug } from 'lucide';
import {
  caricaErroriApp,
  raggruppaErrori,
  type GruppoErrori,
  type RigaErrore,
} from '../lib/admin-errori';
import { formattaDataOra } from '../lib/admin';
import { esc } from '../lib/html';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// Pagina dell'amministratore (T249): errori dell'app degli ultimi 30 giorni, per messaggio. Sola lettura.
// Il controllo vero è nella RLS di `errori_app`. Dell'utente si mostra solo l'id abbreviato.

const TITOLO = "Errori dell'app";

const idBreve = (id: string): string => id.slice(0, 8);

function occorrenza(o: RigaErrore): string {
  return `
    <div class="tc-lista__riga flex-column align-items-stretch">
      <small class="text-body-secondary text-break">
        ${esc(formattaDataOra(o.created_at))} · ${esc(o.percorso) || 'Percorso non indicato'}
        · versione ${esc(o.versione) || 'n.d.'} · utente ${esc(idBreve(o.autore_id))}
        <br />${esc(o.agente)}
      </small>
      ${
        o.dettaglio
          ? `<pre class="mb-0 small" style="white-space: pre-wrap; overflow-wrap: anywhere">${esc(o.dettaglio)}</pre>`
          : ''
      }
    </div>`;
}

function gruppo(g: GruppoErrori): string {
  return `
    <details class="tc-lista__riga flex-column align-items-stretch">
      <summary class="text-break">
        <strong>${esc(g.messaggio)}</strong>
        <br /><small class="text-body-secondary">
          ${g.volte} ${g.volte === 1 ? 'volta' : 'volte'} · ultima ${esc(formattaDataOra(g.ultima))}
          · ${g.utenti} ${g.utenti === 1 ? 'utente' : 'utenti'}
          ${g.percorsi.length ? `<br />Percorsi: ${esc(g.percorsi.join(', '))}` : ''}
          ${g.versioni.length ? `<br />Versioni: ${esc(g.versioni.join(', '))}` : ''}
        </small>
      </summary>
      <div class="tc-lista mt-2">${g.occorrenze.map(occorrenza).join('')}</div>
    </details>`;
}

export async function mostraAdminErrori(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let gruppi: GruppoErrori[];
  try {
    const { profilo } = await caricaDatiUtente();
    if (profilo.ruolo !== 'ADMIN') {
      if (!ancoraAttuale(n)) return;
      app.innerHTML = paginaApp(`
        ${intestazioneSottopagina(TITOLO, 'Amministratore')}
        <div class="tc-contenuto"><p>Pagina riservata all'amministratore.</p></div>`);
      return;
    }
    gruppi = raggruppaErrori(await caricaErroriApp());
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina(TITOLO, 'Amministratore')}
    <div class="tc-contenuto">
      ${
        gruppi.length
          ? `<div class="tc-lista">${gruppi.map(gruppo).join('')}</div>`
          : `<div class="tc-vuoto">
              <span class="tc-vuoto__icona">${icona(Bug)}</span>
              <p class="tc-vuoto__titolo">Nessun errore negli ultimi 30 giorni</p>
            </div>`
      }
    </div>`);
}
