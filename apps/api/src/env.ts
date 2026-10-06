import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // URL del progetto Supabase: da qui si ricavano le chiavi pubbliche per verificare i JWT
  SUPABASE_URL: z.url(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida le variabili d'ambiente all'avvio: se mancano o sono errate il server non parte. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
