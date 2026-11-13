import { leggiTutte } from './a-pagine';
import { getSupabase } from './supabase';

/**
 * Errori dell'app per l'amministratore (T249): lettura degli ultimi 30 giorni e raggruppamento per
 * messaggio. La RLS di `errori_app` mostra le righe solo all'ADMIN. Niente `zod`.
 */

export const GIORNI_ERRORI = 30;
/** Occorrenze mostrate per gruppo */
export const MAX_OCCORRENZE = 10;

export interface RigaErrore {
  id: string;
  autore_id: string;
  percorso: string;
  messaggio: string;
  dettaglio: string;
  versione: string;
  agente: string;
  created_at: string;
}

export interface GruppoErrori {
  messaggio: string;
  volte: number;
  /** created_at più recente del gruppo */
  ultima: string;
  percorsi: string[];
  versioni: string[];
  /** Numero di utenti distinti */
  utenti: number;
  /** Le ultime {@link MAX_OCCORRENZE}, dalla più recente */
  occorrenze: RigaErrore[];
}

const tempo = (iso: string): number => new Date(iso).getTime();

/** Raggruppa per messaggio; gruppi dal più recente (per `ultima`). Non modifica l'ingresso. */
export function raggruppaErrori(righe: readonly RigaErrore[]): GruppoErrori[] {
  const gruppi = new Map<string, RigaErrore[]>();
  for (const r of righe) {
    const g = gruppi.get(r.messaggio);
    if (g) g.push(r);
    else gruppi.set(r.messaggio, [r]);
  }
  const distinti = (valori: string[]): string[] => [...new Set(valori.filter((v) => v !== ''))];
  return [...gruppi.entries()]
    .map(([messaggio, elenco]) => {
      const ordinate = [...elenco].sort((a, b) => tempo(b.created_at) - tempo(a.created_at));
      return {
        messaggio,
        volte: ordinate.length,
        ultima: ordinate[0]!.created_at,
        percorsi: distinti(ordinate.map((r) => r.percorso)),
        versioni: distinti(ordinate.map((r) => r.versione)),
        utenti: new Set(ordinate.map((r) => r.autore_id)).size,
        occorrenze: ordinate.slice(0, MAX_OCCORRENZE),
      };
    })
    .sort((a, b) => tempo(b.ultima) - tempo(a.ultima));
}

/** Gli errori degli ultimi 30 giorni, dal più recente. */
export async function caricaErroriApp(adesso: Date = new Date()): Promise<RigaErrore[]> {
  const da = new Date(adesso.getTime() - GIORNI_ERRORI * 24 * 3600 * 1000).toISOString();
  return leggiTutte<RigaErrore>((inizio, fine) =>
    getSupabase()
      .from('errori_app')
      .select('id, autore_id, percorso, messaggio, dettaglio, versione, agente, created_at')
      .gte('created_at', da)
      .order('created_at', { ascending: false })
      .order('id')
      .range(inizio, fine),
  );
}
