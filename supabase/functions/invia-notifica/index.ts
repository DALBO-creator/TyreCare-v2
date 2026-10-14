// Edge Function (Deno) — Web Push di una notifica (Fase 5, P21).
//
// La chiama il trigger `notifiche_push` del database (con `pg_net`) a ogni nuova notifica, con il
// segreto condiviso nell'intestazione `x-segreto`. Legge la notifica e i dispositivi del destinatario
// con la service role e manda la push con le chiavi VAPID. I dispositivi che il servizio push dà per
// scaduti (404/410) vengono eliminati.
//
// Segreti (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SEGRETO.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';

const env = (nome: string): string => {
  const valore = Deno.env.get(nome);
  if (!valore) throw new Error(`Manca la variabile ${nome}`);
  return valore;
};

webpush.setVapidDetails(
  'mailto:albodavide1@gmail.com',
  env('VAPID_PUBLIC_KEY'),
  env('VAPID_PRIVATE_KEY'),
);
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

Deno.serve(async (richiesta) => {
  if (richiesta.headers.get('x-segreto') !== env('PUSH_SEGRETO')) {
    return new Response('Non autorizzato', { status: 401 });
  }
  const { notifica_id } = (await richiesta.json()) as { notifica_id?: string };
  if (!notifica_id) return new Response('notifica_id mancante', { status: 400 });

  const { data: notifica, error } = await supabase
    .from('notifiche')
    .select('id, destinatario_id, titolo, testo, link')
    .eq('id', notifica_id)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!notifica) return new Response('Notifica non trovata', { status: 404 });

  const { data: iscrizioni, error: errore } = await supabase
    .from('iscrizioni_push')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', notifica.destinatario_id);
  if (errore) return new Response(errore.message, { status: 500 });

  // Stesso formato letto dal service worker (`public/sw-push.js`)
  const contenuto = JSON.stringify({
    titolo: notifica.titolo,
    testo: notifica.testo,
    link: notifica.link,
    id: notifica.id,
  });

  let inviate = 0;
  await Promise.all(
    (iscrizioni ?? []).map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          contenuto,
          { TTL: 60 * 60 * 24, urgency: 'high' },
        );
        inviate++;
      } catch (e) {
        const stato = (e as { statusCode?: number }).statusCode;
        if (stato === 404 || stato === 410) {
          await supabase.from('iscrizioni_push').delete().eq('id', i.id);
        } else {
          console.error('Push non inviata', stato, (e as Error).message);
        }
      }
    }),
  );
  return Response.json({ inviate, dispositivi: iscrizioni?.length ?? 0 });
});
