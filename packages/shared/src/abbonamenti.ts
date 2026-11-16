import { z } from 'zod';

// Abbonamenti delle officine (tabella `abbonamenti`). I pagamenti avvengono fuori dall'app (bonifico e
// fattura): qui ci sono solo piani, prezzi di listino e calcoli sulle date. L'abbonamento lo aggiorna
// l'amministratore dal pannello `/admin`.

export const PianoSchema = z.enum(['MENSILE', 'ANNUALE']);
export type Piano = z.infer<typeof PianoSchema>;

export const StatoAbbonamentoSchema = z.enum(['PROVA', 'ATTIVO', 'SCADUTO', 'SOSPESO']);
export type StatoAbbonamento = z.infer<typeof StatoAbbonamentoSchema>;

export interface DescrizionePiano {
  nome: string;
  /** Euro per periodo, IVA esclusa. */
  prezzo: number;
  periodo: 'mese' | 'anno';
  /** Quanti mesi copre un periodo. */
  mesi: number;
  /** Frase breve sotto il prezzo ('' se non serve). */
  nota: string;
}

/**
 * Prezzi di listino, IVA esclusa. Stanno solo qui (per l'app) e nella funzione SQL
 * `listino_abbonamento` (per il ricavo stimato del cruscotto): se cambiano, si cambiano in entrambi.
 */
export const PIANI: Record<Piano, DescrizionePiano> = {
  MENSILE: { nome: 'Mensile', prezzo: 100, periodo: 'mese', mesi: 1, nota: '' },
  ANNUALE: { nome: 'Annuale', prezzo: 1000, periodo: 'anno', mesi: 12, nota: '2 mesi gratis' },
};

/** Installazione e avvio dell'officina: una tantum, IVA esclusa. */
export const PREZZO_INSTALLAZIONE = 149;

/** Giorni di prova gratuita, contando il giorno dell'attivazione. */
export const GIORNI_PROVA = 30;

/** Cosa comprende l'abbonamento (uguale per i due piani). */
export const FUNZIONI_INCLUSE: readonly string[] = [
  'Import di clienti, veicoli e controlli dal tuo gestionale',
  'Garage dell’officina, storico e report dei controlli',
  'Stato degli pneumatici e promemoria automatici ai clienti',
  'Prenotazioni online, calendario e catalogo dei servizi',
  'Richieste di aiuto su strada',
  'App per i tuoi clienti, senza limiti di numero',
  'Assistenza e aggiornamenti',
];

/** 100 → "100 €", 83.33 → "83,33 €". */
export function formattaEuro(importo: number): string {
  const intero = Number.isInteger(importo);
  return `${importo.toLocaleString('it-IT', {
    minimumFractionDigits: intero ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}

/** "100 €/mese" o "1000 €/anno"; con `importo` usa quello concordato al posto del listino. */
export function prezzoPiano(piano: Piano, importo?: number | null): string {
  const p = PIANI[piano];
  return `${formattaEuro(importo ?? p.prezzo)}/${p.periodo}`;
}

/** Ricavo al mese di un abbonamento: l'importo (concordato o di listino) diviso per i mesi del piano. */
export function ricavoMensile(piano: Piano, importo?: number | null): number {
  const p = PIANI[piano];
  return (importo ?? p.prezzo) / p.mesi;
}

const giornoUTC = (iso: string): number => {
  const [a, m, g] = iso.split('-').map(Number);
  return Date.UTC(a!, m! - 1, g!);
};

/**
 * Giorni rimasti fino a `ultimoGiorno` INCLUSO: oggi = ultimo giorno → 1, il giorno dopo → 0. Mai negativo.
 * Date pure (`AAAA-MM-GG`), calcolo con `Date.UTC` (niente fusi/ora legale). Vale per la prova
 * (`prova_fino_al`) e per l'abbonamento (`scade_il`).
 */
export function giorniRimasti(ultimoGiorno: string, oggi: string): number {
  const giorni = Math.round((giornoUTC(ultimoGiorno) - giornoUTC(oggi)) / 86_400_000) + 1;
  return Math.max(0, giorni);
}

/** Giorni di prova rimasti (vedi {@link giorniRimasti}). */
export const giorniDiProva = giorniRimasti;
