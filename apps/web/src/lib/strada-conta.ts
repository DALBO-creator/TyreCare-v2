import { getSupabase } from './supabase';

// Solo il conteggio delle richieste su strada vicine, per la home dell'officina. Sta in un modulo a parte
// (come `strada-officina.ts` ma senza zod né schemi) perché la home è nel file iniziale (dritta T056/T144).

/** Quante richieste aperte ci sono entro il raggio dell'officina (0 se non ha i requisiti). */
export async function contaRichiesteStradaVicine(officinaId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('richieste_strada_vicine', {
    p_officina_id: officinaId,
  });
  if (error) throw error;
  return data?.length ?? 0;
}
