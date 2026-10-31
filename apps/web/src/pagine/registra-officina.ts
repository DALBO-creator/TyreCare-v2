import { RichiestaAffiliazioneSchema } from '@tyrecare/shared';
import { richiediAffiliazione } from '../lib/affiliazione';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { gestisciErroreCaricamento, intestazioneSottopagina, vaiConConferma } from './comune';

// "Registra la tua officina" (R7): chi non lavora in un'officina chiede l'affiliazione. L'officina nasce
// "in attesa" e l'utente ne è il titolare: dopo l'invio la home mostra l'area officina.

export async function mostraRegistraOfficina(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let giaInOfficina: boolean;
  try {
    giaInOfficina = (await caricaDatiUtente()).officine.length > 0;
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  if (giaInOfficina) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Registra la tua officina', 'Officina')}
      <div class="tc-contenuto">
        <div class="tc-avviso tc-avviso--giallo" role="status">
          <p class="mb-0">Il tuo account lavora già in un'officina.</p>
        </div>
        <a class="btn btn-outline-light btn-lg w-100" href="/">Torna alla home</a>
      </div>`);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Registra la tua officina', 'Officina')}
    <div class="tc-contenuto">
      <p>
        La tua officina sarà visibile ai clienti dopo l'attivazione di TyreCare. Prima di caricare i
        dati dei tuoi clienti firmeremo insieme l'accordo sul trattamento dei dati (DPA).
      </p>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'ragione_sociale',
          etichetta: 'Ragione sociale',
          tipo: 'text',
          autocomplete: 'organization',
          attributi: 'maxlength="200"',
        })}
        ${campo({
          nome: 'partita_iva',
          etichetta: 'Partita IVA',
          tipo: 'text',
          autocomplete: 'off',
          aiuto: '11 cifre, anche con IT davanti',
          attributi: 'maxlength="20" autocapitalize="characters"',
        })}
        ${campo({
          nome: 'citta',
          etichetta: 'Città',
          tipo: 'text',
          autocomplete: 'address-level2',
          attributi: 'maxlength="100"',
        })}
        ${campo({
          nome: 'telefono',
          etichetta: 'Telefono',
          tipo: 'tel',
          autocomplete: 'tel',
          aiuto: 'Facoltativo, es. +39 011 1234567',
        })}
        ${pulsanteInvio('Invia la richiesta', 'Invio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, RichiestaAffiliazioneSchema, async (dati) => {
    await richiediAffiliazione(dati);
    // Ricarica i dati dell'utente: ora lavora in un'officina, la home mostra l'area officina
    await caricaDatiUtente();
    vaiConConferma('/', 'Richiesta inviata: intanto puoi preparare la tua officina.');
  });
}
