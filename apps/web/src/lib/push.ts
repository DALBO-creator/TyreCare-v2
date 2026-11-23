import { getSupabase } from './supabase';

// Notifiche push (Fase 5, P21). Il browser si iscrive con la chiave pubblica VAPID e l'iscrizione si
// salva in `iscrizioni_push`; le push le manda la Edge Function `invia-notifica` a ogni nuova notifica.

/** Chiave pubblica VAPID: non è un segreto (la privata è solo nei segreti di Supabase). */
const CHIAVE_PUBBLICA =
  'BIasiLRUvmBKfqG0ULj1xYcEtRcAVdgr9Ca3-ZoNf2s7SF7jjytHZdXnTpxd7tt7V9WABWL_kIrcy7ouN-dzN04';

/**
 * - `non-supportate`: il browser non ha le push;
 * - `installa`: iPhone/iPad senza l'app nella schermata Home (lì le push funzionano solo così, P5);
 * - `bloccate`: l'utente ha negato il permesso (si riattiva dalle impostazioni del browser);
 * - `attive` / `spente`: su questo dispositivo.
 */
export type StatoPush = 'non-supportate' | 'installa' | 'bloccate' | 'attive' | 'spente';

const apple = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installata = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Converte la chiave VAPID (base64url) nei byte chiesti da `pushManager.subscribe`. */
export function chiaveInByte(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const testo = atob(base64);
  const byte = new Uint8Array(new ArrayBuffer(testo.length));
  for (let i = 0; i < testo.length; i++) byte[i] = testo.charCodeAt(i);
  return byte;
}

async function registrazione(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function statoPush(): Promise<StatoPush> {
  if (apple() && !installata()) return 'installa';
  if (!('PushManager' in window) || !('Notification' in window)) return 'non-supportate';
  if (Notification.permission === 'denied') return 'bloccate';
  const reg = await registrazione();
  if (!reg) return 'non-supportate';
  return (await reg.pushManager.getSubscription()) ? 'attive' : 'spente';
}

/** Chiede il permesso (solo dopo un tocco dell'utente) e salva l'iscrizione di questo dispositivo. */
export async function attivaPush(): Promise<StatoPush> {
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return permesso === 'denied' ? 'bloccate' : 'spente';
  const reg = await navigator.serviceWorker.ready;
  const iscrizione =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chiaveInByte(CHIAVE_PUBBLICA),
    }));
  const { endpoint, keys } = iscrizione.toJSON();
  const { error } = await getSupabase().rpc('iscrivi_push', {
    p_endpoint: endpoint ?? '',
    p_p256dh: keys?.p256dh ?? '',
    p_auth: keys?.auth ?? '',
  });
  if (error) {
    await iscrizione.unsubscribe();
    throw error;
  }
  return 'attive';
}

/**
 * Spegne le push su questo dispositivo (le notifiche restano nell'app).
 * Se il database fallisce l'errore sale prima di `unsubscribe`: il server continuerebbe a mandare.
 */
export async function disattivaPush(): Promise<StatoPush> {
  const iscrizione = await (await registrazione())?.pushManager.getSubscription();
  if (iscrizione) {
    const { error } = await getSupabase()
      .from('iscrizioni_push')
      .delete()
      .eq('endpoint', iscrizione.endpoint);
    if (error) throw error;
    await iscrizione.unsubscribe();
  }
  return 'spente';
}
