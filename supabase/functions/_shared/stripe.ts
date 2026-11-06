// Aiuti comuni alle Edge Functions di Stripe chiamate dalla pagina (T189 checkout, T195 portale).
// Senza Deno e senza import, così li provano anche i test di vitest (project `funzioni`).
// Nessun SDK di Stripe: le API si chiamano con `fetch` e corpo form-urlencoded.

/** Intestazioni CORS: le funzioni si chiamano dal browser con `supabase.functions.invoke`. */
export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Risposta JSON con le intestazioni CORS. */
export function risposta(json: unknown, status = 200): Response {
  return new Response(JSON.stringify(json), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/**
 * `POST https://api.stripe.com/v1/<percorso>` con la chiave segreta. Restituisce il JSON di Stripe;
 * se Stripe risponde con un errore lancia un `Error` con il suo messaggio (da scrivere solo nel log:
 * non va mandato al browser).
 *
 * `opzioni.chiaveIdempotenza` (facoltativa, T189b) diventa l'intestazione `Idempotency-Key`: Stripe la
 * ricorda per 24 ore e a una seconda richiesta con la stessa chiave e gli stessi parametri risponde con
 * il risultato della prima (niente doppioni). Con la stessa chiave e parametri diversi, o mentre la prima
 * è ancora in corso, Stripe risponde con un errore (che qui lancia, come gli altri). Senza la chiave (o
 * con una stringa vuota) la richiesta non ha intestazioni in più.
 */
export async function chiamaStripe(
  fetchFn: FetchFn,
  chiave: string,
  percorso: string,
  parametri: URLSearchParams,
  opzioni?: { chiaveIdempotenza?: string },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${chiave}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (typeof opzioni?.chiaveIdempotenza === 'string' && opzioni.chiaveIdempotenza) {
    headers['Idempotency-Key'] = opzioni.chiaveIdempotenza;
  }
  const risp = await fetchFn(`https://api.stripe.com/v1/${percorso}`, {
    method: 'POST',
    headers,
    body: parametri.toString(),
  });

  let json: { error?: { message?: unknown } } & Record<string, unknown>;
  try {
    json = (await risp.json()) as typeof json;
  } catch {
    throw new Error(`Errore di Stripe (risposta non JSON, ${risp.status})`);
  }
  if (!risp.ok) {
    const messaggio = json?.error?.message;
    throw new Error(typeof messaggio === 'string' && messaggio ? messaggio : 'Errore di Stripe');
  }
  return json;
}
