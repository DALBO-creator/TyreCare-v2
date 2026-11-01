import type { RigaControlloImport } from '@tyrecare/shared';
import { getSupabase } from './supabase';
import { conRiprova } from './rete';

// Import dei controlli dal gestionale (T023): chiama la funzione SQL `importa_controlli` (T043), prima in
// simulazione per l'anteprima, poi per davvero. Il file si legge e si controlla con `@tyrecare/shared`.

/** Cosa ha fatto (o farebbe) la funzione SQL. */
export interface ConteggiControlli {
  controlli_nuovi: number;
  controlli_gia_presenti: number;
  pneumatici_nuovi: number;
  misure_nuove: number;
  /** Misure di posizioni che non si possono agganciare a un pneumatico: non importate. */
  misure_saltate: number;
  /** Targhe del file che non corrispondono a nessun veicolo (al massimo 50, senza doppioni). */
  targhe_non_trovate: string[];
}

const CAMPI_NUMERICI = [
  'controlli_nuovi',
  'controlli_gia_presenti',
  'pneumatici_nuovi',
  'misure_nuove',
  'misure_saltate',
] as const;

/** Legge la risposta della funzione SQL; lancia un errore se non ha la forma attesa. */
export function leggiConteggiControlli(dati: unknown): ConteggiControlli {
  if (typeof dati !== 'object' || dati === null || Array.isArray(dati)) {
    throw new Error("Risposta dell'import non valida.");
  }
  const d = dati as Record<string, unknown>;
  const numeri = {} as Record<(typeof CAMPI_NUMERICI)[number], number>;
  for (const campo of CAMPI_NUMERICI) {
    const v = d[campo];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw new Error(`Risposta dell'import non valida (${campo}).`);
    }
    numeri[campo] = v;
  }
  const targhe = d.targhe_non_trovate ?? [];
  if (!Array.isArray(targhe) || !targhe.every((t) => typeof t === 'string')) {
    throw new Error("Risposta dell'import non valida (targhe_non_trovate).");
  }
  return { ...numeri, targhe_non_trovate: targhe };
}

interface ImportControlli {
  officinaId: string;
  righe: RigaControlloImport[];
  nomeFile: string;
  /** Righe con errori, saltate: finiscono nel registro. */
  scartate: number;
  /** Vero per l'anteprima: la funzione conta ma non scrive. */
  simula: boolean;
}

/** Importa (o simula) i controlli; i documenti già presenti vengono saltati dalla funzione. */
export async function importaControlli({
  officinaId,
  righe,
  nomeFile,
  scartate,
  simula,
}: ImportControlli): Promise<ConteggiControlli> {
  const argomenti = {
    p_officina_id: officinaId,
    // Il numero di riga serve solo ai messaggi del browser
    p_righe: righe.map(({ numero: _numero, ...riga }) => riga),
    p_nome_file: nomeFile,
    p_righe_scartate: scartate,
    p_simula: simula,
  };
  const { data, error } = await conRiprova(() => getSupabase().rpc('importa_controlli', argomenti));
  if (error) throw error;
  return leggiConteggiControlli(data);
}

/** Primo e ultimo giorno (AAAA-MM-GG) delle righe: serve a notare una colonna data letta male. */
export function periodoDate(righe: { data: string }[]): { da: string; a: string } | null {
  let da = '';
  let a = '';
  for (const { data } of righe) {
    if (!data) continue;
    if (!da || data < da) da = data;
    if (!a || data > a) a = data;
  }
  return da ? { da, a } : null;
}

/**
 * Vero se il controllo più vecchio ha più di 15 anni rispetto a `oggi` (date `AAAA-MM-GG`): di solito
 * la colonna «Data» è stata letta male. Confronto tra stringhe, senza `Date` (niente fusi orari).
 */
export function periodoSospetto(periodo: { da: string; a: string } | null, oggi: string): boolean {
  if (!periodo) return false;
  const soglia = `${String(Number(oggi.slice(0, 4)) - 15).padStart(4, '0')}${oggi.slice(4)}`;
  return periodo.da < soglia;
}
