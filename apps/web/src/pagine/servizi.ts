import { ChevronRight, ClipboardList, EyeOff, Plus } from 'lucide';
import { ServizioSchema, testoDurata, testoPrezzo } from '@tyrecare/shared';
import { esc } from '../lib/html';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import {
  caricaServizi,
  caricaServizio,
  creaServizio,
  eliminaServizio,
  modificaServizio,
  type ServizioOfficina,
} from '../lib/prenotazioni';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { collegaElimina, pulsanteElimina } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  RIQUADRO_ERRORE,
  areaTesto,
  campo,
  caselle,
  collegaModulo,
  pulsanteInvio,
} from '../ui/modulo';
import {
  avvisoConferma,
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';
import { nonTrovato } from './veicolo';

// Catalogo dei servizi dell'officina (Fase 4): lo vede chi lavora in officina, lo modifica il TITOLARE.

/** Dettagli di un servizio in una riga: durata e prezzo indicativi. */
export function dettagliServizio(s: Pick<ServizioOfficina, 'durata_minuti' | 'prezzo_da'>): string {
  return [s.durata_minuti ? testoDurata(s.durata_minuti) : '', testoPrezzo(s.prezzo_da)]
    .filter(Boolean)
    .join(' · ');
}

export async function mostraServizi(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let servizi: ServizioOfficina[];
  let titolare: boolean;
  let officina: string;
  try {
    const contesto = await caricaContestoOfficina();
    const id = contesto.attiva.officina.id;
    servizi = await caricaServizi(id);
    titolare = eTitolare(contesto.officine, id);
    officina = contesto.attiva.officina.ragione_sociale;
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const riga = (s: ServizioOfficina) => {
    const contenuto = `
      <span class="tc-lista__testo">
        ${esc(s.nome)}
        <small>${esc(dettagliServizio(s))}</small>
      </span>
      ${
        s.prenotabile
          ? ''
          : `<span class="tc-stato tc-stato--nessuno">${icona(EyeOff)}Non prenotabile</span>`
      }`;
    return titolare
      ? `<a class="tc-lista__riga" href="/servizi/modifica?id=${s.id}">
          ${contenuto}${icona(ChevronRight)}
        </a>`
      : `<div class="tc-lista__riga">${contenuto}</div>`;
  };

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Servizi', officina)}
    <div class="tc-contenuto">
      ${avvisoConferma()}
      <p class="text-body-secondary mb-0">
        I clienti li vedono nella scheda dell'officina e li scelgono quando chiedono un appuntamento.
        Prezzi e durate sono indicativi.
      </p>
      ${
        titolare
          ? `<a class="btn btn-primary btn-lg w-100" href="/servizi/nuovo">
              ${icona(Plus)} Nuovo servizio
            </a>`
          : ''
      }
      ${
        servizi.length
          ? `<div class="tc-lista">${servizi.map(riga).join('')}</div>`
          : `<div class="tc-vuoto">
              <span class="tc-vuoto__icona">${icona(ClipboardList)}</span>
              <p class="tc-vuoto__titolo">Ancora nessun servizio</p>
              <p class="tc-vuoto__testo">
                ${
                  titolare
                    ? 'Aggiungi i servizi che i clienti possono prenotare (es. cambio gomme, convergenza).'
                    : "Il titolare dell'officina non ha ancora inserito i servizi."
                }
              </p>
            </div>`
      }
    </div>`);
}

/** Campi del modulo servizio (nuovo o da modificare). */
function campiServizio(s?: ServizioOfficina): string {
  return `
    ${campo({ nome: 'nome', etichetta: 'Nome del servizio', tipo: 'text', autocomplete: 'off', valore: s?.nome })}
    ${areaTesto({
      nome: 'descrizione',
      etichetta: 'Descrizione (facoltativa)',
      aiuto: 'Cosa comprende, in una o due frasi.',
      valore: s?.descrizione,
    })}
    <div class="tc-auth__coppia">
      ${campo({
        nome: 'durata_minuti',
        etichetta: 'Durata in minuti (facoltativa)',
        tipo: 'text',
        autocomplete: 'off',
        valore: s?.durata_minuti != null ? String(s.durata_minuti) : '',
        attributi: 'inputmode="numeric" maxlength="3"',
        unita: 'min',
      })}
      ${campo({
        nome: 'prezzo_da',
        etichetta: 'Prezzo da (facoltativo)',
        tipo: 'text',
        autocomplete: 'off',
        aiuto: 'Vuoto = su preventivo.',
        valore: s?.prezzo_da != null ? String(s.prezzo_da).replace('.', ',') : '',
        attributi: 'inputmode="decimal" maxlength="10"',
        unita: '€',
      })}
    </div>
    ${caselle({
      nome: 'prenotabile',
      etichetta: 'Prenotazioni',
      opzioni: [['SI', "Prenotabile dall'app"]],
      selezionate: !s || s.prenotabile ? ['SI'] : [],
      aiuto: 'Se togli la spunta il servizio resta nel catalogo, ma i clienti non lo vedono.',
    })}`;
}

/** Contesto per le pagine di modifica: l'officina attiva, solo se l'utente ne è TITOLARE. */
export async function officinaDelTitolare(): Promise<string | null> {
  const contesto = await caricaContestoOfficina();
  const id = contesto.attiva.officina.id;
  return eTitolare(contesto.officine, id) ? id : null;
}

export const SOLO_TITOLARE = `
  <div class="tc-contenuto pt-4">
    <p>Questa pagina è riservata al titolare dell'officina.</p>
    <a class="btn btn-outline-light btn-lg w-100" href="/">Torna alla home</a>
  </div>`;

export async function mostraNuovoServizio(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let officinaId: string | null;
  try {
    officinaId = await officinaDelTitolare();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!officinaId) {
    app.innerHTML = paginaApp(SOLO_TITOLARE);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Nuovo servizio', 'Servizi')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campiServizio()}
        ${pulsanteInvio('Salva servizio', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/servizi">Annulla</a>
      </form>
    </div>`);

  const id = officinaId;
  collegaModulo(app.querySelector('form')!, ServizioSchema, async (servizio) => {
    await creaServizio(id, servizio);
    vaiConConferma('/servizi', 'Servizio salvato.');
  });
}

export async function mostraModificaServizio(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const id = parametro('id');
  let officinaId: string | null;
  let servizio: ServizioOfficina | null = null;
  try {
    officinaId = await officinaDelTitolare();
    if (idValido(id)) servizio = await caricaServizio(id);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!servizio || servizio.officina_id !== officinaId) {
    app.innerHTML = paginaApp(
      officinaId ? nonTrovato('Servizio non trovato', 'Il servizio') : SOLO_TITOLARE,
    );
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Modifica servizio', 'Servizi')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${campiServizio(servizio)}
        ${pulsanteInvio('Salva modifiche', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/servizi">Annulla</a>
      </form>
      ${pulsanteElimina('Elimina servizio')}
    </div>`);

  const s = servizio;
  collegaModulo(app.querySelector('form')!, ServizioSchema, async (dati) => {
    await modificaServizio(s.id, dati);
    vaiConConferma('/servizi', 'Servizio aggiornato.');
  });
  collegaElimina(app, {
    titolo: 'Eliminare il servizio?',
    testo: `"${s.nome}" sparisce dal catalogo. Le prenotazioni già fatte restano, con il nome del servizio.`,
    pulsante: 'Elimina servizio',
    azione: async () => {
      await eliminaServizio(s.id);
      vaiConConferma('/servizi', 'Servizio eliminato.');
    },
  });
}
