import { z } from 'zod';

/** Lunghezza minima della password: deve coincidere con `minimum_password_length` di Supabase. */
export const PASSWORD_MIN = 10;
/** Testo di aiuto sotto i campi «nuova password»: le stesse regole di `password_requirements`. */
export const AIUTO_PASSWORD = `Almeno ${PASSWORD_MIN} caratteri, con una maiuscola, una minuscola e un numero.`;
// bcrypt, usato da Supabase Auth, considera solo i primi 72 byte
const PASSWORD_MAX = 72;

const email = z
  .string()
  .trim()
  .min(1, { error: 'Inserisci la tua email' })
  .pipe(z.email({ error: "Controlla l'email: sembra incompleta (es. nome@esempio.it)" }));

const nuovaPassword = z
  .string()
  .min(PASSWORD_MIN, { error: `La password deve avere almeno ${PASSWORD_MIN} caratteri` })
  .max(PASSWORD_MAX, { error: `La password può avere al massimo ${PASSWORD_MAX} caratteri` })
  // Come `password_requirements = "lower_upper_letters_digits"` di Supabase Auth
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p), {
    error: 'La password deve avere almeno una maiuscola, una minuscola e un numero',
  });

/** Codice a 6 cifre dell'app di autenticazione (2FA); gli spazi si tolgono. */
export const CodiceMfaSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, ''))
  .pipe(z.string().regex(/^[0-9]{6}$/, { error: 'Inserisci il codice di 6 cifre' }));

export const VerificaMfaSchema = z.object({ codice: CodiceMfaSchema });
export type VerificaMfa = z.infer<typeof VerificaMfaSchema>;

const nome = (etichetta: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Inserisci il tuo ${etichetta}` })
    .max(100, { error: `Il ${etichetta} può avere al massimo 100 caratteri` });

export const AccessoSchema = z.object({
  email,
  // All'accesso non si controlla la lunghezza: vale la password scelta, anche se le regole cambiano
  password: z.string().min(1, { error: 'Inserisci la password' }),
});
export type Accesso = z.infer<typeof AccessoSchema>;

/** Età minima per creare un account: 14 anni (art. 2-quinquies del Codice privacy, D.Lgs. 196/2003). */
export const ETA_MINIMA = 14;

/** Versione dei termini che l'utente accetta alla registrazione (finisce nel suo profilo). */
export const VERSIONE_TERMINI = '2026-11-14';

/** Vero se l'utente aveva accettato una versione dei termini diversa da quella attuale (nulla: mai chiesta). */
export function devonoRiaccettare(versione: string | null): boolean {
  return versione !== null && versione !== VERSIONE_TERMINI;
}

export const RegistrazioneSchema = z.object({
  nome: nome('nome'),
  cognome: nome('cognome'),
  email,
  password: nuovaPassword,
  // La casella spuntata arriva dal modulo come 'on', non spuntata come ''
  accetto: z.preprocess(
    (v) => v === true || v === 'on',
    z.literal(true, { error: "Per creare l'account devi accettare i termini" }),
  ),
});
export type Registrazione = z.infer<typeof RegistrazioneSchema>;

export const RecuperoPasswordSchema = z.object({ email });
export type RecuperoPassword = z.infer<typeof RecuperoPasswordSchema>;

export const NuovaPasswordSchema = z.object({ password: nuovaPassword });
export type NuovaPassword = z.infer<typeof NuovaPasswordSchema>;

/** Cambio password da utente già autenticato: si chiede anche quella attuale. */
export const CambioPasswordSchema = z.object({
  attuale: z.string().min(1, { error: 'Inserisci la password attuale' }),
  password: nuovaPassword,
  // Solo per chi ha la verifica in due passaggi: il campo c'è nel modulo solo in quel caso
  codice: CodiceMfaSchema.optional(),
});
export type CambioPassword = z.infer<typeof CambioPasswordSchema>;

// Stesso controllo del vincolo `check` su `profiles.telefono`
const TELEFONO = /^\+?[0-9 ]{6,20}$/;

/** Telefono facoltativo: trattini, punti e parentesi diventano spazi; vuoto → `null`. */
export const TelefonoSchema = z
  .string()
  .transform((s) =>
    s
      .replace(/[-./()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  .refine((s) => s === '' || TELEFONO.test(s), {
    error:
      'Controlla il numero: solo cifre e spazi, eventualmente con + davanti (es. +39 333 1234567)',
  })
  .transform((s) => s || null);

export const ModificaProfiloSchema = z.object({
  nome: nome('nome'),
  cognome: nome('cognome'),
  telefono: TelefonoSchema,
});
export type ModificaProfilo = z.infer<typeof ModificaProfiloSchema>;
