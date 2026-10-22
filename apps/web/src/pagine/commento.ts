import { COMMENTO_MAX, CommentoSchema, percorsoCommento } from '@tyrecare/shared';
import { inviaCommento } from '../lib/commenti';
import { officinaAttiva } from '../lib/officina';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, areaTesto, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { erroreCaricamento, intestazioneSottopagina } from './comune';
import { tornaAlProfilo } from './profilo';

/** Invio di un commento o di una segnalazione durante il pilota: `/commento?da=<pagina>`. */
export async function mostraCommento(app: HTMLElement): Promise<void> {
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

  // Chi lavora in un'officina scrive a nome dell'officina attiva; il cliente non ne ha una
  const officinaId = officinaAttiva(dati.officine)?.officina.id ?? null;
  const percorso = percorsoCommento(new URLSearchParams(location.search).get('da'));

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Invia un commento')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${areaTesto({
          nome: 'testo',
          etichetta: 'Cosa vuoi dirci?',
          aiuto: "Segnala un problema o un'idea: lo legge chi sviluppa TyreCare",
          righe: 6,
        })}
        <p class="form-text text-end" data-contatore aria-live="polite">0 / ${COMMENTO_MAX}</p>
        ${pulsanteInvio('Invia', 'Invio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/profilo">Annulla</a>
      </form>
    </div>`);

  const form = app.querySelector('form')!;
  const contatore = form.querySelector<HTMLElement>('[data-contatore]')!;
  form.addEventListener('input', () => {
    const lunghezza = form.querySelector<HTMLTextAreaElement>('textarea')!.value.length;
    contatore.textContent = `${lunghezza} / ${COMMENTO_MAX}`;
  });

  collegaModulo(form, CommentoSchema, async (commento) => {
    await inviaCommento(commento, officinaId, percorso);
    tornaAlProfilo('Grazie, abbiamo ricevuto il tuo commento.');
  });
}
