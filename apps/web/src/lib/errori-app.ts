import type { Database } from '@tyrecare/shared';
import { sessioneCorrente } from './auth';
import { ErroreModulo } from './errori';
import { erroreDiRete } from './rete';
import { getSupabase } from './supabase';

/**
 * Raccolta degli errori dell'app (R33): le eccezioni non gestite e le pagine che non si caricano
 * arrivano nella tabella `errori_app` (le legge solo l'amministratore). Modulo del file iniziale:
 * niente `zod` né schemi, solo moduli leggeri.
 */

type RigaErrore = Database['public']['Tables']['errori_app']['Insert'];

/** Limiti dei check della tabella `errori_app` */
const MAX_PERCORSO = 200;
const MAX_MESSAGGIO = 500;
const MAX_DETTAGLIO = 2000;
const MAX_VERSIONE = 40;
const MAX_AGENTE = 300;
/** Invii al massimo per caricamento dell'app */
const MAX_INVII = 5;

const giaInviati = new Set<string>();
let invii = 0;

/**
 * `erroreDiRete` scarta ogni `TypeError` (è quello di `fetch`), ma qui perderebbe i bug di programma
 * («Cannot read properties of undefined»): un `TypeError` è di rete solo se il messaggio lo dice
 * (Chrome, Firefox, Safari, import dinamico di un modulo).
 */
function erroreDiReteDaScartare(errore: unknown): boolean {
  if (errore instanceof TypeError)
    return /failed to fetch|networkerror|load failed/i.test(errore.message);
  return erroreDiRete(errore);
}

/** Solo per i test: riparte da zero i doppioni e il contatore. */
export function _azzeraPerTest(): void {
  giaInviati.clear();
  invii = 0;
}

function testo(valore: unknown): string {
  return typeof valore === 'string' ? valore : '';
}

/**
 * Costruisce la riga da inviare. Il percorso è senza query e hash (i link di inviti e report hanno
 * codici); nel messaggio e nel dettaglio vanno solo `message` e `stack` dell'errore.
 */
export function preparaErrore(errore: unknown, contesto?: string): RigaErrore {
  const { message, stack } = (typeof errore === 'object' && errore !== null ? errore : {}) as {
    message?: unknown;
    stack?: unknown;
  };
  let messaggio = testo(message) || (typeof errore === 'string' ? errore : '');
  if (!messaggio.trim()) messaggio = 'Errore sconosciuto';
  if (contesto) messaggio = `[${contesto}] ${messaggio}`;
  return {
    id: crypto.randomUUID(),
    percorso: location.pathname.slice(0, MAX_PERCORSO),
    messaggio: messaggio.slice(0, MAX_MESSAGGIO),
    dettaglio: testo(stack).slice(0, MAX_DETTAGLIO),
    versione: (typeof __VERSIONE_APP__ === 'string' ? __VERSIONE_APP__ : '').slice(0, MAX_VERSIONE),
    agente: navigator.userAgent.slice(0, MAX_AGENTE),
  };
}

/**
 * Segnala un errore all'amministratore. Non lancia e non attende. Non invia: senza sessione, offline,
 * per errori di rete o `ErroreModulo`, per lo stesso messaggio già inviato nella stessa pagina, oltre
 * 5 invii per caricamento. Un errore dell'invio si ignora (mai un ciclo di segnalazioni).
 */
export function segnalaErrore(errore: unknown, contesto?: string): void {
  try {
    if (errore instanceof ErroreModulo || erroreDiReteDaScartare(errore)) return;
    if (!sessioneCorrente() || !navigator.onLine) return;
    if (invii >= MAX_INVII) return;
    const riga = preparaErrore(errore, contesto);
    const chiave = `${riga.percorso}\n${riga.messaggio}`;
    if (giaInviati.has(chiave)) return;
    giaInviati.add(chiave);
    invii++;
    void Promise.resolve(getSupabase().from('errori_app').insert(riga)).then(
      () => {},
      () => {},
    );
  } catch {
    // mai un errore nella segnalazione degli errori
  }
}
