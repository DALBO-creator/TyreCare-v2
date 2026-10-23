import { oggiInItalia, type NuovaChiusura, type Orari, type Tables } from '@tyrecare/shared';
import { elimina, giaSalvato } from './officina';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

// Orari settimanali e chiusure straordinarie dell'officina (Fase 4). Li scrive il TITOLARE (RLS); il
// database controlla il formato degli orari (`orari_validi`) e le date delle chiusure.

export type ChiusuraOfficina = Tables<'chiusure_officina'>;

/** Orari e chiusure da oggi in poi (in ordine di data). */
export async function caricaOrariEChiusure(
  officinaId: string,
): Promise<{ orari: unknown; capienza: number | null; chiusure: ChiusuraOfficina[] }> {
  const supabase = getSupabase();
  const [officina, chiusure] = await Promise.all([
    supabase.from('officine').select('orari, capienza_fascia').eq('id', officinaId).single(),
    caricaChiusure(officinaId, oggiInItalia()),
  ]);
  if (officina.error) throw officina.error;
  return { orari: officina.data.orari, capienza: officina.data.capienza_fascia, chiusure };
}

/** Chiusure che finiscono dal giorno indicato in poi. */
export async function caricaChiusure(officinaId: string, dal: string): Promise<ChiusuraOfficina[]> {
  const { data, error } = await getSupabase()
    .from('chiusure_officina')
    .select('*')
    .eq('officina_id', officinaId)
    .gte('al', dal)
    .order('dal');
  if (error) throw error;
  return data;
}

/** Salva orari e capienza per fascia (null = nessun limite) insieme. */
export async function salvaOrari(
  officinaId: string,
  orari: Orari,
  capienza: number | null,
): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase()
      .from('officine')
      .update({ orari, capienza_fascia: capienza })
      .eq('id', officinaId)
      .select('id')
      .single(),
  );
  if (error) throw error;
}

export async function creaChiusura(officinaId: string, chiusura: NuovaChiusura): Promise<void> {
  const id = crypto.randomUUID();
  const { error } = await conRiprova(() =>
    getSupabase()
      .from('chiusure_officina')
      .insert({ ...chiusura, id, officina_id: officinaId }),
  );
  if (error && !giaSalvato(error, 'chiusure_officina')) throw error;
}

export const eliminaChiusura = (id: string) =>
  elimina('chiusure_officina', id, "Solo il titolare dell'officina può modificare le chiusure.");
