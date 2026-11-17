// Dati di chi offre TyreCare e indirizzo del sito di presentazione: l'UNICO punto in cui si scrivono.
// Li usano le pagine legali dell'app (/privacy, /termini, /cookie), che li inseriscono nei testi di
// `DOCS/legale/` al posto dei segnaposto `{{fornitore.nome}}`, `{{sito.url}}` ecc.
//
// PRIMA DEL LANCIO: sostituire ogni valore tra parentesi quadre con il dato vero (elenco e spiegazioni
// in `DOCS/legale/README.md`). Finché ne resta anche solo uno, le pagine legali mostrano un avviso.

export interface DatiFornitore {
  /** Nome e cognome (ditta individuale / libero professionista) o ragione sociale con forma giuridica. */
  nome: string;
  /** Sede legale o domicilio fiscale: via e numero, CAP, città, provincia. */
  indirizzo: string;
  /** Partita IVA (11 cifre). Obbligatoria nel sito: art. 35 DPR 633/1972 e art. 7 D.Lgs. 70/2003. */
  partitaIva: string;
  /** Numero REA e ufficio del registro delle imprese; per chi non è iscritto: «non iscritto al registro delle imprese». */
  registroImprese: string;
  /** Email per le richieste generali e commerciali. */
  emailContatti: string;
  /** Email per le richieste sui dati personali (può coincidere con quella dei contatti). */
  emailPrivacy: string;
  /** Posta elettronica certificata. */
  pec: string;
}

export const DATI_FORNITORE: DatiFornitore = {
  nome: '[Nome e cognome / ragione sociale]',
  indirizzo: '[Indirizzo della sede: via, CAP, città, provincia]',
  partitaIva: '[Partita IVA]',
  registroImprese: '[Numero REA e registro delle imprese]',
  emailContatti: '[Email di contatto]',
  emailPrivacy: '[Email per la privacy]',
  pec: '[PEC]',
};

/**
 * Indirizzo del sito di presentazione di TyreCare (prezzi e funzioni per le officine).
 * Per ora è l'indirizzo di prova su Vercel (repository TyreCare-v2-website).
 * DA CONFERMARE: il dominio definitivo non è ancora deciso; quando lo è, cambiarlo solo qui.
 */
export const SITO_URL = 'https://tyrecare-v2-website.vercel.app';

/** Vero se un valore è ancora un segnaposto da compilare (testo tra parentesi quadre). */
export const eSegnaposto = (valore: string): boolean => /^\[.*\]$/.test(valore.trim());

/** Vero quando tutti i dati del fornitore sono stati compilati (nessun segnaposto rimasto). */
export function datiFornitoreCompleti(dati: DatiFornitore = DATI_FORNITORE): boolean {
  return Object.values(dati).every((v) => v.trim() !== '' && !eSegnaposto(v));
}

/** Indirizzo del sito senza schema né barra finale, da mostrare come testo (es. `tyrecare.it`). */
export const sitoLeggibile = (url: string = SITO_URL): string =>
  url.replace(/^https?:\/\//, '').replace(/\/$/, '');
