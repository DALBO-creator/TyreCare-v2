import type { Session } from '@supabase/supabase-js';
import { sessioneCorrente } from './auth';
import { getSupabase } from './supabase';

/**
 * Verifica in due passaggi (2FA) con codice a tempo (TOTP) di Supabase Auth.
 * La sessione dopo la password è al livello `aal1`; dopo il codice diventa `aal2`. Il database
 * rifiuta le richieste `aal1` di chi ha la 2FA attiva e considera amministratore solo chi è `aal2`
 * (migrazione `due_fattori`): qui c'è solo l'interfaccia, la sicurezza non dipende da questo file.
 */

export type Livello = 'aal1' | 'aal2';

/** Livello (`aal`) scritto nel token di accesso; `null` se il token non si legge. */
export function livelloToken(token: string | null | undefined): Livello | null {
  try {
    const corpo = (token ?? '').split('.')[1];
    if (!corpo) return null;
    const base64 = corpo.replace(/-/g, '+').replace(/_/g, '/');
    const { aal } = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      aal?: unknown;
    };
    return aal === 'aal1' || aal === 'aal2' ? aal : null;
  } catch {
    return null;
  }
}

type SessioneMinima = Pick<Session, 'access_token'> & {
  user: { factors?: { id: string; factor_type: string; status: string }[] | undefined };
};

/** Id del fattore TOTP verificato dell'utente, se c'è. */
export function fattoreAttivo(sessione: SessioneMinima | null): string | undefined {
  return sessione?.user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified')
    ?.id;
}

/** Vero se la sessione è al secondo livello. */
export function secondoLivello(sessione: SessioneMinima | null = sessioneCorrente()): boolean {
  return livelloToken(sessione?.access_token) === 'aal2';
}

/** Vero se l'utente ha la 2FA attiva ma in questa sessione non ha ancora inserito il codice. */
export function serveCodice(sessione: SessioneMinima | null = sessioneCorrente()): boolean {
  return fattoreAttivo(sessione) !== undefined && !secondoLivello(sessione);
}

export interface Attivazione {
  id: string;
  /** Immagine del codice QR (URI `data:` con un SVG, generato da Supabase). */
  qr: string;
  /** Lo stesso segreto in lettere, per chi non può inquadrare il QR. */
  segreto: string;
}

/** Inizia l'attivazione: crea un fattore da confermare (quelli lasciati a metà si tolgono prima). */
export async function iniziaAttivazione(): Promise<Attivazione> {
  const mfa = getSupabase().auth.mfa;
  const elenco = await mfa.listFactors();
  if (elenco.error) throw elenco.error;
  for (const f of elenco.data.all) {
    if (f.status === 'unverified') await mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await mfa.enroll({
    factorType: 'totp',
    issuer: 'TyreCare',
    friendlyName: `App di autenticazione ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error) throw error;
  return { id: data.id, qr: data.totp.qr_code, segreto: data.totp.secret };
}

/** Conferma un fattore (nuovo o già attivo) con il codice: la sessione passa ad `aal2`. */
export async function verificaCodice(codice: string, fattore?: string): Promise<void> {
  const factorId = fattore ?? fattoreAttivo(sessioneCorrente());
  if (!factorId) throw new Error('Nessun fattore da verificare');
  const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code: codice });
  if (error) throw error;
}

/** Disattiva la 2FA: serve il codice (sessione `aal2`), poi si rinnova la sessione. */
export async function disattiva(codice: string): Promise<void> {
  const factorId = fattoreAttivo(sessioneCorrente());
  if (!factorId) return;
  await verificaCodice(codice, factorId);
  const { error } = await getSupabase().auth.mfa.unenroll({ factorId });
  if (error) throw error;
  await getSupabase().auth.refreshSession();
}
