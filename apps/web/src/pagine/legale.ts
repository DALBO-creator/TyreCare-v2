import informativa from '../../../../DOCS/legale/informativa-privacy.md?raw';
import termini from '../../../../DOCS/legale/termini-di-servizio.md?raw';
import { AVVISO_BOZZA, legaleInHtml, TESTI_LEGALI_DEFINITIVI } from '../lib/legale';
import { MARCHIO } from '../ui/layout';

/** Vero se `referrer` è una pagina della stessa origine (schema, host e porta) di `origine`. */
export function referrerStessoSito(referrer: string, origine: string): boolean {
  try {
    return new URL(referrer).origin === origine;
  } catch {
    return false;
  }
}

/** Pagina pubblica con un testo legale; il contenuto viene solo dai file del repository. */
function mostraLegale(app: HTMLElement, markdown: string): void {
  const avviso = TESTI_LEGALI_DEFINITIVI
    ? ''
    : `<div class="tc-avviso tc-avviso--giallo" role="status"><p class="mb-0">${AVVISO_BOZZA}</p></div>`;
  app.innerHTML = `
    <main class="tc-auth tc-legale">
      <a class="tc-auth__marchio" href="/" aria-label="TyreCare, home">${MARCHIO}</a>
      <article class="tc-legale__testo">
        <p><a class="tc-legale__indietro" href="/">Torna indietro</a></p>
        ${avviso}
        ${legaleInHtml(markdown)}
      </article>
    </main>`;
  app.querySelector<HTMLAnchorElement>('.tc-legale__indietro')?.addEventListener('click', (e) => {
    // Si torna indietro solo se la pagina precedente è del sito; altrimenti il link porta alla home.
    if (referrerStessoSito(document.referrer, location.origin)) {
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
