// Edge Function (Deno) — webhook di Stripe (T185, R22, seconda parte di T071).
//
// Stripe la chiama quando un abbonamento viene confermato, rinnovato, sospeso o annullato. Verifica la
// firma (`Stripe-Signature`) sul corpo grezzo, poi aggiorna stato e piano dell'abbonamento dell'officina
// con le funzioni del database di T180 (`aggiorna_abbonamento_stripe`, `registra_evento_stripe`), con
// la service role. Ogni evento si elabora una volta sola: quelli già in `stripe_eventi` rispondono 200
// `{ duplicato: true }`. Errori del database (T212):
// - permanenti (`errorePermanente` di `eventi.ts`: abbonamento non trovato, stato o piano non validi,
//   subscription di un'altra officina…): nessun tentativo li correggerà, quindi l'evento si scrive nel log,
//   si registra come un evento riuscito e la risposta è 200 `{ ricevuto: true, scartato: '<chiave>' }`.
//   Altrimenti Stripe lo rimanderebbe per tre giorni, fino a disattivare l'endpoint;
// - tutti gli altri (rete, database non raggiungibile…): risposta 500 e l'evento non si registra, così
//   Stripe lo rimanda più tardi.
// Se `aggiorna_abbonamento_stripe` ignora l'evento senza errore (abbonamento ATTIVO con un'altra
// subscription, T224) il webhook lo scrive nel log con le due subscription.
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
import { aggiornamentoDaEvento, errorePermanente, subscriptionIgnorata } from './eventi.ts';

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

  // Chiave d'errore permanente del database: l'evento si registra lo stesso e Stripe riceve 200.
  let scartato: string | null = null;

  if (aggiornamento) {
    const { error } = await supabase.rpc('aggiorna_abbonamento_stripe', {
      p_officina_id: aggiornamento.officina_id,
      p_customer: aggiornamento.customer,
      p_subscription: aggiornamento.subscription,
      p_stato: aggiornamento.stato,
      p_piano: aggiornamento.piano,
    });
    if (error) {
      if (!errorePermanente(error.message)) {
        return erroreDatabase(`aggiornamento (${type} ${id})`, error.message);
      }
      console.error('Webhook di Stripe: evento scartato,', type, id, error.message);
      scartato = error.message;
    } else if (aggiornamento.officina_id && aggiornamento.subscription) {
      await segnalaSeIgnorato(type, id, aggiornamento.officina_id, aggiornamento.subscription);
    }
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
    aggiornato: aggiornamento !== null && scartato === null,
    ...(scartato !== null ? { scartato } : {}),
  });
});

// Solo diagnostica: un errore di questa lettura finisce nel log e non cambia la risposta a Stripe.
async function segnalaSeIgnorato(
  type: string,
  id: string,
  officinaId: string,
  subscription: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('abbonamenti')
      .select('stripe_subscription_id')
      .eq('officina_id', officinaId)
      .maybeSingle();
    if (error) {
      console.warn(
        'Webhook di Stripe: controllo della subscription non riuscito,',
        type,
        id,
        error.message,
      );
      return;
    }
    const collegata = data?.stripe_subscription_id ?? null;
    if (subscriptionIgnorata({ subscription }, collegata)) {
      console.warn(
        "Webhook di Stripe: evento ignorato (abbonamento con un'altra subscription),",
        type,
        id,
        'evento:',
        subscription,
        'collegata:',
        collegata,
      );
    }
  } catch (errore) {
    console.warn(
      'Webhook di Stripe: controllo della subscription non riuscito,',
      type,
      id,
      String(errore),
    );
  }
}

// 500: Stripe ritenta. Il messaggio del database resta nei log, non va a Stripe.
function erroreDatabase(fase: string, messaggio: string): Response {
  console.error('Webhook di Stripe: errore del database,', fase, messaggio);
  return new Response('Errore del database', { status: 500 });
}
