import { paginaApp } from '../ui/layout';
import { intestazioneSottopagina } from './comune';

/** Segnaposto: lo riempie il compito T144 (riscrive questo file; la rotta è già in main.ts). */
export function mostraStradaOfficina(app: HTMLElement): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Richieste su strada', 'Officina')}
    <div class="tc-contenuto">
      <p>Pagina in preparazione.</p>
      <a class="btn btn-outline-light btn-lg w-100" href="/">Torna alla home</a>
    </div>`);
}
