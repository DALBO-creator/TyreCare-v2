import { Car, MapPin, Wrench } from 'lucide';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  ETICHETTE_AREA,
  ETICHETTE_RUOLO_OFFICINA,
  ETICHETTE_STATO_OFFICINA,
  gestisciErroreCaricamento,
} from './comune';

/** Home dopo l'accesso. I veicoli arriveranno in Fase 2: per ora saluto e officine dell'utente. */
export async function mostraHome(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let dati: DatiUtente;
  try {
    dati = await caricaDatiUtente();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const { profilo, officine } = dati;
  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">${ETICHETTE_AREA[profilo.ruolo]}</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">
        Ciao${profilo.nome ? `, ${esc(profilo.nome)}` : ''}
      </h1>
    </section>

    <div class="tc-contenuto">
      ${officine.length > 0 ? sezioneOfficine(dati) : sezioneVeicoli()}
    </div>`);
}

function sezioneVeicoli(): string {
  return `
    <section aria-labelledby="tc-veicoli">
      <h2 id="tc-veicoli" class="tc-etichetta">I tuoi veicoli</h2>
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(Car)}</span>
        <p class="tc-vuoto__titolo">Ancora nessun veicolo</p>
        <p class="tc-vuoto__testo">
          Quando la tua officina registrerà un controllo, qui vedrai lo stato dei tuoi pneumatici.
        </p>
      </div>
    </section>`;
}

function sezioneOfficine({ officine }: DatiUtente): string {
  return `
    <section aria-labelledby="tc-officine">
      <h2 id="tc-officine" class="tc-etichetta">${officine.length > 1 ? 'Le tue officine' : 'La tua officina'}</h2>
      <div class="tc-lista">
        ${officine
          .map(
            ({ ruolo, officina }) => `
          <div class="tc-lista__riga">
            <span class="tc-lista__icona">${icona(Wrench)}</span>
            <span class="tc-lista__testo">
              ${esc(officina.ragione_sociale)}
              <small>${icona(MapPin)} ${esc(officina.citta) || '—'} · ${ETICHETTE_RUOLO_OFFICINA[ruolo]}</small>
            </span>
            <span class="tc-stato-officina tc-stato-officina--${officina.stato_affiliazione.toLowerCase()}">
              ${ETICHETTE_STATO_OFFICINA[officina.stato_affiliazione]}
            </span>
          </div>`,
          )
          .join('')}
      </div>
      <p class="text-body-secondary small mt-3 mb-0">
        Garage dei clienti, controlli e prenotazioni arriveranno nelle prossime versioni.
      </p>
    </section>`;
}
