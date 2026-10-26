import { paginaAuth } from '../ui/layout';

/** Segnaposto: lo riempie il compito T055 (riscrive questo file; la rotta è già in main.ts). */
export function mostraPrivacy(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Informativa privacy',
    sottotitolo: 'Pagina in preparazione.',
    corpo: '<a class="btn btn-primary btn-lg w-100" href="/">Torna alla home</a>',
  });
}

export function mostraTermini(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Termini di servizio',
    sottotitolo: 'Pagina in preparazione.',
    corpo: '<a class="btn btn-primary btn-lg w-100" href="/">Torna alla home</a>',
  });
}
