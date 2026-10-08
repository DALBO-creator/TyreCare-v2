import { creaControlloSchema, formattaTarga } from '@tyrecare/shared';
import {
  caricaControllo,
  eliminaControllo,
  modificaControllo,
  type ControlloDaCorreggere,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { collegaElimina, pulsanteElimina } from '../ui/conferma';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, collegaModulo, pulsanteInvio } from '../ui/modulo';
import {
  ORDINE_POSIZIONI,
  conData,
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';
import { campiControllo, collegaStatoInDiretta } from './nuovo-controllo';
import { nonTrovato } from './veicolo';

/**
 * Correzione di un controllo già registrato: `/controllo/modifica?id=…`. Si correggono le misure
 * degli pneumatici misurati quel giorno, anche se nel frattempo sono stati smontati. Chi lavora
 * nell'officina (TITOLARE o OPERATORE) può anche eliminarlo.
 */
export async function mostraModificaControllo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id');
  let controllo: ControlloDaCorreggere | null = null;
  try {
    if (idValido(id)) {
      const [c, utente] = await Promise.all([caricaControllo(id), caricaDatiUtente()]);
      // Il cliente vede i controlli della propria auto, ma non li può correggere
      if (c && utente.officine.some((o) => o.officina.id === c.officina_id)) controllo = c;
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!controllo) {
    app.innerHTML = paginaApp(nonTrovato('Controllo non trovato', 'Il controllo'));
    return;
  }

  const { id: controlloId, veicolo_id: veicoloId } = controllo;
  const misure = [...controllo.misure].sort(
    (a, b) =>
      ORDINE_POSIZIONI.indexOf(a.pneumatico.posizione) -
      ORDINE_POSIZIONI.indexOf(b.pneumatico.posizione),
  );
  const pneumatici = misure.map((m) => m.pneumatico);
  const indietro = `/veicolo?id=${veicoloId}`;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Correggi controllo', formattaTarga(controllo.veicolo.targa))}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campiControllo(pneumatici, {
          ...controllo,
          misure: new Map(misure.map((m) => [m.pneumatico.posizione, m])),
        })}
        ${pulsanteInvio('Salva modifiche', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
      </form>
      ${pulsanteElimina('Elimina controllo')}
    </div>`);

  const form = app.querySelector('form')!;
  collegaStatoInDiretta(form, pneumatici);
  collegaModulo(form, creaControlloSchema(pneumatici.map((p) => p.posizione)), async (dati) => {
    await modificaControllo(controlloId, dati);
    vaiConConferma(indietro, 'Controllo aggiornato.');
  });

  const data = conData('del', controllo.eseguito_il);
  collegaElimina(app, {
    titolo: `Eliminare il controllo ${data}?`,
    testo:
      "Si eliminano anche le sue misure: anche il cliente non le vedrà più. L'operazione non si può annullare.",
    pulsante: 'Elimina controllo',
    azione: async () => {
      await eliminaControllo(controlloId);
      vaiConConferma(indietro, 'Controllo eliminato.');
    },
  });
}
