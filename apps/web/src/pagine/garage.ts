import { caricaGarage, type VeicoloGarage } from '../lib/garage';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { gestisciErroreCaricamento } from './comune';
import { sezioneVeicoli } from './home';

/** «Il tuo garage»: i veicoli di chi lavora in officina ed è anche cliente (raggiunta dalla sua home). */
export async function mostraGarage(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let garage: VeicoloGarage[];
  try {
    garage = await caricaGarage();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">Il tuo garage</h1>
    </section>

    <div class="tc-contenuto">
      ${sezioneVeicoli(garage)}
    </div>`);
}
