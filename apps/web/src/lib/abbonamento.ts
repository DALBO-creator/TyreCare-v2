import type { Piano, StatoAbbonamento } from '@tyrecare/shared';
import { getSupabase } from './supabase';

export interface AbbonamentoOfficina {
  piano: Piano;
  stato: StatoAbbonamento;
  /** Ultimo giorno della prova (`AAAA-MM-GG`, incluso). */
  prova_fino_al: string;
}

/** Abbonamento dell'officina; lo leggono solo titolare e admin. `null` se non esiste. */
export async function caricaAbbonamento(officinaId: string): Promise<AbbonamentoOfficina | null> {
  const { data, error } = await getSupabase()
    .from('abbonamenti')
    .select('piano, stato, prova_fino_al')
    .eq('officina_id', officinaId)
    .maybeSingle();
  if (error) throw error;
  return data as AbbonamentoOfficina | null;
}
