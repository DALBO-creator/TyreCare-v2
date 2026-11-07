import { isAuthError } from '@supabase/supabase-js';
import { VERSIONE_TERMINI, type ModificaProfilo, type Tables } from '@tyrecare/shared';
import { messaggioErrore, sessioneCorrente } from './auth';
import { ErroreModulo } from './errori';
import { conRiprova } from './rete';
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

// Vero se l'ultimo utente caricato lavora in un'officina: la navigazione mostra anche "Clienti"
let membroOfficina = false;

/** Vero se l'utente (all'ultimo caricamento dei suoi dati) lavora in almeno un'officina. */
export const lavoraInOfficina = (): boolean => membroOfficina;

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

  membroOfficina = officine.data.length > 0;
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
  // Un update si può ripetere senza rischi: dopo un errore di rete si riprova una volta
  const { error } = await conRiprova(() =>
    getSupabase().from('profiles').update(dati).eq('id', utente.id).select('id').single(),
  );
  if (error) throw error;
}

/** Registra nel profilo l'accettazione dei termini attuali (la funzione scrive versione e data). */
export async function accettaTerminiAttuali(): Promise<void> {
  const { error } = await getSupabase().rpc('accetta_termini', { p_versione: VERSIONE_TERMINI });
  if (error) throw error;
}

const ERRORI_ELIMINAZIONE: Record<string, string> = {
  TITOLARE_DI_OFFICINA:
    "Sei il titolare di un'officina: scrivici con «Invia un commento» per chiudere l'officina e l'account.",
  PRENOTAZIONI_IN_CORSO: 'Hai appuntamenti in corso: annullali da «Appuntamenti» e riprova.',
  RICHIESTA_STRADA_IN_CORSO:
    'Hai una richiesta di aiuto su strada in corso: annullala da «Aiuto su strada» e riprova.',
  ACCOUNT_AMMINISTRATORE: "L'account amministratore non si elimina dall'app.",
};

/** Messaggio italiano per la chiave d'errore di `elimina_account`; `undefined` se non è una di quelle note. */
export const messaggioEliminazione = (codice: string | undefined): string | undefined =>
  codice === undefined ? undefined : ERRORI_ELIMINAZIONE[codice];

/**
 * Elimina l'account dell'utente autenticato (la funzione del database cancella anche profilo,
 * notifiche e commenti). Nessuna riprova automatica: dopo il successo l'utente non esiste più.
 * Dopo questa chiamata la pagina deve fare `esci()`.
 */
export async function eliminaAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('elimina_account');
  if (error) {
    const testo = messaggioEliminazione(error.message);
    throw testo
      ? new ErroreModulo(testo, undefined, error.message)
      : new Error(messaggioErrore(error));
  }
}
