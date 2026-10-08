import { ClienteSchema } from '@tyrecare/shared';
import {
  caricaCliente,
  eliminaCliente,
  eTitolare,
  modificaCliente,
  nominativo,
  type SchedaCliente,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { collegaElimina, pulsanteElimina } from '../ui/conferma';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, collegaModulo, pulsanteInvio } from '../ui/modulo';
import {
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';
import { campiCliente } from './nuovo-cliente';
import { nonTrovato } from './veicolo';

/**
 * Correzione dei dati di un cliente: `/clienti/modifica?id=…&veicolo=…`. Si arriva dalla scheda del
 * veicolo e si torna lì. Il TITOLARE può anche eliminare il cliente: i suoi veicoli restano.
 */
export async function mostraModificaCliente(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id');
  const veicolo = parametro('veicolo');
  const indietro = idValido(veicolo) ? `/veicolo?id=${veicolo}` : '/';

  let cliente: SchedaCliente | null = null;
  let titolare = false;
  try {
    if (idValido(id)) {
      const [c, utente] = await Promise.all([caricaCliente(id), caricaDatiUtente()]);
      // Il cliente con un account vede la propria anagrafica, ma non è un membro dell'officina
      if (c && utente.officine.some((o) => o.officina.id === c.officina_id)) {
        cliente = c;
        titolare = eTitolare(utente.officine, c.officina_id);
      }
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!cliente) {
    app.innerHTML = paginaApp(nonTrovato('Cliente non trovato', 'Il cliente'));
    return;
  }

  const nome = nominativo(cliente);
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Modifica cliente', nome)}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campiCliente(cliente)}
        ${pulsanteInvio('Salva modifiche', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
      </form>
      ${titolare ? pulsanteElimina('Elimina cliente') : ''}
    </div>`);

  const clienteId = cliente.id;
  collegaModulo(app.querySelector('form')!, ClienteSchema, async (dati) => {
    await modificaCliente(clienteId, dati);
    vaiConConferma(indietro, 'Dati del cliente aggiornati.');
  });

  const veicoli = cliente.veicoli[0]?.count ?? 0;
  collegaElimina(app, {
    titolo: `Eliminare ${nome}?`,
    testo:
      veicoli === 0
        ? "L'anagrafica del cliente verrà eliminata. L'operazione non si può annullare."
        : `L'anagrafica del cliente verrà eliminata. ${
            veicoli === 1 ? 'Il suo veicolo resta' : `I suoi ${veicoli} veicoli restano`
          } nell'officina, con i controlli, ma senza cliente. L'operazione non si può annullare.`,
    pulsante: 'Elimina cliente',
    azione: async () => {
      await eliminaCliente(clienteId);
      vaiConConferma(indietro, 'Cliente eliminato.');
    },
  });
}
