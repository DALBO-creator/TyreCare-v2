import { DatiOfficinaSchema, type Tables } from '@tyrecare/shared';
import { z } from 'zod';
import { codiceErrore, ErroreModulo } from './errori';
import { conRiprova } from './rete';
import { ancoraInCorso, INTERVALLO_AGGIORNAMENTO_MS } from './strada';
import { getSupabase } from './supabase';

// Intervento su strada, lato officina (R18): il titolare decide se offrire il servizio e fino a quanti km;
// titolare e operatori vedono le richieste vicine, ne accettano una e chiamano il cliente. Le regole
// (raggio, chi vede cosa, la prima che accetta vince) sono nelle funzioni SQL di T139/T140: qui ci sono
// le letture, il filtro dell'elenco "Accettate" e i testi degli errori.

export { INTERVALLO_AGGIORNAMENTO_MS };

export const RAGGIO_MIN_KM = 5;
export const RAGGIO_MAX_KM = 100;
export const RAGGIO_PREDEFINITO_KM = 30;

// Errori attesi delle funzioni SQL (messaggio = chiave) → testo per l'utente
export const MESSAGGI: Record<string, string> = {
  RICHIESTA_NON_DISPONIBILE:
    'Questa richiesta non è più disponibile: è già stata presa da un’altra officina, chiusa, annullata o è scaduta.',
};

const MESSAGGIO_NON_AUTORIZZATO =
  'Non puoi rispondere a questa richiesta: controlla che l’officina offra l’aiuto su strada, abbia la posizione impostata e che la richiesta sia nel suo raggio.';

/** Un errore atteso diventa un `ErroreModulo` con il suo messaggio; gli altri restano come sono. */
export function traduci(errore: { message?: string } | null): unknown {
  if (!errore) return errore;
  const chiave = errore.message;
  const messaggio = chiave ? MESSAGGI[chiave] : undefined;
  if (messaggio && chiave) return new ErroreModulo(messaggio, undefined, chiave);
  if (codiceErrore(errore) === '42501') {
    return new ErroreModulo(MESSAGGIO_NON_AUTORIZZATO, undefined, '42501');
  }
  return errore;
}

// ---------------------------------------------------------------------------------------------------
// Impostazioni (pagina "Dati dell'officina")
// ---------------------------------------------------------------------------------------------------

export interface ImpostazioniStrada {
  intervento_strada: boolean;
  raggio_strada_km: number;
}

/** Casella "Offro l'aiuto su strada" (qualunque valore = spuntata) e "Fino a quanti km" (5–100, intero). */
export const ImpostazioniStradaSchema = z
  .object({
    intervento_strada: z.string().optional(),
    raggio_strada_km: z
      .string()
      .trim()
      .refine((s) => /^[0-9]+$/.test(s) && +s >= RAGGIO_MIN_KM && +s <= RAGGIO_MAX_KM, {
        error: `Scrivi un numero intero da ${RAGGIO_MIN_KM} a ${RAGGIO_MAX_KM}`,
      }),
  })
  .transform((v): ImpostazioniStrada => ({
    intervento_strada: Boolean(v.intervento_strada),
    raggio_strada_km: Number(v.raggio_strada_km),
  }));

/**
 * Dati dell'officina + impostazioni dell'aiuto su strada in un solo modulo. `DatiOfficinaSchema` non si
 * può estendere (ha una trasformazione): si validano entrambi gli schemi sugli stessi dati e si
 * uniscono gli errori, con il percorso del campo, così `collegaModulo` li mostra sotto ogni campo.
 */
export const DatiEStradaSchema = z.unknown().transform((valore, ctx) => {
  const dati = DatiOfficinaSchema.safeParse(valore);
  const strada = ImpostazioniStradaSchema.safeParse(valore);
  if (!dati.success || !strada.success) {
    const problemi = [...(dati.error?.issues ?? []), ...(strada.error?.issues ?? [])];
    for (const p of problemi) ctx.addIssue({ code: 'custom', path: p.path, message: p.message });
    return z.NEVER;
  }
  return { ...dati.data, ...strada.data };
});

// ---------------------------------------------------------------------------------------------------
// Richieste
// ---------------------------------------------------------------------------------------------------

export interface RichiestaVicina {
  id: string;
  descrizione: string;
  targa: string | null;
  distanza_km: number;
  created_at: string;
  scade_il: string;
}

export type RichiestaAccettata = Pick<
  Tables<'richieste_strada'>,
  | 'id'
  | 'stato'
  | 'officina_id'
  | 'descrizione'
  | 'targa'
  | 'telefono'
  | 'latitudine'
  | 'longitudine'
  | 'accettata_il'
  | 'scade_il'
>;

/**
 * Le richieste accettate dalla officina indicata e ancora in corso, dalla più recente. La RLS fa leggere
 * anche quelle del cliente e (all'admin) di tutte le officine: il filtro per `officina_id` è qui e non
 * si delega alla RLS (dritta T143).
 */
export function soloAccettateDi<
  T extends Pick<RichiestaAccettata, 'stato' | 'officina_id' | 'accettata_il' | 'scade_il'>,
>(righe: T[], officinaId: string, adesso = new Date()): T[] {
  return righe
    .filter(
      (r) => r.stato === 'ACCETTATA' && r.officina_id === officinaId && ancoraInCorso(r, adesso),
    )
    .sort((a, b) => (b.accettata_il ?? '').localeCompare(a.accettata_il ?? ''));
}

/** Richieste aperte entro il raggio dell'officina (vuoto se non ha i requisiti). */
export async function caricaRichiesteVicine(officinaId: string): Promise<RichiestaVicina[]> {
  const { data, error } = await getSupabase().rpc('richieste_strada_vicine', {
    p_officina_id: officinaId,
  });
  if (error) throw error;
  return data;
}

/** Richieste che questa officina ha accettato e non ha ancora chiuso. */
export async function caricaRichiesteAccettate(officinaId: string): Promise<RichiestaAccettata[]> {
  const { data, error } = await getSupabase()
    .from('richieste_strada')
    .select(
      'id, stato, officina_id, descrizione, targa, telefono, latitudine, longitudine, accettata_il, scade_il',
    )
    .eq('stato', 'ACCETTATA')
    .eq('officina_id', officinaId)
    .order('accettata_il', { ascending: false });
  if (error) throw error;
  return soloAccettateDi(data, officinaId);
}

/** Accetta una richiesta: la prima officina che arriva la prende, le altre ricevono un errore. */
export async function accettaRichiestaStrada(id: string, officinaId: string): Promise<void> {
  const { error } = await getSupabase().rpc('accetta_richiesta_strada', {
    p_id: id,
    p_officina_id: officinaId,
  });
  if (error) throw traduci(error);
}

/** Chiude una richiesta accettata dalla propria officina. */
export async function chiudiRichiestaStrada(id: string): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().rpc('chiudi_richiesta_strada', { p_id: id }),
  );
  if (error) throw traduci(error);
}

// ---------------------------------------------------------------------------------------------------
// Testi e link
// ---------------------------------------------------------------------------------------------------

const ORA = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
});

/** "scade alle 14:35" */
export const scadeAlle = (iso: string): string => `scade alle ${ORA.format(new Date(iso))}`;

export const telefonoHref = (t: string): string => `tel:${t.replace(/\s/g, '')}`;

export const linkMappa = (latitudine: number, longitudine: number): string =>
  `https://www.google.com/maps?q=${latitudine},${longitudine}`;
