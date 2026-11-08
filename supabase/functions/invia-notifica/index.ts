// Edge Function (Deno) — Web Push di una notifica (Fase 5, P21).
//
// La chiama il trigger `notifiche_push` del database (con `pg_net`) a ogni nuova notifica, con il
// segreto condiviso nell'intestazione `x-segreto`. Legge la notifica e i dispositivi del destinatario
// con la service role e manda la push con le chiavi VAPID. I dispositivi che il servizio push dà per
// scaduti (404/410) vengono eliminati.
//
// Segreti (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SEGRETO.
// Facoltativa: VAPID_CONTATTO (contatto per i servizi push, es. mailto:indirizzo; vuota o assente =
// mailto:albodavide1@gmail.com, R37).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
//
// Email di riserva (T066), facoltativa e spenta finché non c'è il dominio di TyreCare: se nessuna push
// è partita e EMAIL_NOTIFICHE=si, la notifica va per email (Resend) all'indirizzo del destinatario.
// Variabili facoltative: EMAIL_NOTIFICHE ('si' per accendere), RESEND_API_KEY, EMAIL_MITTENTE
// (es. "TyreCare <notifiche@dominio>"), SITO_URL (es. https://dominio). Senza EMAIL_NOTIFICHE=si il
// comportamento è quello di prima e la risposta ha `email: false`.
// Preferenza dell'utente (T199): prima dell'email si legge `profiles.email_notifiche` del destinatario;
// con `false`, profilo assente o errore di lettura niente email (`email: false`), Resend non si chiama.
//
// Il flusso è in `invio.ts` (provato con vitest); qui solo il cablaggio con Deno, `web-push` e il
// database (service role).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';
import { gestisciNotifica, type DbNotifica } from './invio.ts';

const env = (nome: string): string => {
  const valore = Deno.env.get(nome);
  if (!valore) throw new Error(`Manca la variabile ${nome}`);
  return valore;
};

webpush.setVapidDetails(
  Deno.env.get('VAPID_CONTATTO') || 'mailto:albodavide1@gmail.com',
  env('VAPID_PUBLIC_KEY'),
  env('VAPID_PRIVATE_KEY'),
);
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

const db: DbNotifica = {
  async notifica(id) {
    const { data, error } = await supabase
      .from('notifiche')
      .select('id, destinatario_id, titolo, testo, link')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  },
  async iscrizioni(profileId) {
    const { data, error } = await supabase
      .from('iscrizioni_push')
      .select('id, endpoint, p256dh, auth')
      .eq('profile_id', profileId);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async cancellaIscrizione(id) {
    // L'errore non si controlla, come prima di T113: al prossimo invio si riprova
    await supabase.from('iscrizioni_push').delete().eq('id', id);
  },
  async preferenzaEmail(profileId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email_notifiche')
      .eq('id', profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  },
  async emailUtente(utenteId) {
    const { data, error } = await supabase.auth.admin.getUserById(utenteId);
    if (error) throw new Error(error.message);
    return data.user?.email || null;
  },
};

Deno.serve((richiesta) =>
  gestisciNotifica(richiesta, {
    env: (nome) => Deno.env.get(nome) || undefined,
    fetchFn: (url, init) => fetch(url, init),
    inviaPush: (sottoscrizione, contenuto, opzioni) =>
      webpush.sendNotification(sottoscrizione, contenuto, opzioni),
    db,
  }),
);
