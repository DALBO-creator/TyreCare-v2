import { MontaPneumaticiSchema, formattaTarga, type Posizione } from '@tyrecare/shared';
import { modificaPneumatici } from '../lib/officina';
import { visualizzazioneCorrente } from '../lib/router';
import { paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, caselle, collegaModulo, pulsanteInvio } from '../ui/modulo';
import {
  ORDINE_POSIZIONI,
  POSIZIONI,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';
import { campiPneumatico } from './monta-pneumatici';
import { caricaSchedaDaUrl, chiaveGruppo, nonTrovato } from './veicolo';

/**
 * Correzione dei dati di pneumatici montati (marca, DOT, data… scritti male):
 * `/veicolo/pneumatici/modifica?id=<veicolo>&p=<pneumatico>`. Si corregge il gruppo di cui fa parte
 * lo pneumatico, come appare nella scheda; togliendo la spunta a una posizione, quella resta com'è.
 * Per cambiare pneumatici si usa invece "Cambia pneumatici" (lo storico resta).
 */
export async function mostraModificaPneumatici(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const scheda = await caricaSchedaDaUrl(app, n);
  if (!scheda) return;

  const { veicolo, pneumatici } = scheda;
  const scelto = pneumatici.find((p) => p.id === parametro('p'));
  if (!scelto) {
    app.innerHTML = paginaApp(nonTrovato('Pneumatico non trovato', 'Lo pneumatico'));
    return;
  }
  const gruppo = new Map(
    pneumatici
      .filter((p) => chiaveGruppo(p) === chiaveGruppo(scelto))
      .sort((a, b) => ORDINE_POSIZIONI.indexOf(a.posizione) - ORDINE_POSIZIONI.indexOf(b.posizione))
      .map((p) => [p.posizione, p.id] as const),
  );
  const posizioni = [...gruppo.keys()];
  const indietro = `/veicolo?id=${veicolo.id}`;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Correggi pneumatici', formattaTarga(veicolo.targa))}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${caselle({
          nome: 'posizioni',
          etichetta: 'Posizioni da correggere',
          opzioni: posizioni.map((p) => [p, POSIZIONI[p].nome] as const),
          selezionate: posizioni,
          aiuto: 'Per montare pneumatici diversi usa invece "Cambia pneumatici".',
        })}
        ${campiPneumatico(scelto)}
        ${pulsanteInvio('Salva modifiche', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, MontaPneumaticiSchema, async (dati) => {
    const { posizioni: scelte, ...valori } = dati;
    const ids = scelte.flatMap((p: Posizione) => gruppo.get(p) ?? []);
    await modificaPneumatici(ids, valori);
    vaiConConferma(
      indietro,
      ids.length === 1 ? 'Pneumatico aggiornato.' : 'Pneumatici aggiornati.',
    );
  });
}
