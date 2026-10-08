import { VeicoloSchema } from '@tyrecare/shared';
import {
  caricaClienti,
  caricaContestoOfficina,
  creaVeicolo,
  nominativo,
  type ClienteInElenco,
} from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio, scelta } from '../ui/modulo';
import {
  avvisoConferma,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';

/** Registrazione di un veicolo dell'officina, con il cliente a cui appartiene. */
export async function mostraNuovoVeicolo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officinaId: string;
  let clienti: ClienteInElenco[];
  try {
    officinaId = (await caricaContestoOfficina()).attiva.officina.id;
    clienti = await caricaClienti(officinaId);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Nuovo veicolo', 'Area officina')}
    <div class="tc-contenuto">
      ${avvisoConferma()}
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${scelta({
          nome: 'cliente_officina_id',
          etichetta: 'Cliente',
          opzioni: [['', 'Nessun cliente'], ...clienti.map((c) => [c.id, nominativo(c)] as const)],
          valore: parametro('cliente') ?? '',
        })}
        <a class="tc-auth__link-secondario" href="/clienti/nuovo">Cliente nuovo? Aggiungilo</a>
        ${campo({
          nome: 'targa',
          etichetta: 'Targa',
          tipo: 'text',
          autocomplete: 'off',
          aiuto: 'Spazi e trattini non contano: AB 123 CD e AB123CD sono la stessa targa.',
          attributi: 'autocapitalize="characters" spellcheck="false" maxlength="15"',
        })}
        <div class="tc-auth__coppia">
          ${campo({ nome: 'marca', etichetta: 'Marca', tipo: 'text', autocomplete: 'off' })}
          ${campo({ nome: 'modello', etichetta: 'Modello', tipo: 'text', autocomplete: 'off' })}
        </div>
        <div class="tc-auth__coppia">
          ${campo({
            nome: 'anno',
            etichetta: 'Anno (facoltativo)',
            tipo: 'text',
            autocomplete: 'off',
            attributi: 'inputmode="numeric" maxlength="4"',
          })}
          ${campo({
            nome: 'telaio',
            etichetta: 'Telaio (facoltativo)',
            tipo: 'text',
            autocomplete: 'off',
            attributi: 'autocapitalize="characters" spellcheck="false" maxlength="20"',
          })}
        </div>
        ${pulsanteInvio('Salva veicolo', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, VeicoloSchema, async (veicolo) => {
    const id = await creaVeicolo(officinaId, veicolo);
    vaiConConferma(`/veicolo?id=${id}`, 'Veicolo salvato. Ora puoi montare gli pneumatici.');
  });
}
