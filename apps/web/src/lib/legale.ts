import {
  DATI_FORNITORE,
  SITO_URL,
  datiFornitoreCompleti,
  type DatiFornitore,
} from '@tyrecare/shared';
import { marked } from 'marked';

// La costante vive in `shared` (leggera): `lib/auth.ts` è nel file iniziale e non deve portarsi `marked`
export { VERSIONE_TERMINI } from '@tyrecare/shared';

/**
 * Vero quando i dati di chi offre TyreCare (`DATI_FORNITORE` in `packages/shared/src/fornitore.ts`) sono
 * stati tutti compilati. Finché è falso le pagine /privacy, /termini e /cookie mostrano `AVVISO_DATI`.
 */
export const TESTI_LEGALI_DEFINITIVI = datiFornitoreCompleti();

export const AVVISO_DATI =
  'Stiamo completando i dati identificativi di chi offre TyreCare: i campi tra parentesi quadre verranno compilati prima del lancio.';

const DESTINAZIONI: Record<string, string> = {
  'informativa-privacy.md': '/privacy',
  'termini-di-servizio.md': '/termini',
  'cookie-policy.md': '/cookie',
};

/** Valori che sostituiscono i segnaposto `{{…}}` dei testi in `DOCS/legale/`. */
export function valoriSegnaposto(dati: DatiFornitore = DATI_FORNITORE): Record<string, string> {
  return {
    'fornitore.nome': dati.nome,
    'fornitore.indirizzo': dati.indirizzo,
    'fornitore.partitaIva': dati.partitaIva,
    'fornitore.registroImprese': dati.registroImprese,
    'fornitore.emailContatti': dati.emailContatti,
    'fornitore.emailPrivacy': dati.emailPrivacy,
    'fornitore.pec': dati.pec,
    'sito.url': SITO_URL,
  };
}

/**
 * Sostituisce i segnaposto `{{fornitore.nome}}`, `{{sito.url}}` ecc. con i valori della configurazione.
 * Le parentesi quadre dei valori non ancora compilati sono protette (`\[`), così Markdown non le legge
 * come l'inizio di un link. Un segnaposto sconosciuto resta com'è, ben visibile.
 */
export function compilaSegnaposto(
  markdown: string,
  valori: Record<string, string> = valoriSegnaposto(),
): string {
  return markdown.replace(/\{\{([a-zA-Z.]+)\}\}/g, (intero, chiave: string) => {
    const valore = valori[chiave];
    return valore === undefined ? intero : valore.replace(/([[\]])/g, '\\$1');
  });
}

/**
 * Riscrive i link ai file `.md` nell'HTML prodotto da `marked`: informativa, termini e cookie policy
 * puntano alle pagine dell'app, gli altri file `.md` (non pubblicati) diventano testo semplice. I link
 * esterni (http, https, mailto) e le ancore restano com'erano.
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

/** I link verso altri siti (http, https) si aprono in una scheda nuova, senza passare il referrer. */
export function apriFuori(html: string): string {
  return html.replace(
    /<a href="(https?:\/\/[^"]*)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer"',
  );
}

/**
 * Da Markdown a HTML per le pagine legali. SICUREZZA: l'HTML risultante viene solo dai file del
 * repository (`DOCS/legale/`) e dalla configurazione (`DATI_FORNITORE`), mai da dati degli utenti: per
 * questo si può inserire con `innerHTML`. Non usare questa funzione con testo che arriva dal database
 * o dall'utente. Il titolo principale (h1) riceve `tabindex="-1"`, così il router può metterci il focus.
 */
export function legaleInHtml(markdown: string): string {
  const html = marked.parse(compilaSegnaposto(markdown), { async: false });
  return apriFuori(riscriviLink(html)).replace(/<h1(?=[\s>])/, '<h1 tabindex="-1"');
}
