import { paginaAuth } from '../ui/layout';

/** Segnaposto: lo riempie il compito T062 (riscrive questo file; la rotta è già in main.ts). */
export function mostraPerLeOfficine(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'TyreCare per le officine',
    sottotitolo: 'Pagina in preparazione.',
    corpo: '<a class="btn btn-primary btn-lg w-100" href="/">Torna alla home</a>',
  });
}
