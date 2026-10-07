import { isAuthError } from '@supabase/supabase-js';
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

// Errori che indicano una sessione salvata non più valida (token scaduto, revocato o firmato con
// una chiave vecchia): riprovare non serve, bisogna rifare l'accesso
const CODICI_SESSIONE_NON_VALIDA = new Set([
  'PGRST301', // PostgREST: JWT non valido o scaduto
  'PGRST303', // PostgREST: claim del JWT non validi
  'PGRST116', // nessun profilo per questo utente (account eliminato con la sessione ancora salvata)
]);
const CODICI_AUTH_NON_VALIDA = new Set(['bad_jwt', 'session_not_found', 'refresh_token_not_found']);

export function sessioneNonValida(errore: unknown): boolean {
  if (isAuthError(errore)) {
    return errore.status === 401 || (!!errore.code && CODICI_AUTH_NON_VALIDA.has(errore.code));
  }
  const codice = (errore as { code?: unknown } | null)?.code;
  return typeof codice === 'string' && CODICI_SESSIONE_NON_VALIDA.has(codice);
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
