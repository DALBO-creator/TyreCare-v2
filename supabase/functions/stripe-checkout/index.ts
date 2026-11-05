// Edge Function (Deno) — checkout di Stripe (T189, R22, terza parte di T071).
//
// La pagina "Abbonamento" la chiama con `{ officina_id, piano: 'STARTER' | 'PRO' }` e il JWT dell'utente;
// risponde `{ url }` della pagina di pagamento ospitata da Stripe (solo carta, modalità abbonamento).
// Solo il TITOLARE dell'officina; piano PILOTA o abbonamento già ATTIVO → 409. Il flusso è in
// `checkout.ts` (provato con vitest); qui solo il cablaggio con Deno e il database (service role).
// Errori: `{ errore: <CHIAVE> }`; il messaggio di Stripe o del database resta nel log.
//
// Segreti (supabase secrets set): STRIPE_SECRET_KEY (la `sk_test_…`), STRIPE_PRICE_STARTER e
// STRIPE_PRICE_PRO (gli id `price_…` dei due piani), SITO_URL (es. https://dominio, per i ritorni da
// Stripe). Se ne manca uno la risposta è 503 `PAGAMENTI_NON_ATTIVI` e la pagina lo dice.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
//
// Il JWT lo verifica `auth.getUser(token)`: deploy normale (`supabase functions deploy stripe-checkout`).
// Nessun SDK di Stripe: solo `fetch` (`../_shared/stripe.ts`).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { gestisciCheckout, type DbCheckout } from './checkout.ts';

const env = (nome: string): string => {
  const valore = Deno.env.get(nome);
  if (!valore) throw new Error(`Manca la variabile ${nome}`);
  return valore;
};

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

const db: DbCheckout = {
  async utente(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
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
      .select('piano, stato, stripe_customer_id')
      .eq('officina_id', officinaId)
      .maybeSingle();
    if (error) throw new Error(`lettura abbonamento: ${error.message}`);
    return data ?? null;
  },
  async ragioneSociale(officinaId) {
    const { data, error } = await supabase
      .from('officine')
      .select('ragione_sociale')
      .eq('id', officinaId)
      .maybeSingle();
    if (error) throw new Error(`lettura officina: ${error.message}`);
    return (data?.ragione_sociale as string | undefined) ?? null;
  },
  async collegaCliente(officinaId, customer) {
    const { error } = await supabase.rpc('collega_cliente_stripe', {
      p_officina_id: officinaId,
      p_customer: customer,
    });
    if (error) throw new Error(`collega_cliente_stripe: ${error.message}`);
  },
};

Deno.serve((richiesta) =>
  gestisciCheckout(richiesta, {
    env: (nome) => Deno.env.get(nome) || undefined,
    fetchFn: (url, init) => fetch(url, init),
    db,
  }),
);
