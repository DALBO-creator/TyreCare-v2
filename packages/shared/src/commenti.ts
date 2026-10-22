import { z } from 'zod';

/** Lunghezze del testo di un commento: coincidono con il `check` di `public.commenti.testo`. */
export const COMMENTO_MIN = 3;
export const COMMENTO_MAX = 2000;
/** Lunghezza massima di `percorso` (colonna `public.commenti.percorso`). */
export const PERCORSO_MAX = 200;

/** Modulo "Invia un commento": il testo si pulisce dagli spazi ai lati prima del controllo. */
export const CommentoSchema = z.object({
  testo: z
    .string()
    .trim()
    .min(COMMENTO_MIN, { error: `Scrivi almeno ${COMMENTO_MIN} caratteri` })
    .max(COMMENTO_MAX, { error: `Il commento può avere al massimo ${COMMENTO_MAX} caratteri` }),
});
export type Commento = z.infer<typeof CommentoSchema>;

/**
 * Pagina da cui parte il commento (`?da=` nell'indirizzo), che arriva dall'esterno e quindi non è
 * fidata: vale solo un percorso interno ("/…" ma non "//…") entro il limite del database, altrimenti
 * resta vuoto.
 */
export function percorsoCommento(da: string | null | undefined): string {
  if (!da || !da.startsWith('/') || da.startsWith('//') || da.length > PERCORSO_MAX) return '';
  return da;
}
