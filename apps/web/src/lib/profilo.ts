import type { ModificaProfilo, Tables } from '@tyrecare/shared';
import { sessioneCorrente } from './auth';
import { getSupabase } from './supabase';

export type Profilo = Tables<'profiles'>;

export interface OfficinaUtente {
  ruolo: Tables<'officina_utenti'>['ruolo'];
  officina: Pick<Tables<'officine'>, 'id' | 'ragione_sociale' | 'citta' | 'stato_affiliazione'>;
}

export interface DatiUtente {
  email: string;
  profilo: Profilo;
  officine: OfficinaUtente[];
}

/**
 * Profilo dell'utente autenticato e officine in cui lavora. Le policy RLS garantiscono che si
 * leggano solo i propri dati: il filtro su `profile_id` serve a non includere i colleghi.
 */
export async function caricaDatiUtente(): Promise<DatiUtente> {
  const utente = sessioneCorrente()?.user;
  if (!utente) throw new Error('Nessun utente autenticato');
  const supabase = getSupabase();

  const [profilo, officine] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', utente.id).single(),
    supabase
      .from('officina_utenti')
      .select('ruolo, officina:officine (id, ragione_sociale, citta, stato_affiliazione)')
      .eq('profile_id', utente.id),
  ]);
  if (profilo.error) throw profilo.error;
  if (officine.error) throw officine.error;

  return { email: utente.email ?? '', profilo: profilo.data, officine: officine.data };
}

/**
 * Salva nome, cognome e telefono. La RLS permette di modificare solo il proprio profilo; senza
 * `.single()` un aggiornamento bloccato passerebbe in silenzio (0 righe), così invece dà errore.
 */
export async function salvaProfilo(dati: ModificaProfilo): Promise<void> {
  const utente = sessioneCorrente()?.user;
  if (!utente) throw new Error('Nessun utente autenticato');
  const { error } = await getSupabase()
    .from('profiles')
    .update(dati)
    .eq('id', utente.id)
    .select('id')
    .single();
  if (error) throw error;
}
