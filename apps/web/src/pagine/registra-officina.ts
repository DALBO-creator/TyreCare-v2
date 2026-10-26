import { paginaApp } from '../ui/layout';
import { intestazioneSottopagina } from './comune';

/** Segnaposto: lo riempie il compito T060 (riscrive questo file; la rotta è già in main.ts). */
export function mostraRegistraOfficina(app: HTMLElement): void {
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Registra la tua officina', 'Officina')}
    <div class="tc-contenuto">
      <p>Pagina in preparazione.</p>
      <a class="btn btn-outline-light btn-lg w-100" href="/">Torna alla home</a>
    </div>`);
}
