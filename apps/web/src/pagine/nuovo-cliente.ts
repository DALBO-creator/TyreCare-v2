import { ClienteSchema, type Tables } from '@tyrecare/shared';
import { caricaContestoOfficina, creaCliente } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, areaTesto, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import {
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';

type ValoriCliente = Pick<
  Tables<'clienti_officina'>,
  'nome' | 'cognome' | 'ragione_sociale' | 'telefono' | 'email' | 'note'
>;

/** Campi del modulo cliente (nuovo o da correggere, con i valori attuali). */
export function campiCliente(c?: ValoriCliente): string {
  return `
    <div class="tc-auth__coppia">
      ${campo({ nome: 'nome', etichetta: 'Nome', tipo: 'text', autocomplete: 'off', valore: c?.nome })}
      ${campo({
        nome: 'cognome',
        etichetta: 'Cognome',
        tipo: 'text',
        autocomplete: 'off',
        valore: c?.cognome,
      })}
    </div>
    ${campo({
      nome: 'ragione_sociale',
      etichetta: 'Ragione sociale (facoltativa)',
      tipo: 'text',
      autocomplete: 'off',
      aiuto: 'Solo per le aziende: in quel caso nome e cognome possono restare vuoti.',
      valore: c?.ragione_sociale ?? '',
    })}
    ${campo({
      nome: 'telefono',
      etichetta: 'Telefono (facoltativo)',
      tipo: 'tel',
      autocomplete: 'off',
      valore: c?.telefono ?? '',
    })}
    ${campo({
      nome: 'email',
      etichetta: 'Email (facoltativa)',
      tipo: 'email',
      autocomplete: 'off',
      valore: c?.email ?? '',
    })}
    ${areaTesto({ nome: 'note', etichetta: 'Note (facoltative)', valore: c?.note })}`;
}

/**
 * Nuovo cliente dell'officina. Da "Nuovo veicolo" si torna lì con il cliente già scelto; dall'elenco
 * dei clienti (`?da=clienti`) si va alla scheda del cliente appena creato.
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
  const daClienti = parametro('da') === 'clienti';

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Nuovo cliente', 'Area officina')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campiCliente()}
        <div class="form-check">
          <input class="form-check-input" type="checkbox" name="invita" id="invita"
            aria-describedby="invita-aiuto" />
          <label class="form-check-label" for="invita">Invitalo nell'app dopo il salvataggio</label>
          <div id="invita-aiuto" class="form-text">
            Ti prepariamo l'email con il link per vedere i suoi veicoli sul telefono.
          </div>
        </div>
        ${pulsanteInvio('Salva cliente', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${daClienti ? '/clienti' : '/veicoli/nuovo'}">
          Annulla
        </a>
      </form>
    </div>`);

  const modulo = app.querySelector('form')!;
  collegaModulo(modulo, ClienteSchema, async (cliente) => {
    // La casella non fa parte di ClienteSchema (zod scarta i campi sconosciuti): si legge dal modulo
    const invita = modulo.querySelector<HTMLInputElement>('[name="invita"]')?.checked ?? false;
    const id = await creaCliente(officinaId, cliente);
    if (invita) {
      return vaiConConferma(`/cliente/invito?id=${id}`, "Cliente salvato: ora invialo nell'app.");
    }
    if (daClienti) return vaiConConferma(`/cliente?id=${id}`, 'Cliente salvato.');
    vaiConConferma(`/veicoli/nuovo?cliente=${id}`, 'Cliente salvato: ora registra il suo veicolo.');
  });
}
