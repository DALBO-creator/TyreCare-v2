// Edge Function (Deno) — portale clienti di Stripe (T195, R22, ultima parte di T071).
//
// La pagina "Abbonamento" la chiama con `{ officina_id }` e il JWT dell'utente; risponde `{ url }` della
// pagina ospitata da Stripe dove il titolare cambia carta o annulla l'abbonamento, e da cui torna a
// `<SITO_URL>/officina/abbonamento`. Solo il TITOLARE; serve un cliente Stripe già collegato
// (`abbonamenti.stripe_customer_id`), altrimenti 409 `NESSUN_PAGAMENTO`. Officina non ATTIVA o piano
// PILOTA non bloccano: chi ha un cliente Stripe deve poter annullare anche da sospeso. Il flusso è in
// `portale.ts` (provato con vitest); qui solo il cablaggio con Deno e il database (service role).
// Errori: `{ errore: <CHIAVE> }`; il messaggio di Stripe o del database resta nel log.
//
// Segreti (supabase secrets set): STRIPE_SECRET_KEY (la `sk_test_…`) e SITO_URL (es. https://dominio),
// gli stessi del checkout. Se ne manca uno la risposta è 503 `PAGAMENTI_NON_ATTIVI`.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
//
// Il portale va ATTIVATO e configurato una volta nella dashboard di Stripe (Impostazioni → Billing →
// Portale clienti: cambio carta, annullamento, fatture); finché non lo è, Stripe risponde con un errore
// e la funzione dà 502 `STRIPE`.
//
// Il JWT lo verifica `auth.getUser(token)`: deploy normale (`supabase functions deploy stripe-portale`).
// Nessun SDK di Stripe: solo `fetch` (`../_shared/stripe.ts`).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { gestisciPortale, type DbPortale } from './portale.ts';

const env = (nome: string): string => {
  const valore = Deno.env.get(nome);
  if (!valore) throw new Error(`Manca la variabile ${nome}`);
  return valore;
};

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

const db: DbPortale = {
  async utente(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
  },
  async ruolo(officinaId, utenteId) {
    const { data, error } = await supabase
      .from('officina_utenti')
      .select('ruolo')
      .eq('officina_id', officinaId)
      .eq('profile_id', utenteId)
      .maybeSingle();
    if (error) throw new Error(`lettura ruolo: ${error.message}`);
    return (data?.ruolo as string | undefined) ?? null;
  },
  async abbonamento(officinaId) {
    const { data, error } = await supabase
      .from('abbonamenti')
      .select('stripe_customer_id')
      .eq('officina_id', officinaId)
      .maybeSingle();
    if (error) throw new Error(`lettura abbonamento: ${error.message}`);
    return data ?? null;
  },
};

Deno.serve((richiesta) =>
  gestisciPortale(richiesta, {
    env: (nome) => Deno.env.get(nome) || undefined,
    fetchFn: (url, init) => fetch(url, init),
    db,
  }),
);
