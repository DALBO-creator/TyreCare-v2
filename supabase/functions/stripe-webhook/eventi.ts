// Dagli eventi di Stripe all'aggiornamento dell'abbonamento in TyreCare (T185). La usa `index.ts`.
// Senza import, così la provano anche i test di vitest (project `funzioni`).
//
// Il risultato di `aggiornamentoDaEvento` va così com'è a `aggiorna_abbonamento_stripe` (migrazione
// 20261102000100): l'abbonamento si cerca per officina, poi per abbonamento Stripe, poi per cliente.

export type StatoAbbonamento = 'ATTIVO' | 'SCADUTO' | 'ANNULLATO';
export type PianoAbbonamento = 'STARTER' | 'PRO';

export interface PrezziStripe {
  starter?: string | null;
  pro?: string | null;
}

export interface AggiornamentoAbbonamento {
  officina_id: string | null;
  customer: string | null;
  subscription: string | null;
  stato: StatoAbbonamento;
  piano: PianoAbbonamento | null;
}

/** Stato di TyreCare per lo `status` di un abbonamento Stripe; `null` per gli stati da ignorare. */
export function statoDaStripe(status: unknown): StatoAbbonamento | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ATTIVO';
    case 'past_due':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'SCADUTO';
    case 'canceled':
      return 'ANNULLATO';
    default:
      return null; // es. `incomplete`: il primo pagamento non è ancora andato a buon fine
  }
}

/** Piano di TyreCare per l'id di un prezzo Stripe; `null` se non è uno dei due prezzi configurati. */
export function pianoDaPrezzo(priceId: unknown, prezzi: PrezziStripe): PianoAbbonamento | null {
  if (typeof priceId !== 'string' || !priceId) return null;
  if (prezzi.starter && priceId === prezzi.starter) return 'STARTER';
  if (prezzi.pro && priceId === prezzi.pro) return 'PRO';
  return null;
}

type Oggetto = Record<string, unknown>;

const oggetto = (valore: unknown): Oggetto | null =>
  typeof valore === 'object' && valore !== null && !Array.isArray(valore)
    ? (valore as Oggetto)
    : null;

/** Id di un riferimento Stripe: una stringa `cus_…`/`sub_…` o un oggetto espanso con `id`. */
const idStripe = (valore: unknown): string | null => {
  if (typeof valore === 'string') return valore || null;
  const id = oggetto(valore)?.id;
  return typeof id === 'string' && id ? id : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Id dell'officina se è un uuid, altrimenti `null`: un valore sbagliato farebbe fallire il database a
 * ogni tentativo; con `null` l'abbonamento si cerca per abbonamento o cliente Stripe.
 */
const officina = (valore: unknown): string | null =>
  typeof valore === 'string' && UUID.test(valore) ? valore.toLowerCase() : null;

/**
 * L'aggiornamento da fare per un evento di Stripe, o `null` se l'evento non cambia l'abbonamento:
 * - `checkout.session.completed` con `mode = 'subscription'`: officina da `client_reference_id`, stato
 *   `ATTIVO`, piano `null` (lo porta l'evento dell'abbonamento);
 * - `customer.subscription.created|updated|deleted`: officina da `metadata.officina_id`, stato da
 *   `status` (`deleted` → sempre `ANNULLATO`), piano dal primo prezzo di `items.data`. Uno `status` da
 *   ignorare (es. `incomplete`) → `null`.
 */
export function aggiornamentoDaEvento(
  evento: unknown,
  prezzi: PrezziStripe,
): AggiornamentoAbbonamento | null {
  const e = oggetto(evento);
  const dati = oggetto(oggetto(e?.data)?.object);
  if (!e || !dati) return null;

  switch (e.type) {
    case 'checkout.session.completed': {
      if (dati.mode !== 'subscription') return null;
      return {
        officina_id: officina(dati.client_reference_id),
        customer: idStripe(dati.customer),
        subscription: idStripe(dati.subscription),
        stato: 'ATTIVO',
        piano: null,
      };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const stato =
        e.type === 'customer.subscription.deleted' ? 'ANNULLATO' : statoDaStripe(dati.status);
      if (!stato) return null;
      const voci = oggetto(dati.items)?.data;
      const primaVoce = Array.isArray(voci) ? oggetto(voci[0]) : null;
      return {
        officina_id: officina(oggetto(dati.metadata)?.officina_id),
        customer: idStripe(dati.customer),
        subscription: idStripe(dati.id),
        stato,
        piano: pianoDaPrezzo(oggetto(primaVoce?.price)?.id, prezzi),
      };
    }
    default:
      return null;
  }
}

/**
 * Chiavi d'errore del database che nessun nuovo tentativo può correggere (T212): l'evento si registra,
 * Stripe riceve 200 e non lo rimanda per tre giorni fino a disattivare l'endpoint.
 * `CLIENTE_STRIPE_DIVERSO` oggi la lancia solo `collega_cliente_stripe`: è qui per sicurezza.
 */
const CHIAVI_PERMANENTI: ReadonlySet<string> = new Set([
  'ABBONAMENTO_NON_TROVATO',
  'STATO_NON_VALIDO',
  'PIANO_NON_VALIDO',
  'CLIENTE_STRIPE_DIVERSO',
  'SUBSCRIPTION_DI_ALTRA_OFFICINA',
]);

/** `true` solo se il messaggio d'errore del database è esattamente una delle chiavi permanenti. */
export function errorePermanente(messaggio: string): boolean {
  return CHIAVI_PERMANENTI.has(messaggio);
}

/**
 * `true` se `aggiorna_abbonamento_stripe` ha ignorato l'evento senza errore (T224, R30): dopo la
 * chiamata l'abbonamento resta collegato a una subscription diversa da quella dell'evento. Solo
 * diagnostica per i log: un vuoto da una parte o dall'altra non è un confronto.
 */
export function subscriptionIgnorata(
  aggiornamento: Pick<AggiornamentoAbbonamento, 'subscription'>,
  collegata: string | null | undefined,
): boolean {
  return !!aggiornamento.subscription && !!collegata && collegata !== aggiornamento.subscription;
}
