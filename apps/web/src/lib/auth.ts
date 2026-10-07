import { AuthError, isAuthError, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import type {
  Accesso,
  CambioPassword,
  NuovaPassword,
  RecuperoPassword,
  Registrazione,
} from '@tyrecare/shared';
import { getSupabase } from './supabase';

let sessione: Session | null = null;

/** Sessione dell'utente autenticato, o `null`. Aggiornata automaticamente da Supabase. */
export function sessioneCorrente(): Session | null {
  return sessione;
}

/**
 * Legge la sessione salvata (o quella arrivata nell'URL da un link email) e resta in ascolto dei
 * cambiamenti: accesso, uscita, rinnovo del token, recupero password.
 */
export async function inizializzaAuth(suCambio: (evento: AuthChangeEvent) => void): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  sessione = data.session;

  supabase.auth.onAuthStateChange((evento, nuova) => {
    sessione = nuova;
    // Mai chiamare Supabase dentro questo callback (si bloccherebbe): si rimanda al giro successivo
    setTimeout(() => suCambio(evento), 0);
  });
}

export async function accedi({ email, password }: Accesso): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Crea l'account. Nome e cognome vanno nei metadati: il trigger del database li copia nel profilo.
 * Restituisce `true` se l'utente è già dentro, `false` se deve prima confermare l'email.
 */
export async function registrati({ nome, cognome, email, password }: Registrazione) {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { nome, cognome }, emailRedirectTo: `${location.origin}/` },
  });
  if (error) throw error;
  return data.session !== null;
}

export async function inviaRecuperoPassword({ email }: RecuperoPassword): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/nuova-password`,
  });
  if (error) throw error;
}

export async function impostaNuovaPassword({ password }: NuovaPassword): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Cambio password da utente autenticato. Prima si verifica quella attuale rifacendo l'accesso
 * (Supabase limita i tentativi): così chi trova il telefono sbloccato non può cambiarla.
 */
export async function cambiaPassword({ attuale, password }: CambioPassword): Promise<void> {
  const email = sessione?.user.email;
  if (!email) throw new Error('Nessun utente autenticato');
  const { error } = await getSupabase().auth.signInWithPassword({ email, password: attuale });
  if (error?.code === 'invalid_credentials') {
    throw new AuthError(error.message, error.status, 'password_attuale_errata');
  }
  if (error) throw error;
  await impostaNuovaPassword({ password });
}

export async function esci(): Promise<void> {
  // `local`: esce da questo dispositivo, non da tutti
  const { error } = await getSupabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

// Codici di errore di Supabase Auth → messaggi per l'utente
const MESSAGGI: Record<string, string> = {
  invalid_credentials: 'Email o password non corrette.',
  password_attuale_errata: 'La password attuale non è corretta.',
  email_not_confirmed:
    "Devi prima confermare l'email: apri il link che ti abbiamo inviato (controlla anche lo spam).",
  user_already_exists: 'Esiste già un account con questa email. Prova ad accedere.',
  email_exists: 'Esiste già un account con questa email. Prova ad accedere.',
  weak_password: 'Password troppo debole: scegline una più lunga o meno comune.',
  same_password: 'La nuova password deve essere diversa da quella attuale.',
  over_email_send_rate_limit: 'Abbiamo già inviato troppe email. Riprova tra qualche minuto.',
  over_request_rate_limit: 'Troppi tentativi ravvicinati. Riprova tra qualche minuto.',
  signup_disabled: 'Le registrazioni sono momentaneamente chiuse.',
};

/** Messaggio comprensibile per un errore di autenticazione o di rete. */
export function messaggioErrore(errore: unknown): string {
  if (isAuthError(errore) && errore.code && MESSAGGI[errore.code]) {
    return MESSAGGI[errore.code]!;
  }
  if (!navigator.onLine || (isAuthError(errore) && errore.status === 0)) {
    return 'Sembra che tu sia offline. Controlla la connessione e riprova.';
  }
  return 'Qualcosa è andato storto. Riprova tra poco.';
}
