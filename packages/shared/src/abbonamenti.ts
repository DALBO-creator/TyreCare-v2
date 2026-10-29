import { z } from 'zod';

// Abbonamenti delle officine (tabella `abbonamenti`): piani, prezzi e giorni di prova.

export const PianoSchema = z.enum(['STARTER', 'PRO', 'PILOTA']);
export type Piano = z.infer<typeof PianoSchema>;

export const StatoAbbonamentoSchema = z.enum(['PROVA', 'ATTIVO', 'SCADUTO', 'ANNULLATO']);
export type StatoAbbonamento = z.infer<typeof StatoAbbonamentoSchema>;

export interface DescrizionePiano {
  nome: string;
  /** Euro al mese; `null` se il piano è gratuito. */
  prezzoMensile: number | null;
  funzioni: readonly string[];
}

/** Piani e prezzi (DOCS/PRODUZIONE-MARKETING.md §3, Modello 1). I prezzi stanno solo qui. */
export const PIANI: Record<Piano, DescrizionePiano> = {
  STARTER: {
    nome: 'Starter',
    prezzoMensile: 29,
    funzioni: [
      'Import dati',
      'Garage officina',
      'Storico e report',
      'Stato pneumatici',
      'Promemoria',
    ],
  },
  PRO: {
    nome: 'Pro',
    prezzoMensile: 49,
    funzioni: [
      'Tutto quello che c’è in Starter',
      'Prenotazioni',
      'Catalogo servizi',
      'Notifiche illimitate',
      'Statistiche',
    ],
  },
  PILOTA: {
    nome: 'Officina pilota',
    prezzoMensile: null,
    funzioni: ['Tutte le funzioni, gratis durante il pilota'],
  },
};

const giornoUTC = (iso: string): number => {
  const [a, m, g] = iso.split('-').map(Number);
  return Date.UTC(a!, m! - 1, g!);
};

/**
 * Giorni di prova rimasti. `provaFinoAl` è l'ULTIMO giorno della prova (incluso): oggi = ultimo giorno → 1,
 * il giorno dopo → 0. Mai negativo. Date pure (`AAAA-MM-GG`), calcolo con `Date.UTC` (niente fusi/ora legale).
 */
export function giorniDiProva(provaFinoAl: string, oggi: string): number {
  const giorni = Math.round((giornoUTC(provaFinoAl) - giornoUTC(oggi)) / 86_400_000) + 1;
  return Math.max(0, giorni);
}
