import type { Tables } from '@tyrecare/shared';
import type { OfficinaGarage } from './garage';
import type { Pneumatico } from './officina';
import { getSupabase } from './supabase';

// Report del singolo controllo (Fase 3, PLAN §2.3): lo legge il cliente dal suo garage e chi lavora
// nell'officina che l'ha eseguito. Una sola lettura da Supabase: la RLS mostra il controllo solo a
// loro (il cliente vede anche l'officina se non è più attiva, migrazione `garage_cliente`).

/** Misura di uno pneumatico, con i dati dello pneumatico misurato quel giorno (anche se ora smontato). */
export type MisuraReport = Pick<
  Tables<'misure_pneumatico'>,
  'battistrada_mm' | 'pressione_bar' | 'usura' | 'danni'
> & { pneumatico: Pneumatico };

export type Report = Pick<
  Tables<'controlli'>,
  'id' | 'officina_id' | 'eseguito_il' | 'km' | 'note'
> & {
  veicolo: Pick<Tables<'veicoli'>, 'id' | 'targa' | 'marca' | 'modello' | 'anno'> & {
    officina: OfficinaGarage | null;
  };
  misure: MisuraReport[];
};

/** Un controllo con veicolo, officina e misure; `null` se non esiste o non è visibile all'utente. */
export async function caricaReport(id: string): Promise<Report | null> {
  const { data, error } = await getSupabase()
    .from('controlli')
    .select(
      `id, officina_id, eseguito_il, km, note,
       veicolo:veicoli (id, targa, marca, modello, anno,
         officina:officine (id, ragione_sociale, indirizzo, citta, telefono)),
       misure:misure_pneumatico (battistrada_mm, pressione_bar, usura, danni, pneumatico:pneumatici (*))`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
