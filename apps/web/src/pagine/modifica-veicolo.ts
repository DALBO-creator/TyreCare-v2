import { VeicoloSchema, formattaTarga } from '@tyrecare/shared';
import {
  caricaClienti,
  eliminaVeicolo,
  eTitolare,
  modificaVeicolo,
  type ClienteInElenco,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { collegaElimina, pulsanteElimina } from '../ui/conferma';
import { paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { gestisciErroreCaricamento, intestazioneSottopagina, vaiConConferma } from './comune';
import { campiVeicolo } from './nuovo-veicolo';
import { caricaSchedaDaUrl } from './veicolo';

/**
 * Correzione dei dati di un veicolo (targa, marca, cliente…): `/veicolo/modifica?id=…`. Il TITOLARE
 * può anche eliminarlo, con pneumatici e controlli.
 */
export async function mostraModificaVeicolo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const scheda = await caricaSchedaDaUrl(app, n);
  if (!scheda) return;

  const { veicolo, controlli } = scheda;
  let clienti: ClienteInElenco[];
  let titolare: boolean;
  try {
    const [c, utente] = await Promise.all([caricaClienti(veicolo.officina_id), caricaDatiUtente()]);
    clienti = c;
    titolare = eTitolare(utente.officine, veicolo.officina_id);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const targa = formattaTarga(veicolo.targa);
  const indietro = `/veicolo?id=${veicolo.id}`;
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Modifica veicolo', targa)}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campiVeicolo(clienti, veicolo)}
        ${pulsanteInvio('Salva modifiche', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
      </form>
      ${titolare ? pulsanteElimina('Elimina veicolo') : ''}
    </div>`);

  collegaModulo(app.querySelector('form')!, VeicoloSchema, async (dati) => {
    await modificaVeicolo(veicolo.id, dati);
    vaiConConferma(indietro, 'Dati del veicolo aggiornati.');
  });

  const perdita =
    controlli.length === 0
      ? 'Si elimina anche lo storico degli pneumatici: anche il cliente non lo vedrà più.'
      : `Si eliminano anche ${
          controlli.length === 1 ? 'il controllo registrato' : `i ${controlli.length} controlli`
        } e lo storico degli pneumatici: anche il cliente non li vedrà più.`;
  collegaElimina(app, {
    titolo: `Eliminare il veicolo ${targa}?`,
    testo: `${perdita} L'operazione non si può annullare.`,
    pulsante: 'Elimina veicolo',
    azione: async () => {
      await eliminaVeicolo(veicolo.id);
      vaiConConferma('/', `Veicolo ${targa} eliminato.`);
    },
  });
}
