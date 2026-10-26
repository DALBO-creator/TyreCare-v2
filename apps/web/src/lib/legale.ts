import { marked } from 'marked';

/**
 * Mettere `true` solo dopo la revisione legale dei testi in `DOCS/legale/`: finché è `false`
 * le pagine /privacy e /termini mostrano l'avviso "Testo in bozza".
 */
export const TESTI_LEGALI_DEFINITIVI = false;

/** Versione dei termini che l'utente accetta alla registrazione (la usa T056). */
export const VERSIONE_TERMINI = '2026-10-bozza';

export const AVVISO_BOZZA =
  'Testo in bozza: la versione definitiva arriverà dopo la revisione legale.';

const DESTINAZIONI: Record<string, string> = {
  'informativa-privacy.md': '/privacy',
  'termini-di-servizio.md': '/termini',
};

/**
 * Riscrive i link ai file `.md` nell'HTML prodotto da `marked`: informativa e termini puntano alle
 * pagine dell'app, gli altri file `.md` (non pubblicati) diventano testo semplice. I link esterni
 * (http, https, mailto) e le ancore restano com'erano.
 */
export function riscriviLink(html: string): string {
  return html.replace(
    /<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,
    (intero, href: string, resto: string, testo: string) => {
      const [file = '', ancora] = href.split('#');
      if (!/^[^:/]+\.md$/i.test(file)) return intero;
      const pagina = DESTINAZIONI[file];
      if (!pagina) return testo;
      return `<a href="${pagina}${ancora ? `#${ancora}` : ''}"${resto}>${testo}</a>`;
    },
  );
}

/**
 * Da Markdown a HTML per le pagine legali. SICUREZZA: l'HTML risultante viene solo dai due file
 * del repository (`DOCS/legale/`), mai da dati degli utenti: per questo si può inserire con
 * `innerHTML`. Non usare questa funzione con testo che arriva dal database o dall'utente.
 * Il titolo principale (h1) riceve `tabindex="-1"`, così il router può metterci il focus.
 */
export function legaleInHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return riscriviLink(html).replace(/<h1(?=[\s>])/, '<h1 tabindex="-1"');
}
