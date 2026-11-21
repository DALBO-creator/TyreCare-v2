import { ChartColumn } from 'lucide';
import { oggiInItalia } from '@tyrecare/shared';
import {
  caricaAndamento,
  ETICHETTE_PERIODO,
  ordinaOfficine,
  periodoScelto,
  testoCopiabile,
  type AndamentoOfficina,
  type Periodo,
  type TipoPeriodo,
} from '../lib/admin-andamento';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE } from '../ui/modulo';
import { accessoAdmin } from './admin-comune';
import {
  ETICHETTE_STATO_OFFICINA,
  formattaData,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  mostraErroreInBox,
  nascondiBox,
} from './comune';

// Pagina dell'amministratore (T256): i numeri del pilota per officina e per periodo, da copiare nella
// tabella della telefonata settimanale (DOCS/pilota/piano-pilota.md §3). Sola lettura.

const TITOLO = 'Andamento del pilota';

const plurale = (n: number, uno: string, tanti: string) => (n === 1 ? `1 ${uno}` : `${n} ${tanti}`);

function numero(etichetta: string, valore: string): string {
  return `
    <div class="d-flex justify-content-between gap-3">
      <dt class="fw-normal">${esc(etichetta)}</dt>
      <dd class="mb-0 fw-semibold text-end">${esc(valore)}</dd>
    </div>`;
}

function carta(r: AndamentoOfficina): string {
  const attiva = r.stato_affiliazione === 'ATTIVA';
  const stato =
    ETICHETTE_STATO_OFFICINA[r.stato_affiliazione as keyof typeof ETICHETTE_STATO_OFFICINA] ??
    r.stato_affiliazione;
  return `
    <article class="tc-lista__riga flex-column align-items-stretch" data-officina="${esc(r.officina_id)}">
      <h2 class="h5 mb-1">${esc(r.ragione_sociale)}</h2>
      ${attiva ? '' : `<p class="small text-body-secondary mb-2">Officina non attiva: ${esc(stato)}</p>`}
      <dl class="mb-0">
        ${numero('Clienti in elenco', String(r.clienti))}
        ${numero('Clienti collegati', String(r.clienti_collegati))}
        ${numero('Clienti con le notifiche attive', String(r.clienti_con_push))}
        ${numero('Inviti creati', String(r.inviti_creati))}
        ${numero('Controlli inseriti', String(r.controlli_app))}
        ${numero('Controlli importati', String(r.controlli_importati))}
        ${numero('Richieste di appuntamento', String(r.richieste_appuntamento))}
        ${numero('Aiuto su strada accettato', String(r.richieste_strada_accettate))}
      </dl>
    </article>`;
}

function elenco(righe: AndamentoOfficina[], p: Periodo): string {
  const intro = `<p class="small text-body-secondary">Dal ${esc(formattaData(p.da))} al ${esc(formattaData(p.a))}.
    Clienti e collegati sono il totale di oggi; gli altri numeri sono del periodo.</p>`;
  if (!righe.length) {
    return `${intro}
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(ChartColumn)}</span>
        <p class="tc-vuoto__titolo">Nessuna officina da mostrare.</p>
      </div>`;
  }
  const attive = righe.filter((r) => r.stato_affiliazione === 'ATTIVA').length;
  return `${intro}
    <p class="small">${esc(plurale(righe.length, 'officina', 'officine'))}, ${esc(
      plurale(attive, 'attiva', 'attive'),
    )}.</p>
    <div class="tc-lista">${righe.map(carta).join('')}</div>`;
}

export async function mostraAdminAndamento(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const oggiIso = oggiInItalia();
  let tipo: TipoPeriodo = 'questa';
  let periodo = periodoScelto(tipo, oggiIso);
  let righe: AndamentoOfficina[];
  try {
    if (!(await accessoAdmin(app, n, TITOLO))) return;
    righe = ordinaOfficine(await caricaAndamento(periodo.da, periodo.a));
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina(TITOLO, 'Amministratore')}
    <div class="tc-contenuto">
      <div class="mb-3">
        <label class="form-label" for="tc-periodo">Periodo</label>
        <select class="form-select form-select-lg" id="tc-periodo">
          ${(Object.keys(ETICHETTE_PERIODO) as TipoPeriodo[])
            .map((t) => `<option value="${t}">${esc(ETICHETTE_PERIODO[t])}</option>`)
            .join('')}
        </select>
      </div>
      <div class="tc-avviso tc-avviso--rosso mb-3" data-errore-carica role="alert" tabindex="-1" hidden></div>
      ${RIQUADRO_ERRORE}
      <p class="small mb-3" role="status" data-copiato hidden></p>
      <button type="button" class="btn btn-outline-light w-100 mb-3" data-copia>Copia i numeri</button>
      <div data-elenco aria-live="polite">${elenco(righe, periodo)}</div>
    </div>`);

  const selettore = app.querySelector<HTMLSelectElement>('#tc-periodo')!;
  const zona = app.querySelector<HTMLElement>('[data-elenco]')!;
  const erroreCarica = app.querySelector<HTMLElement>('[data-errore-carica]')!;
  const erroreCopia = app.querySelector<HTMLElement>('[data-errore-modulo]');
  const copiato = app.querySelector<HTMLElement>('[data-copiato]')!;
  const pulsante = app.querySelector<HTMLButtonElement>('[data-copia]')!;
  let richiesta = 0;

  selettore.addEventListener('change', async () => {
    const mia = ++richiesta;
    const richiesto = selettore.value as TipoPeriodo;
    const nuovo = periodoScelto(richiesto, oggiIso);
    nascondiBox(erroreCarica);
    nascondiBox(erroreCopia);
    copiato.hidden = true;
    try {
      const nuove = ordinaOfficine(await caricaAndamento(nuovo.da, nuovo.a));
      // Una risposta vecchia (o di una pagina già lasciata) non sovrascrive quella attuale
      if (mia !== richiesta || !ancoraAttuale(n)) return;
      righe = nuove;
      periodo = nuovo;
      tipo = richiesto;
      zona.innerHTML = elenco(righe, periodo);
    } catch {
      if (mia !== richiesta || !ancoraAttuale(n)) return;
      // Il selettore torna al periodo dei numeri mostrati (elenco, selettore e copia dicono la stessa cosa)
      selettore.value = tipo;
      mostraErroreInBox(erroreCarica, 'Non riesco a leggere i numeri. Riprova tra poco.');
    }
  });

  pulsante.addEventListener('click', async () => {
    nascondiBox(erroreCopia);
    copiato.hidden = true;
    if (!righe.length) {
      mostraErroreInBox(erroreCopia, 'Non ci sono numeri da copiare.');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('assente');
      await navigator.clipboard.writeText(testoCopiabile(righe, periodo));
      copiato.textContent = 'Numeri copiati.';
      copiato.hidden = false;
    } catch {
      mostraErroreInBox(erroreCopia, 'Non riesco a copiare i numeri: copiali a mano dalla pagina.');
    }
  });
}
