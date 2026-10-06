import { z } from 'zod';

/** Lunghezza minima della password: deve coincidere con `minimum_password_length` di Supabase. */
export const PASSWORD_MIN = 8;
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
  .max(PASSWORD_MAX, { error: `La password può avere al massimo ${PASSWORD_MAX} caratteri` });

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

export const RegistrazioneSchema = z.object({
  nome: nome('nome'),
  cognome: nome('cognome'),
  email,
  password: nuovaPassword,
});
export type Registrazione = z.infer<typeof RegistrazioneSchema>;

export const RecuperoPasswordSchema = z.object({ email });
export type RecuperoPassword = z.infer<typeof RecuperoPasswordSchema>;

export const NuovaPasswordSchema = z.object({ password: nuovaPassword });
export type NuovaPassword = z.infer<typeof NuovaPasswordSchema>;
