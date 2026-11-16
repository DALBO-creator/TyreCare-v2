import { ScrollText } from 'lucide';
import { formattaDataOra } from '../lib/admin';
import {
  caricaRegistro,
  descriviVoce,
  dettagliVoce,
  type VoceRegistro,
} from '../lib/admin-pannello';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { accessoAdmin } from './admin-comune';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// Registro delle azioni dell'admin (/admin/registro): sola lettura, le ultime 200 voci.
// Lo scrivono solo i trigger e le funzioni del database: nemmeno l'admin può cambiarlo.

function riga(v: VoceRegistro): string {
  const dettagli = dettagliVoce(v);
  return `
    <div class="tc-lista__riga flex-column align-items-stretch">
      <div class="d-flex justify-content-between gap-2 flex-wrap">
        <strong>${esc(descriviVoce(v))}</strong>
        <small class="text-body-secondary">${esc(formattaDataOra(v.created_at))}</small>
      </div>
      <small class="text-body-secondary text-break">
        ${esc(v.admin) || 'Amministratore'}${v.oggetto_id ? ` · ID ${esc(v.oggetto_id)}` : ''}
      </small>
      ${
        dettagli.length
          ? `<ul class="tc-registro__dettagli">${dettagli.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
          : ''
      }
    </div>`;
}

export async function mostraAdminRegistro(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let voci: VoceRegistro[];
  try {
    if (!(await accessoAdmin(app, n, 'Registro delle azioni'))) return;
    voci = await caricaRegistro();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Registro delle azioni', 'Amministratore')}
    <div class="tc-contenuto">
      ${
        voci.length
          ? `<div class="tc-lista">${voci.map(riga).join('')}</div>`
          : `<div class="tc-vuoto">
              <span class="tc-vuoto__icona">${icona(ScrollText)}</span>
              <p class="tc-vuoto__titolo">Nessuna azione registrata</p>
            </div>`
      }
    </div>`);
}
