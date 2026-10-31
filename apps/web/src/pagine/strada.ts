import { paginaApp } from '../ui/layout';
import { intestazioneSottopagina } from './comune';

/** Segnaposto: lo riempie il compito T143 (riscrive questo file; la rotta è già in main.ts). */
export function mostraStrada(app: HTMLElement): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Aiuto su strada', 'Assistenza')}
    <div class="tc-contenuto">
      <p>Pagina in preparazione.</p>
      <a class="btn btn-outline-light btn-lg w-100" href="/">Torna alla home</a>
    </div>`);
}
