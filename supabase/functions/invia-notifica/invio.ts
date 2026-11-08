// Flusso dell'invio di una notifica (Fase 5 P21, T066, T199, T113). La usa `index.ts`, che le passa
// variabili, `fetch`, l'invio push (`web-push`) e le letture/scritture del database (service role).
// Senza Deno, così la provano i test di vitest (project `funzioni`).
//
// 1. Segreto `x-segreto` diverso da PUSH_SEGRETO → 401; `notifica_id` mancante → 400; notifica assente
//    → 404; errore del database → 500 con il messaggio.
// 2. Push a ogni dispositivo del destinatario; quelli che il servizio push dà per scaduti (404/410) si
//    cancellano, gli altri errori finiscono nel log.
// 3. Solo se nessuna push è partita e EMAIL_NOTIFICHE=si: email di riserva con Resend, se il destinatario
//    non l'ha spenta (`profiles.email_notifiche`) e ci sono RESEND_API_KEY, EMAIL_MITTENTE e SITO_URL.
// Risposta: `{ inviate, dispositivi, email }`.

import { componiEmailNotifica } from './email.ts';

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface Notifica {
  id: string;
  destinatario_id: string;
  titolo: string;
  testo: string;
  link: string | null;
}

export interface IscrizionePush {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sottoscrizione nel formato di `web-push`. */
export interface SottoscrizionePush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface OpzioniPush {
  TTL: number;
  urgency: 'high';
}

/** Database (service role). Le letture lanciano `Error(<messaggio del database>)` in caso di errore. */
export interface DbNotifica {
  /** La notifica, `null` se non esiste. */
  notifica(id: string): Promise<Notifica | null>;
  /** I dispositivi iscritti alle push del destinatario. */
  iscrizioni(profileId: string): Promise<IscrizionePush[]>;
  /** Cancella un dispositivo scaduto. Non lancia: un errore si ignora, come prima di T113. */
  cancellaIscrizione(id: string): Promise<void>;
  /** `profiles.email_notifiche` del destinatario, `null` se il profilo non esiste. */
  preferenzaEmail(profileId: string): Promise<{ email_notifiche: boolean | null } | null>;
  /** Email dell'utente (`auth.admin.getUserById`), `null` se non ne ha una. */
  emailUtente(utenteId: string): Promise<string | null>;
}

export interface DipendenzeNotifica {
  env: (nome: string) => string | undefined;
  fetchFn: FetchFn;
  /** `webpush.sendNotification`: lancia un errore con `statusCode` se il servizio push rifiuta. */
  inviaPush: (
    sottoscrizione: SottoscrizionePush,
    contenuto: string,
    opzioni: OpzioniPush,
  ) => Promise<unknown>;
  db: DbNotifica;
}

const messaggio = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function gestisciNotifica(
  richiesta: Request,
  { env, fetchFn, inviaPush, db }: DipendenzeNotifica,
): Promise<Response> {
  const segreto = env('PUSH_SEGRETO');
  // Come prima: senza il segreto configurato la funzione lancia (500 di Deno.serve)
  if (!segreto) throw new Error('Manca la variabile PUSH_SEGRETO');
  if (richiesta.headers.get('x-segreto') !== segreto) {
    return new Response('Non autorizzato', { status: 401 });
  }
  const { notifica_id } = (await richiesta.json()) as { notifica_id?: string };
  if (!notifica_id) return new Response('notifica_id mancante', { status: 400 });

  let notifica: Notifica | null;
  try {
    notifica = await db.notifica(notifica_id);
  } catch (e) {
    return new Response(messaggio(e), { status: 500 });
  }
  if (!notifica) return new Response('Notifica non trovata', { status: 404 });

  let iscrizioni: IscrizionePush[];
  try {
    iscrizioni = await db.iscrizioni(notifica.destinatario_id);
  } catch (e) {
    return new Response(messaggio(e), { status: 500 });
  }

  // Stesso formato letto dal service worker (`public/sw-push.js`)
  const contenuto = JSON.stringify({
    titolo: notifica.titolo,
    testo: notifica.testo,
    link: notifica.link,
    id: notifica.id,
  });

  let inviate = 0;
  await Promise.all(
    iscrizioni.map(async (i) => {
      try {
        await inviaPush(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          contenuto,
          { TTL: 60 * 60 * 24, urgency: 'high' },
        );
        inviate++;
      } catch (e) {
        const stato = (e as { statusCode?: number }).statusCode;
        if (stato === 404 || stato === 410) {
          await db.cancellaIscrizione(i.id);
        } else {
          console.error('Push non inviata', stato, (e as Error).message);
        }
      }
    }),
  );

  let email = false;
  if (inviate === 0 && env('EMAIL_NOTIFICHE') === 'si') {
    try {
      email = await inviaEmailDiRiserva(notifica, { env, fetchFn, db });
    } catch (e) {
      console.error('Email non inviata', (e as Error).message);
    }
  }
  return Response.json({ inviate, dispositivi: iscrizioni.length, email });
}

// Manda la notifica per email con Resend; `true` solo se Resend l'ha accettata. Non lancia per
// configurazione mancante o destinatario senza email: scrive l'errore e restituisce `false`.
// Prima controlla la preferenza del destinatario (`email_notifiche`, T199).
async function inviaEmailDiRiserva(
  notifica: Notifica,
  { env, fetchFn, db }: Pick<DipendenzeNotifica, 'env' | 'fetchFn' | 'db'>,
): Promise<boolean> {
  let profilo: { email_notifiche: boolean | null } | null;
  try {
    profilo = await db.preferenzaEmail(notifica.destinatario_id);
  } catch (e) {
    console.error('Email di riserva: preferenza non letta', messaggio(e));
    return false;
  }
  // Profilo assente (account eliminato nel frattempo) o email spente dall'utente: niente email
  if (!profilo || profilo.email_notifiche === false) return false;

  const chiave = env('RESEND_API_KEY');
  const mittente = env('EMAIL_MITTENTE');
  const sitoUrl = env('SITO_URL');
  if (!chiave || !mittente || !sitoUrl) {
    console.error('Email di riserva: mancano RESEND_API_KEY, EMAIL_MITTENTE o SITO_URL');
    return false;
  }
  let indirizzo: string | null;
  try {
    indirizzo = await db.emailUtente(notifica.destinatario_id);
  } catch (e) {
    console.error('Email di riserva: utente non letto', messaggio(e));
    return false;
  }
  if (!indirizzo) return false;

  const { oggetto, testo, html } = componiEmailNotifica(notifica, sitoUrl);
  const risposta = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + chiave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mittente, to: [indirizzo], subject: oggetto, text: testo, html }),
  });
  if (!risposta.ok) console.error('Email di riserva: Resend ha risposto', risposta.status);
  await risposta.body?.cancel(); // il corpo non serve: chiuderlo evita risorse aperte in Deno
  return risposta.ok;
}
