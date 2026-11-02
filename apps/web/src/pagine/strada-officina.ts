import { Check, MapPin, Phone } from 'lucide';
import { formattaDistanza } from '@tyrecare/shared';
import { officinaOffreStrada } from '../lib/dati-officina';
import { esc } from '../lib/html';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import {
  INTERVALLO_AGGIORNAMENTO_MS,
  accettaRichiestaStrada,
  caricaRichiesteAccettate,
  caricaRichiesteVicine,
  chiudiRichiestaStrada,
  linkMappa,
  scadeAlle,
  telefonoHref,
  type RichiestaAccettata,
  type RichiestaVicina,
} from '../lib/strada-officina';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

/**
 * Richieste su strada (R18), per i membri dell'officina attiva: le richieste aperte nel raggio, con
 * "Accetta", e quelle già accettate, con telefono, posizione e "Chiudi". Finché la pagina è aperta si
 * rilegge da sola ogni 15 secondi.
 */
export async function mostraStradaOfficina(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officinaId: string;
  let nomeOfficina: string;
  let titolare: boolean;
  let offre: boolean;
  let vicine: RichiestaVicina[] = [];
  let accettate: RichiestaAccettata[] = [];
  try {
    const contesto = await caricaContestoOfficina();
    officinaId = contesto.attiva.officina.id;
    nomeOfficina = contesto.attiva.officina.ragione_sociale;
    titolare = eTitolare(contesto.officine, officinaId);
    offre = await officinaOffreStrada(officinaId);
    [vicine, accettate] = await leggi(officinaId, offre);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Richieste su strada', nomeOfficina)}
    <div class="tc-contenuto">
      ${offre ? '' : avvisoNonOffre(titolare)}
      <div data-errore class="tc-avviso tc-avviso--rosso" role="alert" tabindex="-1" hidden></div>
      <section aria-labelledby="tc-vicine" data-vicine></section>
      <section aria-labelledby="tc-accettate" data-accettate></section>
    </div>`);

  const sezVicine = app.querySelector<HTMLElement>('[data-vicine]')!;
  const sezAccettate = app.querySelector<HTMLElement>('[data-accettate]')!;
  const riquadroErrore = app.querySelector<HTMLElement>('[data-errore]')!;

  const mostraErrore = (errore: unknown) => {
    riquadroErrore.textContent =
      errore instanceof Error && errore.name === 'ErroreModulo'
        ? errore.message
        : 'Qualcosa non ha funzionato. Riprova.';
    riquadroErrore.hidden = false;
    riquadroErrore.focus();
  };

  // Si ridisegna solo se l'elenco è cambiato: un dialogo aperto o il focus non devono sparire
  let impronta = '';
  const disegna = (): void => {
    const nuova = JSON.stringify([vicine, accettate]);
    if (nuova === impronta) return;
    impronta = nuova;
    sezVicine.innerHTML = htmlVicine(vicine, offre);
    sezAccettate.innerHTML = htmlAccettate(accettate);
  };
  disegna();

  const rileggi = async (): Promise<void> => {
    [vicine, accettate] = await leggi(officinaId, offre);
    if (ancoraAttuale(n)) disegna();
  };

  // Aggiornamento ogni 15 secondi: si ferma da solo quando si lascia la pagina
  const timer = setInterval(async () => {
    if (!ancoraAttuale(n) || !app.contains(sezVicine)) return clearInterval(timer);
    try {
      await rileggi();
    } catch {
      // Rete assente: si riprova al prossimo giro
    }
  }, INTERVALLO_AGGIORNAMENTO_MS);

  // Sul contenitore della pagina (non su `app`, che resta lo stesso tra una pagina e l'altra)
  app.querySelector('.tc-contenuto')!.addEventListener('click', (e) => {
    const pulsante = (e.target as Element).closest<HTMLButtonElement>('[data-azione]');
    if (!pulsante) return;
    const id = pulsante.dataset.id!;
    riquadroErrore.hidden = true;

    if (pulsante.dataset.azione === 'accetta') {
      chiediConferma({
        titolo: 'Accetti la richiesta?',
        testo: "Il cliente riceverà il nome e il telefono dell'officina.",
        pulsante: 'Sì, accetta',
        iconaPulsante: Check,
        inCorso: 'Accettazione…',
        origine: pulsante,
        azione: async () => {
          try {
            await accettaRichiestaStrada(id, officinaId);
          } catch (errore) {
            // Presa da un'altra officina nel frattempo: l'elenco si aggiorna e l'errore resta nel dialogo
            void rileggi().catch(() => undefined);
            throw errore;
          }
          await rileggi();
        },
      });
      return;
    }

    pulsante.disabled = true;
    chiudiRichiestaStrada(id)
      .then(rileggi)
      .then(() => sezAccettate.querySelector<HTMLElement>('h2')?.focus())
      .catch((errore: unknown) => {
        pulsante.disabled = false;
        mostraErrore(errore);
      });
  });
}

async function leggi(
  officinaId: string,
  offre: boolean,
): Promise<[RichiestaVicina[], RichiestaAccettata[]]> {
  return Promise.all([
    // Senza il servizio attivo la funzione darebbe comunque un elenco vuoto
    offre ? caricaRichiesteVicine(officinaId) : Promise.resolve([]),
    caricaRichiesteAccettate(officinaId),
  ]);
}

function avvisoNonOffre(titolare: boolean): string {
  return `
    <div class="tc-avviso tc-avviso--giallo" role="status">
      <p class="mb-0">
        L'officina non offre l'aiuto su strada, quindi non riceve richieste.
        ${
          titolare
            ? `Puoi attivarlo in <a href="/officina/dati">Dati dell'officina</a>.`
            : "Il titolare può attivarlo in «Dati dell'officina»."
        }
      </p>
    </div>`;
}

function htmlVicine(righe: RichiestaVicina[], offre: boolean): string {
  const titolo = `<h2 id="tc-vicine" class="tc-etichetta">Richieste vicine</h2>`;
  if (righe.length === 0) {
    return `${titolo}
      <p class="text-body-secondary mb-0">${
        offre
          ? 'Nessuna richiesta nel tuo raggio. Questa pagina si aggiorna da sola.'
          : 'Nessuna richiesta: l’aiuto su strada non è attivo.'
      }</p>`;
  }
  return `${titolo}
    <div class="tc-lista">
      ${righe
        .map(
          (r) => `
        <div class="tc-lista__riga d-block">
          <p class="mb-1"><strong>A ${esc(formattaDistanza(r.distanza_km))} da te</strong></p>
          <p class="mb-1">${esc(r.descrizione)}</p>
          <p class="mb-2 text-body-secondary small">
            ${r.targa ? `Targa ${esc(r.targa)} · ` : ''}${esc(scadeAlle(r.scade_il))}
          </p>
          <button type="button" class="btn btn-primary w-100" data-azione="accetta" data-id="${esc(r.id)}">
            Accetta
          </button>
        </div>`,
        )
        .join('')}
    </div>`;
}

function htmlAccettate(righe: RichiestaAccettata[]): string {
  const titolo = `<h2 id="tc-accettate" class="tc-etichetta" tabindex="-1">Accettate</h2>`;
  if (righe.length === 0) {
    return `${titolo}<p class="text-body-secondary mb-0">Nessuna richiesta accettata in corso.</p>`;
  }
  return `${titolo}
    <div class="tc-lista">
      ${righe
        .map(
          (r) => `
        <div class="tc-lista__riga d-block">
          <p class="mb-1">${esc(r.descrizione)}</p>
          ${r.targa ? `<p class="mb-1 text-body-secondary small">Targa ${esc(r.targa)}</p>` : ''}
          <div class="d-grid gap-2 mt-2">
            <a class="btn btn-primary" href="${esc(telefonoHref(r.telefono))}">
              ${icona(Phone)} Chiama ${esc(r.telefono)}
            </a>
            <a class="btn btn-outline-light" href="${esc(linkMappa(r.latitudine, r.longitudine))}"
              target="_blank" rel="noopener noreferrer">${icona(MapPin)} Vedi la posizione</a>
            <button type="button" class="btn btn-outline-light" data-azione="chiudi" data-id="${esc(r.id)}">
              Chiudi
            </button>
          </div>
        </div>`,
        )
        .join('')}
    </div>`;
}
