import type { DatiOfficina, Tables } from '@tyrecare/shared';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

// Indirizzo, contatti e posizione dell'officina (Fase 4). Li scrive il TITOLARE (policy RLS
// "officine: modifica titolare o admin"); ragione sociale e partita IVA le cambia solo l'amministratore.

export type DatiOfficinaSalvati = Pick<
  Tables<'officine'>,
  | 'ragione_sociale'
  | 'partita_iva'
  | 'indirizzo'
  | 'cap'
  | 'citta'
  | 'provincia'
  | 'telefono'
  | 'email'
  | 'latitudine'
  | 'longitudine'
>;

export async function caricaDatiOfficina(officinaId: string): Promise<DatiOfficinaSalvati> {
  const { data, error } = await getSupabase()
    .from('officine')
    .select(
      'ragione_sociale, partita_iva, indirizzo, cap, citta, provincia, telefono, email, latitudine, longitudine',
    )
    .eq('id', officinaId)
    .single();
  if (error) throw error;
  return data;
}

export async function salvaDatiOfficina(officinaId: string, dati: DatiOfficina): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().from('officine').update(dati).eq('id', officinaId).select('id').single(),
  );
  if (error) throw error;
}

/** Posizione come la mostra il campo: "45.070312, 7.686856", vuota se manca. */
export const testoPosizione = (
  d: Pick<DatiOfficinaSalvati, 'latitudine' | 'longitudine'>,
): string =>
  d.latitudine === null || d.longitudine === null ? '' : `${d.latitudine}, ${d.longitudine}`;
