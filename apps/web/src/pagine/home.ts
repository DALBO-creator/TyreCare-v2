import { Car, ChevronRight, CircleDashed } from 'lucide';
import { formattaTarga } from '@tyrecare/shared';
import { caricaGarage, type VeicoloGarage } from '../lib/garage';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { esc } from '../lib/html';
import { gommeVecchie } from '../lib/salute';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { STATI, badgeStato } from '../ui/stato';
import { ETICHETTE_AREA, avvisoConferma, conData, gestisciErroreCaricamento, oggi } from './comune';
import { mostraHomeOfficina } from './home-officina';

/** Home dopo l'accesso: per chi lavora in un'officina l'elenco dei veicoli, per il cliente il garage. */
export async function mostraHome(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  // Il garage si carica insieme ai dati dell'utente: per chi lavora in officina resta inutilizzato
  let dati: DatiUtente;
  let garage: VeicoloGarage[];
  try {
    [dati, garage] = await Promise.all([caricaDatiUtente(), caricaGarage()]);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (dati.officine.length > 0) return mostraHomeOfficina(app, n, dati);

  const { profilo } = dati;
  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">${ETICHETTE_AREA[profilo.ruolo]}</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">
        Ciao${profilo.nome ? `, ${esc(profilo.nome)}` : ''}
      </h1>
    </section>

    <div class="tc-contenuto">
      ${avvisoConferma()}
      ${sezioneVeicoli(garage)}
      <p class="text-center mt-4">
        <a href="/officina/registra">Hai un'officina? Registrala su TyreCare</a>
      </p>
    </div>`);
}

function sezioneVeicoli(garage: VeicoloGarage[]): string {
  return `
    <section aria-labelledby="tc-veicoli">
      <h2 id="tc-veicoli" class="tc-etichetta">I tuoi veicoli</h2>
      ${
        garage.length > 0
          ? `<ul class="tc-garage">${garage.map((v) => `<li>${cartaVeicolo(v)}</li>`).join('')}</ul>`
          : `<div class="tc-vuoto">
              <span class="tc-vuoto__icona">${icona(Car)}</span>
              <p class="tc-vuoto__titolo">Ancora nessun veicolo</p>
              <p class="tc-vuoto__testo">
                Chiedi alla tua officina di invitarti: dal link che ti manda per email colleghi i
                tuoi veicoli e qui vedrai lo stato dei tuoi pneumatici.
              </p>
            </div>`
      }
    </section>`;
}

/** Un veicolo del garage: tutta la carta è un solo collegamento alla sua scheda. */
function cartaVeicolo(v: VeicoloGarage): string {
  const ultimo = v.controlli[0];
  const vecchie = gommeVecchie(v.pneumatici, oggi());
  const classe = v.stato ? ` tc-garage__carta--${STATI[v.stato].classe}` : '';
  return `
    <a class="tc-garage__carta${classe}" href="/garage/veicolo?targa=${encodeURIComponent(v.targa)}">
      <span class="tc-garage__testa">
        <span class="tc-etichetta">${esc(v.marca) || 'Veicolo'}</span>
        <span class="tc-garage__modello">${esc(v.modello || formattaTarga(v.targa))}</span>
        <span class="tc-targa">${esc(formattaTarga(v.targa))}</span>
      </span>
      <span class="tc-garage__piede">
        ${
          v.stato
            ? badgeStato(v.stato)
            : `<span class="tc-stato tc-stato--nessuno">${icona(CircleDashed)}Nessun controllo</span>`
        }
        ${
          ultimo
            ? `<small>Controllo ${esc(conData('del', ultimo.eseguito_il))}${
                ultimo.officina ? ` · ${esc(ultimo.officina)}` : ''
              }</small>`
            : ''
        }
        ${
          vecchie > 0
            ? `<small>${vecchie === 1 ? '1 gomma ha' : `${vecchie} gomme hanno`} più di 5 anni</small>`
            : ''
        }
      </span>
      ${icona(ChevronRight)}
    </a>`;
}
