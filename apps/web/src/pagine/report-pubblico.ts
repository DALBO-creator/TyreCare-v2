import { paginaAuth } from '../ui/layout';

/** Segnaposto: lo riempie il compito T064 (riscrive questo file; la rotta è già in main.ts). */
export function mostraReportPubblico(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Report del controllo',
    sottotitolo: 'Pagina in preparazione.',
    corpo: '<a class="btn btn-primary btn-lg w-100" href="/">Torna alla home</a>',
  });
}
