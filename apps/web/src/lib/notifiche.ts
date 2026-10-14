import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Tables } from '@tyrecare/shared';
import { sessioneCorrente } from './auth';
import { getSupabase } from './supabase';

// Notifiche nell'app (Fase 5). Le crea il database (trigger sulle prenotazioni); qui si leggono, si
// segnano come lette e si tiene aggiornato il contatore delle non lette nella navigazione, in tempo
// reale con Supabase Realtime (la RLS vale anche lì: arrivano solo le proprie).

export type Notifica = Tables<'notifiche'>;

/** Quante notifiche mostrare: le più vecchie restano nel database ma non servono più. */
const LIMITE = 50;

export async function caricaNotifiche(): Promise<Notifica[]> {
  const { data, error } = await getSupabase()
    .from('notifiche')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIMITE);
  if (error) throw error;
  return data;
}

/** Segna come lette tutte le notifiche (o solo quelle di una prenotazione). */
export async function segnaLette(prenotazioneId?: string): Promise<void> {
  let query = getSupabase()
    .from('notifiche')
    .update({ letta_il: new Date().toISOString() })
    .is('letta_il', null);
  if (prenotazioneId) query = query.eq('prenotazione_id', prenotazioneId);
  const { error } = await query;
  if (error) throw error;
  await aggiornaContatore();
}

// ---------------------------------------------------------------------------------------------------
// Contatore delle non lette
// ---------------------------------------------------------------------------------------------------

let nonLette = 0;
let utente: string | null = null;
let canale: RealtimeChannel | null = null;

/** Ultimo numero noto di notifiche non lette (per disegnare subito la navigazione). */
export const notificheNonLette = (): number => nonLette;

/** "3 notifiche da leggere": per il lettore di schermo e per il titolo della voce. */
export const testoNonLette = (n: number): string =>
  n === 1 ? '1 notifica da leggere' : `${n} notifiche da leggere`;

/** Numero nel badge: oltre 9 basta "9+". */
export const numeroBadge = (n: number): string => (n > 9 ? '9+' : String(n));

/** Aggiorna i badge già sullo schermo (la navigazione si ridisegna a ogni pagina). */
function mostraContatore(annuncia: boolean): void {
  for (const badge of document.querySelectorAll<HTMLElement>('[data-notifiche-badge]')) {
    badge.hidden = nonLette === 0;
    badge.textContent = numeroBadge(nonLette);
  }
  for (const testo of document.querySelectorAll<HTMLElement>('[data-notifiche-testo]')) {
    testo.textContent = nonLette ? `, ${testoNonLette(nonLette)}` : '';
  }
  // Annunciato solo quando arriva qualcosa di nuovo, non a ogni cambio di pagina
  const annuncio = document.querySelector<HTMLElement>('[data-notifiche-annuncio]');
  if (annuncia && annuncio) annuncio.textContent = `Nuova notifica: ${testoNonLette(nonLette)}`;
}

export async function aggiornaContatore(): Promise<void> {
  if (!utente) return;
  const { count, error } = await getSupabase()
    .from('notifiche')
    .select('id', { count: 'exact', head: true })
    .is('letta_il', null);
  // Il contatore è un aiuto: se la rete non risponde resta l'ultimo valore
  if (error || count === null) return;
  const prima = nonLette;
  nonLette = count;
  mostraContatore(count > prima);
}

function ferma(): void {
  if (canale) void getSupabase().removeChannel(canale);
  canale = null;
  utente = null;
  nonLette = 0;
}

let visibilitaAttiva = false;

/**
 * Avvia (una volta per account) il contatore: lo legge e si iscrive ai cambiamenti. Si chiama a ogni
 * pagina con login; se l'account è cambiato riparte da capo, se non c'è più si ferma.
 */
export function avviaNotifiche(): void {
  const uid = sessioneCorrente()?.user.id ?? null;
  if (uid === utente) return;
  ferma();
  if (!uid) return;
  utente = uid;

  canale = getSupabase()
    .channel(`notifiche:${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifiche', filter: `destinatario_id=eq.${uid}` },
      () => void aggiornaContatore(),
    )
    .subscribe();
  void aggiornaContatore();

  // Tornando sull'app (telefono in tasca, scheda in secondo piano) il canale può essersi perso
  if (!visibilitaAttiva) {
    visibilitaAttiva = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void aggiornaContatore();
    });
  }
}

/** Dopo l'uscita: niente canale aperto né numeri del vecchio account. */
export const fermaNotifiche = ferma;

// ---------------------------------------------------------------------------------------------------
// Testi
// ---------------------------------------------------------------------------------------------------

const FORMATO_DATA = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Rome',
});
const FORMATO_GIORNO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });

/** Da quanto è arrivata: "Adesso", "5 min fa", "3 ore fa", "Ieri", "13 ott". */
export function tempoTrascorso(iso: string, adesso = new Date()): string {
  const data = new Date(iso);
  const minuti = Math.floor((adesso.getTime() - data.getTime()) / 60_000);
  if (minuti < 1) return 'Adesso';
  if (minuti < 60) return `${minuti} min fa`;
  const stessoGiorno = FORMATO_GIORNO.format(data) === FORMATO_GIORNO.format(adesso);
  if (stessoGiorno) {
    const ore = Math.floor(minuti / 60);
    return ore === 1 ? "Un'ora fa" : `${ore} ore fa`;
  }
  const ieri = new Date(adesso.getTime() - 86_400_000);
  if (FORMATO_GIORNO.format(data) === FORMATO_GIORNO.format(ieri)) return 'Ieri';
  return FORMATO_DATA.format(data);
}
