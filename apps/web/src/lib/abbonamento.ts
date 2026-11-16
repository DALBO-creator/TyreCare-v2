import {
  GIORNI_PROVA,
  PIANI,
  PianoSchema,
  StatoAbbonamentoSchema,
  giorniRimasti,
  prezzoPiano,
  type Piano,
  type StatoAbbonamento,
} from '@tyrecare/shared';
import { getSupabase } from './supabase';

// Abbonamento dell'officina, in sola lettura: lo aggiorna l'amministratore dal pannello `/admin` quando
// riceve il pagamento (bonifico). Nell'app non si paga niente.

export interface AbbonamentoOfficina {
  piano: Piano;
  stato: StatoAbbonamento;
  /** Ultimo giorno della prova (`AAAA-MM-GG`, incluso). */
  prova_fino_al: string;
  /** Primo giorno dell'abbonamento pagato. */
  iniziato_il: string | null;
  /** Ultimo giorno pagato (incluso). */
  scade_il: string | null;
  installazione_pagata: boolean;
  installazione_pagata_il: string | null;
  /** Euro per periodo del piano; `null` = prezzo di listino. */
  importo_concordato: number | null;
}

const COLONNE =
  'piano, stato, prova_fino_al, iniziato_il, scade_il, installazione_pagata, installazione_pagata_il, importo_concordato';

/** Abbonamento dell'officina; lo leggono solo il titolare e l'amministratore. `null` se non esiste. */
export async function caricaAbbonamento(officinaId: string): Promise<AbbonamentoOfficina | null> {
  const { data, error } = await getSupabase()
    .from('abbonamenti')
    .select(COLONNE)
    .eq('officina_id', officinaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // `piano` e `stato` sono text con check: un valore sconosciuto (database più nuovo dell'app) non rompe la pagina
  const piano = PianoSchema.safeParse(data.piano);
  const stato = StatoAbbonamentoSchema.safeParse(data.stato);
  return {
    ...data,
    piano: piano.success ? piano.data : 'MENSILE',
    stato: stato.success ? stato.data : 'SCADUTO',
  };
}

/** Etichetta breve dello stato (badge). */
export const ETICHETTE_STATO_ABBONAMENTO: Record<StatoAbbonamento, string> = {
  PROVA: 'In prova',
  ATTIVO: 'Attivo',
  SCADUTO: 'Scaduto',
  SOSPESO: 'Sospeso',
};

/** Colore del badge (`.tc-stato--<colore>`): mai solo il colore, c'è sempre l'etichetta. */
export const COLORE_STATO_ABBONAMENTO: Record<
  StatoAbbonamento,
  'verde' | 'giallo' | 'rosso' | 'nessuno'
> = {
  PROVA: 'giallo',
  ATTIVO: 'verde',
  SCADUTO: 'rosso',
  SOSPESO: 'nessuno',
};

/** Sotto questa soglia di giorni un abbonamento attivo è "in scadenza". */
export const GIORNI_AVVISO_SCADENZA = 30;

export interface RiassuntoAbbonamento {
  /** Frase principale, es. "Abbonamento attivo fino al 13 dicembre 2026". */
  titolo: string;
  /** Spiegazione e cosa fare ('' se non serve). */
  dettaglio: string;
  /** Tono dell'avviso: `ok` niente da fare, `attenzione` sta per finire, `azione` serve rinnovare. */
  tono: 'ok' | 'attenzione' | 'azione';
}

const quantiGiorni = (giorni: number): string =>
  giorni === 1 ? 'manca 1 giorno' : `mancano ${giorni} giorni`;

/**
 * Stato dell'abbonamento in parole, per il titolare. `formatta` trasforma `AAAA-MM-GG` nella data per
 * esteso (si passa da fuori: questa funzione resta senza dipendenze dalla pagina).
 */
export function riassuntoAbbonamento(
  a: Pick<AbbonamentoOfficina, 'stato' | 'prova_fino_al' | 'scade_il'>,
  oggi: string,
  formatta: (iso: string) => string,
): RiassuntoAbbonamento {
  switch (a.stato) {
    case 'PROVA': {
      const giorni = giorniRimasti(a.prova_fino_al, oggi);
      if (giorni === 0) {
        return {
          titolo: 'La prova gratuita è finita',
          dettaglio: 'Scrivici per attivare l’abbonamento.',
          tono: 'azione',
        };
      }
      return {
        titolo: `Prova gratuita: ${quantiGiorni(giorni)}`,
        dettaglio: `Puoi usare tutte le funzioni fino al ${formatta(a.prova_fino_al)}. Per continuare dopo la prova, scrivici.`,
        tono: giorni <= 7 ? 'attenzione' : 'ok',
      };
    }
    case 'ATTIVO': {
      if (!a.scade_il) return { titolo: 'Abbonamento attivo', dettaglio: '', tono: 'ok' };
      const giorni = giorniRimasti(a.scade_il, oggi);
      const inScadenza = giorni <= GIORNI_AVVISO_SCADENZA;
      return {
        titolo: `Abbonamento attivo fino al ${formatta(a.scade_il)}`,
        dettaglio: inScadenza
          ? `Alla scadenza ${quantiGiorni(giorni)}: scrivici per rinnovare.`
          : 'Non devi fare nulla.',
        tono: inScadenza ? 'attenzione' : 'ok',
      };
    }
    case 'SCADUTO':
      return {
        titolo: a.scade_il
          ? `Abbonamento scaduto il ${formatta(a.scade_il)}`
          : 'La prova gratuita è finita',
        dettaglio: a.scade_il ? 'Scrivici per rinnovarlo.' : 'Scrivici per attivare l’abbonamento.',
        tono: 'azione',
      };
    case 'SOSPESO':
      return {
        titolo: 'Abbonamento sospeso',
        dettaglio: 'La tua officina non è visibile ai clienti. Scrivici per riattivarla.',
        tono: 'azione',
      };
  }
}

/** Riga del piano: "Mensile · 100 €/mese" (con l'importo concordato, se c'è). */
export function descrizionePiano(
  a: Pick<AbbonamentoOfficina, 'piano' | 'importo_concordato'>,
): string {
  return `${PIANI[a.piano].nome} · ${prezzoPiano(a.piano, a.importo_concordato)}`;
}

/** Testo già pronto dell'email a TyreCare, con i dati dell'officina. */
export function testoRichiesta(ragioneSociale: string): string {
  return `Buongiorno,\nscrivo per l'abbonamento di ${ragioneSociale}.\n\n`;
}

export { GIORNI_PROVA };
