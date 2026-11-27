import type { Enums, Json } from '@tyrecare/shared';
import { ErroreModulo, codiceErrore } from './errori';
import { getSupabase } from './supabase';

// Pannello dell'amministratore (2026-11-12). Il controllo vero è nel database: `is_admin()` vale solo
// con la verifica in due passaggi (aal2) e tutte le funzioni `admin_*` la richiedono. Qui c'è il flusso
// della 2FA (app di autenticazione, TOTP di Supabase Auth) e le chiamate alle funzioni del pannello.

// ---------------------------------------------------------------------------------------------------
// Verifica in due passaggi
// ---------------------------------------------------------------------------------------------------

/**
 * `verificato`: la sessione ha già la 2FA · `da-verificare`: c'è un'app registrata, serve il codice ·
 * `da-registrare`: nessuna app registrata (primo accesso al pannello).
 */
export type Stato2fa =
  { tipo: 'verificato' } | { tipo: 'da-verificare'; fattoreId: string } | { tipo: 'da-registrare' };

export async function stato2fa(): Promise<Stato2fa> {
  const auth = getSupabase().auth;
  const { data: livello, error } = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (livello.currentLevel === 'aal2') return { tipo: 'verificato' };
  const { data: fattori, error: e2 } = await auth.mfa.listFactors();
  if (e2) throw e2;
  const totp = fattori.totp.find((f) => f.status === 'verified');
  return totp ? { tipo: 'da-verificare', fattoreId: totp.id } : { tipo: 'da-registrare' };
}

/** Vero se la sessione ha già la 2FA (legge il token in memoria, nessuna richiesta). */
export async function sessioneAal2(): Promise<boolean> {
  const { data } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}

export interface NuovaApp2fa {
  fattoreId: string;
  /** Immagine del codice QR (data URI SVG). */
  qr: string;
  /** Chiave da scrivere a mano se il QR non si legge. */
  segreto: string;
}

/** Registra una nuova app di autenticazione (toglie prima quelle lasciate a metà). */
export async function registraApp2fa(): Promise<NuovaApp2fa> {
  const mfa = getSupabase().auth.mfa;
  const { data: fattori } = await mfa.listFactors();
  for (const f of fattori?.all ?? []) {
    if (f.status === 'unverified') await mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await mfa.enroll({
    factorType: 'totp',
    friendlyName: `TyreCare admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw error;
  return { fattoreId: data.id, qr: data.totp.qr_code, segreto: data.totp.secret };
}

/** Il codice dell'app: 6 cifre (spazi tollerati, es. "123 456" incollato). */
export function normalizzaCodice(testo: string): string | null {
  const c = testo.replace(/\s/g, '');
  return /^\d{6}$/.test(c) ? c : null;
}

/** Verifica il codice: la sessione passa ad aal2 (e il fattore, se nuovo, diventa verificato). */
export async function verificaCodice2fa(fattoreId: string, testo: string): Promise<void> {
  const codice = normalizzaCodice(testo);
  if (!codice) throw new ErroreModulo('Scrivi le 6 cifre mostrate dall’app.');
  const { error } = await getSupabase().auth.mfa.challengeAndVerify({
    factorId: fattoreId,
    code: codice,
  });
  if (error) {
    throw new ErroreModulo(
      'Codice non valido o scaduto: riprova con quello nuovo.',
      undefined,
      'MFA',
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Errori delle funzioni admin_*
// ---------------------------------------------------------------------------------------------------

export const ERRORI_PANNELLO: Record<string, string> = {
  UTENTE_NON_TROVATO: 'Account non trovato: ricarica la pagina.',
  RUOLO_ADMIN_SOLO_DAL_DATABASE: 'Il ruolo di amministratore si cambia solo dal database.',
  NON_SI_BLOCCA_UN_ADMIN: 'Un amministratore non si può bloccare.',
  TESTO_TROPPO_LUNGO: 'Testo di ricerca troppo lungo (al massimo 100 caratteri).',
};

export function traduciErrorePannello(errore: { message?: string; code?: string }): never {
  if (codiceErrore(errore) === '42501') {
    throw new ErroreModulo(
      'Serve l’accesso da amministratore con la verifica in due passaggi: ricarica la pagina.',
      undefined,
      '42501',
    );
  }
  if (codiceErrore(errore) === '23514') {
    throw new ErroreModulo(
      'Dato non valido (es. telefono: solo cifre e spazi, 6–20).',
      undefined,
      '23514',
    );
  }
  const chiave = errore.message ?? '';
  if (Object.hasOwn(ERRORI_PANNELLO, chiave)) {
    throw new ErroreModulo(ERRORI_PANNELLO[chiave]!, undefined, chiave);
  }
  throw errore;
}

// ---------------------------------------------------------------------------------------------------
// Riepilogo
// ---------------------------------------------------------------------------------------------------

export const VOCI_RIEPILOGO = [
  'utenti',
  'utenti_7_giorni',
  'utenti_non_confermati',
  'utenti_bloccati',
  'accessi_24_ore',
  'officine_attive',
  'officine_in_attesa',
  'officine_sospese',
  'abbonamenti_scaduti',
  'abbonamenti_attivi',
  'prove_in_corso',
  'ricavo_mensile',
  'prove_in_scadenza',
  'clienti',
  'veicoli',
  'controlli',
  'controlli_7_giorni',
  'prenotazioni_in_corso',
  'prenotazioni_7_giorni',
  'commenti_7_giorni',
  'iscrizioni_push',
] as const;

export type Riepilogo = Record<(typeof VOCI_RIEPILOGO)[number], number>;

/** Legge il json di `admin_riepilogo`: ogni voce mancante o non numerica vale 0. */
export function leggiRiepilogo(json: Json): Riepilogo {
  const o = json && typeof json === 'object' && !Array.isArray(json) ? json : {};
  return Object.fromEntries(
    VOCI_RIEPILOGO.map((k) => {
      const v = Number((o as Record<string, Json | undefined>)[k]);
      return [k, Number.isFinite(v) ? v : 0];
    }),
  ) as Riepilogo;
}

export async function caricaRiepilogo(): Promise<Riepilogo> {
  const { data, error } = await getSupabase().rpc('admin_riepilogo');
  if (error) traduciErrorePannello(error);
  return leggiRiepilogo(data);
}

// ---------------------------------------------------------------------------------------------------
// Utenti
// ---------------------------------------------------------------------------------------------------

export interface UtenteAdmin {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  ruolo: Enums<'ruolo'>;
  created_at: string;
  ultimo_accesso: string | null;
  email_confermata: boolean;
  bloccato: boolean;
  con_2fa: boolean;
  officine: string;
}

export async function cercaUtenti(testo: string): Promise<UtenteAdmin[]> {
  const { data, error } = await getSupabase().rpc('admin_cerca_utenti', {
    p_testo: testo.trim().slice(0, 100),
  });
  if (error) traduciErrorePannello(error);
  return (data ?? []) as UtenteAdmin[];
}

async function chiama(promessa: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await promessa;
  if (error) traduciErrorePannello(error);
}

export const correggiProfilo = (
  id: string,
  dati: { nome: string; cognome: string; telefono: string },
): Promise<void> =>
  chiama(
    getSupabase().rpc('admin_correggi_profilo', {
      p_utente: id,
      p_nome: dati.nome,
      p_cognome: dati.cognome,
      p_telefono: dati.telefono,
    }),
  );

export const cambiaRuolo = (id: string, ruolo: 'CLIENTE' | 'OFFICINA'): Promise<void> =>
  chiama(getSupabase().rpc('admin_cambia_ruolo', { p_utente: id, p_ruolo: ruolo }));

export const confermaEmail = (id: string): Promise<void> =>
  chiama(getSupabase().rpc('admin_conferma_email', { p_utente: id }));

export const bloccaUtente = (id: string, blocca: boolean): Promise<void> =>
  chiama(getSupabase().rpc('admin_blocca_utente', { p_utente: id, p_blocca: blocca }));

export const disconnettiUtente = (id: string): Promise<void> =>
  chiama(getSupabase().rpc('admin_disconnetti_utente', { p_utente: id }));

/** Manda all'account l'email per scegliere una nuova password (come "Password dimenticata"). */
export async function inviaReimpostaPassword(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/nuova-password`,
  });
  if (error)
    throw new ErroreModulo('Email non inviata: riprova tra qualche minuto.', undefined, 'EMAIL');
}

// ---------------------------------------------------------------------------------------------------
// Registro delle azioni
// ---------------------------------------------------------------------------------------------------

export interface VoceRegistro {
  id: number;
  created_at: string;
  azione: string;
  tabella: string;
  oggetto_id: string;
  dettagli: Json;
  admin: string;
}

const AZIONI: Record<string, string> = {
  insert: 'Creazione',
  update: 'Modifica',
  delete: 'Eliminazione',
  conferma_email: 'Email confermata',
  blocca: 'Account bloccato',
  sblocca: 'Account sbloccato',
  disconnetti: 'Sessioni chiuse',
};

const TABELLE: Record<string, string> = {
  profiles: 'profilo',
  officine: 'officina',
  officina_utenti: 'membro di officina',
  abbonamenti: 'abbonamento',
  'auth.users': 'account',
};

/** "Modifica · officina", "Account bloccato". */
export function descriviVoce(v: Pick<VoceRegistro, 'azione' | 'tabella'>): string {
  const azione = AZIONI[v.azione] ?? v.azione;
  const tabella = v.tabella === 'auth.users' ? '' : (TABELLE[v.tabella] ?? v.tabella);
  return tabella ? `${azione} · ${tabella}` : azione;
}

/** Dettagli leggibili: per le modifiche "campo: vecchio → nuovo", per il resto il json compatto. */
export function dettagliVoce(v: Pick<VoceRegistro, 'azione' | 'dettagli'>): string[] {
  const d = v.dettagli;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return [];
  const testo = (x: Json | undefined) =>
    x === null || x === undefined ? '—' : typeof x === 'string' ? x : JSON.stringify(x);
  if (v.azione === 'update') {
    return Object.entries(d).map(([campo, coppia]) =>
      Array.isArray(coppia)
        ? `${campo}: ${testo(coppia[0])} → ${testo(coppia[1])}`
        : `${campo}: ${testo(coppia)}`,
    );
  }
  return Object.entries(d)
    .filter(([campo]) => !['created_at', 'updated_at'].includes(campo))
    .slice(0, 8)
    .map(([campo, valore]) => `${campo}: ${testo(valore)}`);
}

export async function caricaRegistro(limite = 200): Promise<VoceRegistro[]> {
  const { data, error } = await getSupabase()
    .from('admin_registro')
    .select('id, created_at, azione, tabella, oggetto_id, dettagli, profiles(nome, cognome)')
    .order('id', { ascending: false })
    .limit(limite);
  if (error) traduciErrorePannello(error);
  return (data ?? []).map(({ profiles, ...r }) => ({
    ...r,
    admin: profiles ? `${profiles.nome} ${profiles.cognome}`.trim() : '',
  }));
}
