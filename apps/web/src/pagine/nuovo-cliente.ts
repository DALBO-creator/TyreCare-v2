import { ClienteSchema } from '@tyrecare/shared';
import { caricaContestoOfficina, creaCliente } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, areaTesto, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { gestisciErroreCaricamento, intestazioneSottopagina, vaiConConferma } from './comune';

/**
 * Nuovo cliente dell'officina. Si arriva da "Nuovo veicolo" e si torna lì con il cliente già scelto:
 * un cliente serve sempre per registrarne il veicolo.
 */
export async function mostraNuovoCliente(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officinaId: string;
  try {
    officinaId = (await caricaContestoOfficina()).attiva.officina.id;
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Nuovo cliente', 'Area officina')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        <div class="tc-auth__coppia">
          ${campo({ nome: 'nome', etichetta: 'Nome', tipo: 'text', autocomplete: 'off' })}
          ${campo({ nome: 'cognome', etichetta: 'Cognome', tipo: 'text', autocomplete: 'off' })}
        </div>
        ${campo({
          nome: 'ragione_sociale',
          etichetta: 'Ragione sociale (facoltativa)',
          tipo: 'text',
          autocomplete: 'off',
          aiuto: 'Solo per le aziende: in quel caso nome e cognome possono restare vuoti.',
        })}
        ${campo({
          nome: 'telefono',
          etichetta: 'Telefono (facoltativo)',
          tipo: 'tel',
          autocomplete: 'off',
        })}
        ${campo({
          nome: 'email',
          etichetta: 'Email (facoltativa)',
          tipo: 'email',
          autocomplete: 'off',
        })}
        ${areaTesto({ nome: 'note', etichetta: 'Note (facoltative)' })}
        ${pulsanteInvio('Salva cliente', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/veicoli/nuovo">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, ClienteSchema, async (cliente) => {
    const id = await creaCliente(officinaId, cliente);
    vaiConConferma(`/veicoli/nuovo?cliente=${id}`, 'Cliente salvato: ora registra il suo veicolo.');
  });
}
