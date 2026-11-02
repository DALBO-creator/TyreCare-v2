// Edge Function (Deno) — webhook di Stripe (T185, R22, seconda parte di T071).
//
// Stripe la chiama quando un abbonamento viene confermato, rinnovato, sospeso o annullato. Verifica la
// firma (`Stripe-Signature`) sul corpo grezzo, poi aggiorna stato e piano dell'abbonamento dell'officina
// con le funzioni del database di T180 (`aggiorna_abbonamento_stripe`, `registra_evento_stripe`), con
// la service role. Ogni evento si elabora una volta sola: quelli già in `stripe_eventi` rispondono 200
// `{ duplicato: true }`. Se il database dà errore la risposta è 500 e l'evento non si registra: Stripe
// lo rimanda più tardi.
//
// Segreti (supabase secrets set): STRIPE_WEBHOOK_SECRET (il `whsec_…` dell'endpoint), STRIPE_PRICE_STARTER
// e STRIPE_PRICE_PRO (gli id `price_…` dei due piani; se mancano, il piano non cambia).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
//
// Stripe non manda il JWT di Supabase: il deploy va fatto con
// `supabase functions deploy stripe-webhook --no-verify-jwt`. L'unica protezione è la firma.
// Nessun SDK di Stripe: solo Web Crypto (`firma.ts`).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { verificaFirma } from './firma.ts';
import { aggiornamentoDaEvento } from './eventi.ts';

const env = (nome: string): string => {
  const valore = Deno.env.get(nome);
  if (!valore) throw new Error(`Manca la variabile ${nome}`);
  return valore;
};

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

Deno.serve(async (richiesta) => {
  if (richiesta.method !== 'POST') return new Response('Metodo non ammesso', { status: 405 });

  const segreto = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!segreto) return new Response('Webhook di Stripe non configurato', { status: 503 });

  // La firma si calcola sul testo grezzo: mai sul JSON riserializzato.
  const corpo = await richiesta.text();
  const firmaValida = await verificaFirma(
    corpo,
    richiesta.headers.get('stripe-signature'),
    segreto,
    Math.floor(Date.now() / 1000),
  );
  if (!firmaValida) return new Response('Firma non valida', { status: 400 });

  let evento: { id?: unknown; type?: unknown };
  try {
    evento = JSON.parse(corpo) as { id?: unknown; type?: unknown };
  } catch {
    return new Response('JSON non valido', { status: 400 });
  }
  if (typeof evento?.id !== 'string' || typeof evento.type !== 'string') {
    return new Response('Evento senza id o tipo', { status: 400 });
  }
  const { id, type } = evento;

  const { data: giaRicevuto, error: erroreLettura } = await supabase
    .from('stripe_eventi')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (erroreLettura) return erroreDatabase('lettura evento', erroreLettura.message);
  if (giaRicevuto) return Response.json({ ricevuto: true, duplicato: true });

  const aggiornamento = aggiornamentoDaEvento(evento, {
    starter: Deno.env.get('STRIPE_PRICE_STARTER') ?? null,
    pro: Deno.env.get('STRIPE_PRICE_PRO') ?? null,
  });

  if (aggiornamento) {
    const { error } = await supabase.rpc('aggiorna_abbonamento_stripe', {
      p_officina_id: aggiornamento.officina_id,
      p_customer: aggiornamento.customer,
      p_subscription: aggiornamento.subscription,
      p_stato: aggiornamento.stato,
      p_piano: aggiornamento.piano,
    });
    if (error) return erroreDatabase(`aggiornamento (${type} ${id})`, error.message);
  }

  const { data: nuovo, error: erroreRegistra } = await supabase.rpc('registra_evento_stripe', {
    p_id: id,
    p_tipo: type,
  });
  if (erroreRegistra) return erroreDatabase('registrazione evento', erroreRegistra.message);

  // `nuovo` è false solo se una consegna contemporanea dello stesso evento l'ha registrato prima.
  return Response.json({
    ricevuto: true,
    duplicato: nuovo === false,
    aggiornato: aggiornamento !== null,
  });
});

// 500: Stripe ritenta. Il messaggio del database resta nei log, non va a Stripe.
function erroreDatabase(fase: string, messaggio: string): Response {
  console.error('Webhook di Stripe: errore del database,', fase, messaggio);
  return new Response('Errore del database', { status: 500 });
}
