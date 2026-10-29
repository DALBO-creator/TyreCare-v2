import { SearchX } from 'lucide';
import { formattaTarga } from '@tyrecare/shared';
import { caricaReportPubblico, type Report } from '../lib/report';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento } from '../ui/layout';
import { parametro } from './comune';
import { htmlReport } from './report';

/**
 * Report di un controllo per chi apre il link dell'officina: `/r?c=<codice>`, anche senza account.
 * Stesso contenuto del report dell'app (`htmlReport`), ma senza menu, notifiche né dati dell'utente.
 */
export async function mostraReportPubblico(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = pagina(caricamento());

  const codice = parametro('c');
  let report: Report | null = null;
  try {
    if (codice) report = await caricaReportPubblico(codice);
  } catch {
    if (!ancoraAttuale(n)) return;
    app.innerHTML = pagina(
      messaggio('Non riusciamo a caricare il report', 'Controlla la connessione e riprova.', true),
    );
    app.querySelector('[data-riprova]')?.addEventListener('click', () => {
      void mostraReportPubblico(app);
    });
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!report) {
    app.innerHTML = pagina(
      messaggio(
        'Link non valido o scaduto',
        "Link non valido o scaduto. Chiedi all'officina un link nuovo.",
      ),
    );
    return;
  }

  // Il titolo diventa anche il nome del PDF quando si salva la stampa
  document.title = `Controllo ${formattaTarga(report.veicolo.targa)} ${report.eseguito_il} · TyreCare`;
  app.innerHTML = pagina(htmlReport(report, { membro: false, pubblico: true }));
  app.querySelector('[data-stampa]')?.addEventListener('click', () => window.print());
}

/** Contenitore senza menu né notifiche: chi apre il link non ha un account. */
function pagina(corpo: string): string {
  return `
    <header class="tc-appbar">
      <a class="text-decoration-none" href="/" aria-label="TyreCare, home">
        <span class="tc-marchio">Tyre<span>Care</span></span></a>
    </header>
    <main id="tc-principale" class="tc-pagina" tabindex="-1" data-pagina="modulo">${corpo}</main>`;
}

function messaggio(titolo: string, testo: string, riprova = false): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(SearchX)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">${titolo}</h1>
        <p class="tc-vuoto__testo" role="status">${testo}</p>
        ${
          riprova
            ? '<button type="button" class="btn btn-outline-light mt-3" data-riprova>Riprova</button>'
            : '<a class="btn btn-outline-light mt-3" href="/">Vai a TyreCare</a>'
        }
      </div>
    </div>`;
}
