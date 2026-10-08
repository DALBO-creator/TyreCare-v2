/**
 * Errori di rete nelle scritture.
 *
 * Sul telefono la prima scrittura dopo qualche minuto passato a compilare un modulo può fallire: la
 * connessione verso Supabase si è chiusa nel frattempo e il browser se ne accorge solo al primo invio.
 * Le letture le ripete da sé postgrest-js (solo GET, HEAD e OPTIONS), le scritture no, perché ripeterle
 * alla cieca potrebbe salvare due volte. Qui le ripetiamo una volta: è sicuro perché chi chiama sceglie
 * gli id in anticipo, e il database riconosce una scrittura già arrivata (vedi la migrazione
 * `20261008130000_scritture_ripetibili.sql`).
 */

/** Risposta di Supabase: con un errore di rete `status` è 0 (la richiesta non ha avuto risposta). */
interface Risposta {
  error: unknown;
  status: number;
}

const ATTESA_MS = 400;

/** Vero se l'errore viene dalla rete (nessuna risposta dal server) e non dal database. */
export function erroreDiRete(errore: unknown): boolean {
  if (errore instanceof TypeError) return true;
  const { message, code } = (errore ?? {}) as { message?: unknown; code?: unknown };
  // postgrest-js scrive "<nome dell'errore di fetch>: <messaggio>" e lascia vuoto il codice
  return (
    typeof message === 'string' && !code && /^(TypeError|FetchError|AbortError)\b/.test(message)
  );
}

/**
 * Esegue una scrittura e, se fallisce per un errore di rete, la ripete una volta dopo una breve
 * attesa. `richiesta` deve creare ogni volta una richiesta nuova e **ripetibile** (id scelti prima).
 */
export async function conRiprova<R extends Risposta>(richiesta: () => PromiseLike<R>): Promise<R> {
  const prima = await richiesta();
  if (!prima.error || prima.status !== 0) return prima;
  await new Promise((r) => setTimeout(r, ATTESA_MS));
  return richiesta();
}
