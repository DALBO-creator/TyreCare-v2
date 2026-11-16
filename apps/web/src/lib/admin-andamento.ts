import { aggiungiGiorni } from '@tyrecare/shared';
import { getSupabase } from './supabase';

/**
 * Andamento del pilota per l'amministratore (T256): i numeri di `andamento_officine` (T255) per officina e
 * per periodo, e il testo da copiare nella tabella della telefonata settimanale. Niente `zod`.
 * Le date sono giorni italiani `AAAA-MM-GG`, estremi inclusi; si calcolano in UTC per non dipendere dal fuso.
 */

export interface AndamentoOfficina {
  officina_id: string;
  ragione_sociale: string;
  stato_affiliazione: string;
  clienti: number;
  clienti_collegati: number;
  clienti_con_push: number;
  inviti_creati: number;
  controlli_app: number;
  controlli_importati: number;
  richieste_appuntamento: number;
  richieste_strada_accettate: number;
}

export type TipoPeriodo = 'questa' | 'scorsa' | '30giorni';

export interface Periodo {
  da: string;
  a: string;
}

export const ETICHETTE_PERIODO: Record<TipoPeriodo, string> = {
  questa: 'Questa settimana',
  scorsa: 'Settimana scorsa',
  '30giorni': 'Ultimi 30 giorni',
};

/** Lunedì e domenica della settimana che contiene `oggiIso` (la domenica appartiene alla settimana che finisce). */
export function settimana(oggiIso: string): Periodo {
  const giorno = new Date(`${oggiIso}T00:00:00Z`).getUTCDay(); // 0 = domenica
  const dalLunedi = (giorno + 6) % 7;
  const da = aggiungiGiorni(oggiIso, -dalLunedi);
  return { da, a: aggiungiGiorni(da, 6) };
}

/** Il periodo scelto nel selettore, rispetto a `oggiIso`. */
export function periodoScelto(tipo: TipoPeriodo, oggiIso: string): Periodo {
  if (tipo === 'questa') return settimana(oggiIso);
  if (tipo === 'scorsa') return settimana(aggiungiGiorni(oggiIso, -7));
  return { da: aggiungiGiorni(oggiIso, -29), a: oggiIso };
}

/** ATTIVA prima, poi le altre; dentro ogni gruppo per ragione sociale. Non modifica l'ingresso. */
export function ordinaOfficine(righe: readonly AndamentoOfficina[]): AndamentoOfficina[] {
  const peso = (r: AndamentoOfficina): number => (r.stato_affiliazione === 'ATTIVA' ? 0 : 1);
  return [...righe].sort(
    (a, b) => peso(a) - peso(b) || a.ragione_sociale.localeCompare(b.ragione_sociale, 'it'),
  );
}

/** Una riga di testo per officina, da incollare nella tabella settimanale. */
export function rigaCopiabile(r: AndamentoOfficina, p: Periodo): string {
  return (
    `${r.ragione_sociale} (dal ${p.da} al ${p.a}): ` +
    `clienti ${r.clienti}, collegati ${r.clienti_collegati}, con notifiche ${r.clienti_con_push}; ` +
    `inviti creati ${r.inviti_creati}; ` +
    `controlli inseriti ${r.controlli_app}, importati ${r.controlli_importati}; ` +
    `richieste di appuntamento ${r.richieste_appuntamento}; ` +
    `aiuto su strada ${r.richieste_strada_accettate}`
  );
}

/** Tutte le righe, nell'ordine delle carte. */
export function testoCopiabile(righe: readonly AndamentoOfficina[], p: Periodo): string {
  return ordinaOfficine(righe)
    .map((r) => rigaCopiabile(r, p))
    .join('\n');
}

/** Legge i numeri per il periodo (estremi inclusi). Solo ADMIN con verifica in due passaggi. */
export async function caricaAndamento(da: string, a: string): Promise<AndamentoOfficina[]> {
  const { data, error } = await getSupabase().rpc('andamento_officine', { p_da: da, p_a: a });
  if (error) throw error;
  return data ?? [];
}
