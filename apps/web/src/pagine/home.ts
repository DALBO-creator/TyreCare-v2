import { Car } from 'lucide';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { ETICHETTE_AREA, gestisciErroreCaricamento } from './comune';
import { mostraHomeOfficina } from './home-officina';

/** Home dopo l'accesso: per chi lavora in un'officina l'elenco dei veicoli, per il cliente il garage. */
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
      ${sezioneVeicoli()}
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
