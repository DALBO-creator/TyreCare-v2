import { scriviCsv } from './importa';
import { COLONNE_CONTROLLI } from './importa-controlli';
import { FUSO } from './prenotazioni';
import { PosizioneSchema, type Posizione, type Stagione, type Usura } from './pneumatici';

// Esportazione dei controlli (T041): una riga per pneumatico misurato, nel formato dell'import dei
// controlli (`COLONNE_CONTROLLI`), così il file scaricato si reimporta.

/** Misura di uno pneumatico in un controllo, già unita ai dati del controllo, dello pneumatico e della targa. */
export interface MisuraDaEsportare {
  codice_documento: string | null;
  targa: string;
  /** `AAAA-MM-GG` oppure un timestamp ISO (in quel caso la data è quella italiana). */
  eseguito_il: string;
  km: number | null;
  posizione: Posizione;
  battistrada_mm: number;
  pressione_bar: number | null;
  usura: Usura | null;
  danni: string;
  stagione: Stagione;
  misura: string;
  marca: string;
  modello: string;
  dot: string | null;
  note: string;
}

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** `AAAA-MM-GG`: una data semplice resta com'è; un timestamp diventa il giorno nel fuso di Roma. */
function dataItaliana(valore: string): string {
  if (SOLO_DATA.test(valore)) return valore;
  const d = new Date(valore);
  if (Number.isNaN(d.getTime())) return valore;
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d);
}

/** Numero con la virgola decimale (`4,5`), come lo legge Excel in italiano; nullo → vuoto. */
const conVirgola = (n: number | null): string => (n == null ? '' : String(n).replace('.', ','));

/**
 * Tutte le misure nel formato dell'import dei controlli (stessa intestazione di `COLONNE_CONTROLLI`).
 * Decimali con la virgola, valori nulli vuoti, data `AAAA-MM-GG`. Ordine: data, targa, codice documento (le righe di un documento restano vicine), posizione
 * (anteriore sinistra, anteriore destra, posteriore sinistra, posteriore destra, scorta).
 */
export function csvControlli(righe: readonly MisuraDaEsportare[]): string {
  const ordinePosizione = (p: Posizione) => PosizioneSchema.options.indexOf(p);
  const voci = righe.map((r) => ({ r, data: dataItaliana(r.eseguito_il) }));
  voci.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.r.targa.localeCompare(b.r.targa, 'it') ||
      (a.r.codice_documento ?? '').localeCompare(b.r.codice_documento ?? '', 'it') ||
      ordinePosizione(a.r.posizione) - ordinePosizione(b.r.posizione),
  );
  const corpo = voci.map(({ r, data }) => [
    r.codice_documento ?? '',
    r.targa,
    data,
    r.km == null ? '' : String(r.km),
    r.posizione,
    conVirgola(r.battistrada_mm),
    conVirgola(r.pressione_bar),
    r.usura ?? '',
    r.danni,
    r.stagione,
    r.misura,
    r.marca,
    r.modello,
    r.dot ?? '',
    r.note,
  ]);
  return scriviCsv([[...COLONNE_CONTROLLI], ...corpo]);
}
