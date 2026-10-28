// Edge Function (Deno) — Web Push di una notifica (Fase 5, P21).
//
// La chiama il trigger `notifiche_push` del database (con `pg_net`) a ogni nuova notifica, con il
// segreto condiviso nell'intestazione `x-segreto`. Legge la notifica e i dispositivi del destinatario
// con la service role e manda la push con le chiavi VAPID. I dispositivi che il servizio push dà per
// scaduti (404/410) vengono eliminati.
//
// Segreti (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SEGRETO.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
//
// Email di riserva (T066), facoltativa e spenta finché non c'è il dominio di TyreCare: se nessuna push
// è partita e EMAIL_NOTIFICHE=si, la notifica va per email (Resend) all'indirizzo del destinatario.
// Variabili facoltative: EMAIL_NOTIFICHE ('si' per accendere), RESEND_API_KEY, EMAIL_MITTENTE
// (es. "TyreCare <notifiche@dominio>"), SITO_URL (es. https://dominio). Senza EMAIL_NOTIFICHE=si il
// comportamento è quello di prima e la risposta ha `email: false`.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';
import { componiEmailNotifica } from './email.ts';

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

  let email = false;
  if (inviate === 0 && Deno.env.get('EMAIL_NOTIFICHE') === 'si') {
    try {
      email = await inviaEmailDiRiserva(notifica);
    } catch (e) {
      console.error('Email non inviata', (e as Error).message);
    }
  }
  return Response.json({ inviate, dispositivi: iscrizioni?.length ?? 0, email });
});

// Manda la notifica per email con Resend; `true` solo se Resend l'ha accettata. Non lancia per
// configurazione mancante o destinatario senza email: scrive l'errore e restituisce `false`.
async function inviaEmailDiRiserva(notifica: {
  destinatario_id: string;
  titolo: string;
  testo: string;
  link: string | null;
}): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  const mittente = Deno.env.get('EMAIL_MITTENTE');
  const sitoUrl = Deno.env.get('SITO_URL');
  if (!chiave || !mittente || !sitoUrl) {
    console.error('Email di riserva: mancano RESEND_API_KEY, EMAIL_MITTENTE o SITO_URL');
    return false;
  }
  const { data, error } = await supabase.auth.admin.getUserById(notifica.destinatario_id);
  if (error) {
    console.error('Email di riserva: utente non letto', error.message);
    return false;
  }
  const indirizzo = data.user?.email;
  if (!indirizzo) return false;

  const { oggetto, testo, html } = componiEmailNotifica(notifica, sitoUrl);
  const risposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + chiave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mittente, to: [indirizzo], subject: oggetto, text: testo, html }),
  });
  if (!risposta.ok) console.error('Email di riserva: Resend ha risposto', risposta.status);
  await risposta.body?.cancel(); // il corpo non serve: chiuderlo evita risorse aperte in Deno
  return risposta.ok;
}
