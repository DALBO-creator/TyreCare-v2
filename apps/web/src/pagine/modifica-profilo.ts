import { ModificaProfiloSchema } from '@tyrecare/shared';
import { caricaDatiUtente, salvaProfilo, type DatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { erroreCaricamento, intestazioneSottopagina } from './comune';
import { tornaAlProfilo } from './profilo';

/** Modifica di nome, cognome e telefono. Email e ruolo non si cambiano da qui. */
export async function mostraModificaProfilo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let dati: DatiUtente;
  try {
    dati = await caricaDatiUtente();
  } catch {
    if (ancoraAttuale(n)) app.innerHTML = paginaApp(erroreCaricamento());
    return;
  }
  if (!ancoraAttuale(n)) return;

  const { profilo } = dati;
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('I tuoi dati')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campo({
          nome: 'nome',
          etichetta: 'Nome',
          tipo: 'text',
          autocomplete: 'given-name',
          valore: profilo.nome,
        })}
        ${campo({
          nome: 'cognome',
          etichetta: 'Cognome',
          tipo: 'text',
          autocomplete: 'family-name',
          valore: profilo.cognome,
        })}
        ${campo({
          nome: 'telefono',
          etichetta: 'Telefono (facoltativo)',
          tipo: 'tel',
          autocomplete: 'tel',
          aiuto: 'Serve alla tua officina per contattarti.',
          valore: profilo.telefono ?? '',
        })}
        ${pulsanteInvio('Salva', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, ModificaProfiloSchema, async (nuovi) => {
    await salvaProfilo(nuovi);
    tornaAlProfilo('Dati salvati.');
  });
}
