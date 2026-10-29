import type { Tables } from '@tyrecare/shared';
import type { OfficinaGarage } from './garage';
import { getSupabase } from './supabase';

// Report del singolo controllo (Fase 3, PLAN §2.3): lo legge il cliente dal suo garage e chi lavora
// nell'officina che l'ha eseguito. Una sola lettura da Supabase: la RLS mostra il controllo solo a
// loro (il cliente vede anche l'officina se non è più attiva, migrazione `garage_cliente`).

/** Dello pneumatico il report mostra solo questi campi: il link pubblico non ne dà altri (T063). */
export type PneumaticoReport = Pick<
  Tables<'pneumatici'>,
  | 'id'
  | 'posizione'
  | 'stagione'
  | 'misura'
  | 'marca'
  | 'modello'
  | 'dot'
  | 'montato_il'
  | 'smontato_il'
>;

/** Misura di uno pneumatico, con i dati dello pneumatico misurato quel giorno (anche se ora smontato). */
export type MisuraReport = Pick<
  Tables<'misure_pneumatico'>,
  'battistrada_mm' | 'pressione_bar' | 'usura' | 'danni'
> & { pneumatico: PneumaticoReport };

export type Report = Pick<
  Tables<'controlli'>,
  'id' | 'officina_id' | 'eseguito_il' | 'km' | 'note'
> & {
  veicolo: Pick<Tables<'veicoli'>, 'id' | 'targa' | 'marca' | 'modello' | 'anno'> & {
    officina: OfficinaGarage | null;
  };
  misure: MisuraReport[];
};

/** Un controllo con veicolo, officina e misure; `null` se non esiste o non è visibile all'utente. */
export async function caricaReport(id: string): Promise<Report | null> {
  const { data, error } = await getSupabase()
    .from('controlli')
    .select(
      `id, officina_id, eseguito_il, km, note,
       veicolo:veicoli (id, targa, marca, modello, anno,
         officina:officine (id, ragione_sociale, indirizzo, citta, telefono)),
       misure:misure_pneumatico (battistrada_mm, pressione_bar, usura, danni, pneumatico:pneumatici (*))`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// --- Link pubblico (T063/T064) ---------------------------------------------------------------------

/** Giorni di validità di un link, come in `crea_link_report` (migrazione `link_report`). */
export const GIORNI_LINK_REPORT = 30;

/** Crea un link nuovo per il controllo (quelli già creati restano validi) e dà il codice in chiaro. */
export async function creaLinkReport(controlloId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('crea_link_report', {
    p_controllo_id: controlloId,
  });
  if (error) throw error;
  return data;
}

/** Disattiva tutti i link ancora validi del controllo. */
export async function revocaLinkReport(controlloId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoca_link_report', { p_controllo_id: controlloId });
  if (error) throw error;
}

/** Il report di un link pubblico (senza accesso); `null` se il codice non è valido, scaduto o revocato. */
export async function caricaReportPubblico(codice: string): Promise<Report | null> {
  const { data, error } = await getSupabase().rpc('report_pubblico', { p_codice: codice });
  if (error) throw error;
  // Il jsonb ha già la forma di `Report` (la funzione SQL ne usa le stesse chiavi): il cast è sicuro
  // finché migrazione e tipo restano allineati.
  return (data as unknown as Report | null) ?? null;
}

/** Indirizzo pubblico del report: `<origine>/r?c=<codice>`. */
export function linkReport(origine: string, codice: string): string {
  return `${origine}/r?c=${encodeURIComponent(codice)}`;
}

/** Indirizzo WhatsApp con il messaggio che contiene il link. */
export function linkWhatsApp(link: string, targa: string): string {
  const testo = `Ecco il report del controllo degli pneumatici della tua auto (${targa}): ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(testo)}`;
}
