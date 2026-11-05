import { Phone, X } from 'lucide';
import { esc } from '../lib/html';
import { caricaGarage, type VeicoloGarage } from '../lib/garage';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import {
  FRASE_RESPONSABILITA,
  INTERVALLO_AGGIORNAMENTO_MS,
  RichiestaStradaSchema,
  annullaRichiestaStrada,
  creaGenerazione,
  creaRichiestaStrada,
  posizioneAttuale,
  richiestaInCorso,
  type RichiestaInCorso,
} from '../lib/strada';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, areaTesto, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

const ORA = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const telefonoHref = (t: string) => `tel:${t.replace(/\s/g, '')}`;

/**
 * Aiuto su strada (R18): il modulo per chiedere aiuto con la posizione del telefono, oppure, se c'è una
 * richiesta in corso, il suo stato. Finché la pagina è aperta si aggiorna da sola ogni 15 secondi.
 */
export async function mostraStrada(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  // Ogni annullo o nuova richiesta apre una generazione nuova: la lettura partita prima si ignora
  const generazione = creaGenerazione();
  let timer: ReturnType<typeof setInterval> | undefined;
  const ferma = () => {
    clearInterval(timer);
    timer = undefined;
  };

  /** Legge lo stato e disegna la pagina; `nota` è un messaggio da mostrare sopra il modulo. */
  const disegna = async (nota = ''): Promise<void> => {
    ferma();
    const g = generazione.corrente();
    let richiesta: RichiestaInCorso | null;
    try {
      richiesta = await richiestaInCorso();
    } catch (errore) {
      if (generazione.attuale(g)) await gestisciErroreCaricamento(app, n, errore);
      return;
    }
    if (!ancoraAttuale(n) || !generazione.attuale(g)) return;
    if (richiesta) {
      mostraRichiesta(richiesta);
      // Si ridisegna solo se qualcosa è cambiato: un dialogo aperto non deve sparire
      let attuale = richiesta;
      timer = setInterval(async () => {
        if (!ancoraAttuale(n)) return ferma();
        const gLettura = generazione.corrente();
        try {
          const nuova = await richiestaInCorso();
          if (!ancoraAttuale(n)) return ferma();
          if (!generazione.attuale(gLettura)) return;
          if (!nuova) return void disegna('La richiesta non è più in corso.');
          if (nuova.id !== attuale.id || nuova.stato !== attuale.stato) {
            attuale = nuova;
            mostraRichiesta(nuova);
          }
        } catch {
          // Rete assente: si riprova al prossimo giro
        }
      }, INTERVALLO_AGGIORNAMENTO_MS);
      return;
    }
    await mostraModulo(nota);
  };

  const mostraModulo = async (nota: string): Promise<void> => {
    let dati: DatiUtente;
    let garage: VeicoloGarage[];
    try {
      [dati, garage] = await Promise.all([caricaDatiUtente(), caricaGarage().catch(() => [])]);
    } catch (errore) {
      await gestisciErroreCaricamento(app, n, errore);
      return;
    }
    if (!ancoraAttuale(n)) return;
    const telefono = dati.profilo.telefono ?? '';
    const targhe = garage.map((v) => v.targa);

    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Aiuto su strada', 'Assistenza')}
      <div class="tc-contenuto">
        ${nota ? `<div class="tc-avviso tc-avviso--giallo" role="status"><p class="mb-0">${esc(nota)}</p></div>` : ''}
        <form class="tc-auth__modulo" novalidate>
          ${RIQUADRO_ERRORE}
          ${areaTesto({ nome: 'descrizione', etichetta: 'Cosa è successo', righe: 4 })}
          ${campo({
            nome: 'telefono',
            etichetta: 'Telefono',
            tipo: 'tel',
            autocomplete: 'tel',
            aiuto: "L'officina che accetta ti richiama a questo numero.",
            valore: telefono,
          })}
          ${campo({
            nome: 'targa',
            etichetta: 'Targa (facoltativa)',
            tipo: 'text',
            autocomplete: 'off',
            attributi: 'list="tc-targhe" autocapitalize="characters" spellcheck="false"',
          })}
          <datalist id="tc-targhe">
            ${targhe.map((t) => `<option value="${esc(t)}"></option>`).join('')}
          </datalist>
          ${pulsanteInvio('Usa la mia posizione e invia', 'Invio…')}
          <p class="text-body-secondary small mb-0">${esc(FRASE_RESPONSABILITA)}</p>
        </form>
      </div>`);

    collegaModulo(app.querySelector('form')!, RichiestaStradaSchema, async (dati) => {
      const posizione = await posizioneAttuale();
      generazione.nuova();
      await creaRichiestaStrada(dati, posizione);
      if (ancoraAttuale(n)) await disegna();
    });
  };

  const mostraRichiesta = (r: RichiestaInCorso): void => {
    const accettata = r.stato === 'ACCETTATA';
    const officina = r.officina;
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Aiuto su strada', 'Assistenza')}
      <div class="tc-contenuto">
        <section class="tc-azione" aria-labelledby="tc-stato" aria-live="polite">
          <h2 id="tc-stato" class="tc-etichetta">${accettata ? "Un'officina ti aiuta" : "Stiamo cercando un'officina vicina"}</h2>
          ${
            accettata
              ? `<p class="mb-2"><strong>${esc(officina?.ragione_sociale ?? "L'officina")}</strong> ha accettato la tua richiesta.</p>
                 ${
                   officina?.telefono
                     ? `<a class="btn btn-primary btn-lg w-100 mb-2" href="${esc(telefonoHref(officina.telefono))}">${icona(Phone)} Chiama ${esc(officina.telefono)}</a>`
                     : "<p class='mb-2'>L'officina ti richiamerà al numero che hai indicato.</p>"
                 }`
              : `<p class="mb-0">Cerchiamo un'officina vicina: la richiesta resta aperta fino alle ${esc(ORA.format(new Date(r.scade_il)))}.</p>`
          }
        </section>
        <section aria-labelledby="tc-tua">
          <h2 id="tc-tua" class="tc-etichetta">La tua richiesta</h2>
          <p class="mb-0">${esc(r.descrizione)}</p>
        </section>
        <button type="button" class="btn btn-outline-light btn-lg w-100" data-annulla>
          ${icona(X)} Annulla la richiesta
        </button>
        <p class="text-body-secondary small mb-0">${esc(FRASE_RESPONSABILITA)}</p>
      </div>`);

    const annulla = app.querySelector<HTMLButtonElement>('[data-annulla]')!;
    annulla.addEventListener('click', () =>
      chiediConferma({
        titolo: 'Annullare la richiesta?',
        testo: accettata
          ? "L'officina che l'ha accettata verrà avvisata che non ti serve più."
          : 'Le officine vicine non la vedranno più.',
        pulsante: 'Annulla la richiesta',
        iconaPulsante: X,
        inCorso: 'Annullamento…',
        origine: annulla,
        azione: async () => {
          ferma();
          generazione.nuova();
          await annullaRichiestaStrada(r.id);
          if (ancoraAttuale(n)) await disegna();
        },
      }),
    );
  };

  await disegna();
}
