import informativa from '../../../../DOCS/legale/informativa-privacy.md?raw';
import termini from '../../../../DOCS/legale/termini-di-servizio.md?raw';
import { AVVISO_BOZZA, legaleInHtml, TESTI_LEGALI_DEFINITIVI } from '../lib/legale';

/** Pagina pubblica con un testo legale; il contenuto viene solo dai file del repository. */
function mostraLegale(app: HTMLElement, markdown: string): void {
  const avviso = TESTI_LEGALI_DEFINITIVI
    ? ''
    : `<div class="tc-avviso tc-avviso--giallo" role="status"><p class="mb-0">${AVVISO_BOZZA}</p></div>`;
  app.innerHTML = `
    <main class="tc-auth tc-legale">
      <a class="tc-auth__marchio" href="/" aria-label="TyreCare, home"><span class="tc-marchio">Tyre<span>Care</span></span></a>
      <article class="tc-legale__testo">
        <p><a class="tc-legale__indietro" href="/">Torna indietro</a></p>
        ${avviso}
        ${legaleInHtml(markdown)}
      </article>
    </main>`;
  app.querySelector<HTMLAnchorElement>('.tc-legale__indietro')?.addEventListener('click', (e) => {
    // Se c'è una pagina precedente si torna lì, altrimenti il link porta alla home.
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

export function mostraPrivacy(app: HTMLElement): void {
  mostraLegale(app, informativa);
}

export function mostraTermini(app: HTMLElement): void {
  mostraLegale(app, termini);
}
