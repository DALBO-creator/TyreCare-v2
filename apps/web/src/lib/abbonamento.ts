import type { Piano, StatoAbbonamento } from '@tyrecare/shared';
import { ErroreModulo } from './errori';
import { getSupabase } from './supabase';

export interface AbbonamentoOfficina {
  piano: Piano;
  stato: StatoAbbonamento;
  /** Ultimo giorno della prova (`AAAA-MM-GG`, incluso). */
  prova_fino_al: string;
  /** Cliente Stripe; assente finché l'officina non ha mai pagato. */
  stripe_customer_id: string | null;
}

/** Abbonamento dell'officina; lo leggono solo titolare e admin. `null` se non esiste. */
export async function caricaAbbonamento(officinaId: string): Promise<AbbonamentoOfficina | null> {
  const { data, error } = await getSupabase()
    .from('abbonamenti')
    .select('piano, stato, prova_fino_al, stripe_customer_id')
    .eq('officina_id', officinaId)
    .maybeSingle();
  if (error) throw error;
  return data as AbbonamentoOfficina | null;
}

const MESSAGGIO_GENERICO = 'Non riusciamo ad aprire il pagamento. Riprova tra poco.';

const MESSAGGI_PAGAMENTO: Record<string, string> = {
  PAGAMENTI_NON_ATTIVI:
    'Il pagamento online non è ancora attivo: per ora scrivici con «Invia un commento».',
  SOLO_TITOLARE: "Solo il titolare può attivare l'abbonamento.",
  OFFICINA_NON_ATTIVA: "Potrai attivare l'abbonamento quando la tua officina sarà attiva.",
  PILOTA: "La tua officina è nel pilota: l'abbonamento è gratuito.",
  GIA_ATTIVO: "L'abbonamento è già attivo.",
  ABBONAMENTO_DA_SISTEMARE:
    "L'ultimo pagamento non è riuscito: aggiorna la carta con «Gestisci il pagamento».",
  NESSUN_PAGAMENTO: 'Non risulta ancora nessun pagamento.',
  // 502 di `stripe-checkout` e di `stripe-portale` (es. portale non ancora attivato su Stripe).
  STRIPE:
    'Il servizio di pagamento non è disponibile in questo momento: riprova più tardi o scrivici con «Invia un commento».',
};

/** Testo per il codice d'errore di `stripe-checkout` e `stripe-portale`; codice assente o sconosciuto → messaggio generico. */
export function messaggioPagamento(codice: string | null): string {
  return (
    (codice !== null && Object.hasOwn(MESSAGGI_PAGAMENTO, codice)
      ? MESSAGGI_PAGAMENTO[codice]
      : undefined) ?? MESSAGGIO_GENERICO
  );
}

/** Legge `{ errore }` dal corpo della risposta HTTP di un `FunctionsHttpError` (`error.context`). */
export async function codiceDaErrore(errore: unknown): Promise<string | null> {
  try {
    const contesto = (errore as { context?: unknown } | null)?.context;
    if (!(contesto instanceof Response)) return null;
    const corpo: unknown = await contesto.json();
    const codice = (corpo as { errore?: unknown } | null)?.errore;
    return typeof codice === 'string' ? codice : null;
  } catch {
    return null;
  }
}

/** Apre il pagamento Stripe del piano scelto; in caso di errore lancia `ErroreModulo` con il messaggio. */
export async function avviaPagamento(
  officinaId: string,
  piano: Exclude<Piano, 'PILOTA'>,
): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('stripe-checkout', {
    body: { officina_id: officinaId, piano },
  });
  if (error) throw new ErroreModulo(messaggioPagamento(await codiceDaErrore(error)));
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || url === '') throw new ErroreModulo(MESSAGGIO_GENERICO);
  location.assign(url);
}

/** Apre il portale Stripe (cambio carta, annullamento); in caso di errore lancia `ErroreModulo` con il messaggio. */
export async function apriPortale(officinaId: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('stripe-portale', {
    body: { officina_id: officinaId },
  });
  if (error) throw new ErroreModulo(messaggioPagamento(await codiceDaErrore(error)));
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || url === '') throw new ErroreModulo(MESSAGGIO_GENERICO);
  location.assign(url);
}
