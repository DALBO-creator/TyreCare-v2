import { TelefonoSchema, normalizzaTarga, type Tables } from '@tyrecare/shared';
import { z } from 'zod';
import { sessioneCorrente } from './auth';
import { ErroreModulo } from './errori';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

// Intervento su strada, lato cliente (R18): il cliente fermo con una gomma manda la sua posizione e una
// descrizione; il database la gira alle officine vicine che offrono il servizio (`crea_richiesta_strada`)
// e la prima che accetta la prende. Le regole (una sola richiesta in corso, raggio, scadenze) sono tutte
// nelle funzioni SQL; qui ci sono i controlli del modulo e i testi degli errori.

/** Ore di validità di una richiesta accettata: come `interval '24 hours'` nelle funzioni SQL. */
const ORE_ACCETTATA = 24;

/** Ogni quanto la pagina rilegge la richiesta (R18: niente tempo reale nella prima versione). */
export const INTERVALLO_AGGIORNAMENTO_MS = 15_000;

/** Frase sotto il modulo (R18): chi fa l'intervento e cosa fare in pericolo. */
export const FRASE_RESPONSABILITA =
  "TyreCare inoltra la richiesta alle officine vicine che offrono il servizio: l'intervento lo fa e lo concorda l'officina. In pericolo chiama il 112.";

/** Campo del modulo a cui appartiene l'errore, per ogni chiave del database. */
const CAMPI: Record<string, string> = {
  DESCRIZIONE_NON_VALIDA: 'descrizione',
  TELEFONO_NON_VALIDO: 'telefono',
  TARGA_NON_VALIDA: 'targa',
};

// Errori attesi delle funzioni SQL (messaggio = chiave) → testo per l'utente
export const MESSAGGI: Record<string, string> = {
  POSIZIONE_NON_VALIDA: 'La posizione non è valida. Controlla il GPS e riprova.',
  DESCRIZIONE_NON_VALIDA: 'Scrivi cosa è successo, al massimo in 500 caratteri.',
  TELEFONO_NON_VALIDO:
    'Controlla il numero: solo cifre e spazi, eventualmente con + davanti (es. +39 333 1234567)',
  TARGA_NON_VALIDA: 'La targa può avere al massimo 10 caratteri.',
  RICHIESTA_GIA_APERTA:
    'Hai già una richiesta in corso. Ricarica la pagina per seguirla o per annullarla.',
  NESSUNA_OFFICINA:
    "Nessuna officina vicina offre l'aiuto su strada in questo momento. Chiama un soccorso stradale; in pericolo chiama il 112.",
  RICHIESTA_NON_DISPONIBILE:
    'Questa richiesta non è più disponibile: è già stata chiusa, annullata o è scaduta.',
};

/** Un errore atteso diventa un `ErroreModulo` con il suo messaggio; gli altri restano come sono. */
export function traduci(errore: { message?: string } | null): unknown {
  const chiave = errore?.message;
  const messaggio = chiave ? MESSAGGI[chiave] : undefined;
  return messaggio && chiave ? new ErroreModulo(messaggio, CAMPI[chiave], chiave) : errore;
}

/** Modulo della richiesta: descrizione 1–500 caratteri, telefono obbligatorio, targa facoltativa. */
export const RichiestaStradaSchema = z.object({
  descrizione: z
    .string()
    .trim()
    .min(1, { error: 'Scrivi cosa è successo', abort: true })
    .max(500, { error: 'La descrizione può avere al massimo 500 caratteri' }),
  // Come il telefono del profilo, ma obbligatorio: lo schema condiviso dà `null` per il campo vuoto
  telefono: TelefonoSchema.refine((s): s is string => s !== null, {
    error: 'Inserisci un telefono, così l’officina può richiamarti',
  }),
  targa: z
    .string()
    .transform(normalizzaTarga)
    .refine((s) => s.length <= 10, { error: 'La targa può avere al massimo 10 caratteri' }),
});
export type RichiestaStrada = z.output<typeof RichiestaStradaSchema>;

export interface Posizione {
  latitudine: number;
  longitudine: number;
}

/** Testo per un errore di `navigator.geolocation` (1 = permesso negato, 3 = tempo scaduto). */
export function messaggioPosizione(codice?: number): string {
  if (codice === 1) {
    return 'Non riusciamo a sapere dove sei: controlla i permessi di posizione del browser.';
  }
  if (codice === 3) {
    return 'Non riusciamo a trovare la tua posizione in tempo: controlla che il GPS sia acceso e riprova.';
  }
  return 'Non riusciamo a sapere dove sei: controlla i permessi di posizione del browser e il GPS.';
}

/** Posizione del telefono; se non si riesce, un `ErroreModulo` con il motivo. */
export function posizioneAttuale(): Promise<Posizione> {
  return new Promise((risolvi, rifiuta) => {
    if (!('geolocation' in navigator)) {
      rifiuta(new ErroreModulo(messaggioPosizione()));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => risolvi({ latitudine: coords.latitude, longitudine: coords.longitude }),
      (errore) => rifiuta(new ErroreModulo(messaggioPosizione(errore.code))),
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Invia la richiesta e restituisce il suo id. Non si ripete su errore di rete: sarebbe una doppia richiesta. */
export async function creaRichiestaStrada(
  dati: RichiestaStrada,
  posizione: Posizione,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('crea_richiesta_strada', {
    p_latitudine: posizione.latitudine,
    p_longitudine: posizione.longitudine,
    p_descrizione: dati.descrizione,
    p_telefono: dati.telefono,
    ...(dati.targa ? { p_targa: dati.targa } : {}),
  });
  if (error) throw traduci(error);
  if (!data) throw new Error('Richiesta non creata');
  return data;
}

/** Annulla una richiesta del cliente (aperta o accettata). */
export async function annullaRichiestaStrada(id: string): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().rpc('annulla_richiesta_strada', { p_id: id }),
  );
  if (error) throw traduci(error);
}

export type RichiestaInCorso = Pick<
  Tables<'richieste_strada'>,
  'id' | 'stato' | 'descrizione' | 'scade_il' | 'accettata_il' | 'targa'
> & {
  officina: Pick<Tables<'officine'>, 'ragione_sociale' | 'telefono'> | null;
};

/**
 * Vero se la richiesta è ancora valida a `adesso`: il job del database sistema le scadute ogni 10
 * minuti, nel frattempo la pagina non deve mostrare come "in corso" una richiesta già scaduta.
 */
export function ancoraInCorso(
  r: Pick<RichiestaInCorso, 'stato' | 'scade_il' | 'accettata_il'>,
  adesso = new Date(),
): boolean {
  if (r.stato === 'APERTA') return new Date(r.scade_il) > adesso;
  if (r.stato === 'ACCETTATA') {
    const fine = new Date(r.accettata_il ?? r.scade_il).getTime() + ORE_ACCETTATA * 3600_000;
    return fine > adesso.getTime();
  }
  return false;
}

/** La richiesta `APERTA` o `ACCETTATA` più recente del cliente, se ancora valida. */
export async function richiestaInCorso(): Promise<RichiestaInCorso | null> {
  // La RLS fa leggere anche le richieste accettate dalla propria officina e (all'admin) tutte: qui
  // servono solo quelle fatte da questo utente
  const utente = sessioneCorrente()?.user;
  if (!utente) throw new Error('Nessun utente autenticato');
  const { data, error } = await getSupabase()
    .from('richieste_strada')
    .select(
      'id, stato, descrizione, scade_il, accettata_il, targa, officina:officine (ragione_sociale, telefono)',
    )
    .eq('cliente_id', utente.id)
    .in('stato', ['APERTA', 'ACCETTATA'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data && ancoraInCorso(data) ? data : null;
}
