import { ErroreModulo } from './errori';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

// Inviti del cliente (rivendicazione dei veicoli, sessione 12). L'officina crea l'invito con
// `crea_invito_cliente` e lo manda per email dal proprio programma di posta (link `mailto:`); il
// cliente apre `/invito?codice=…`, accede con la stessa email e accetta con `accetta_invito`.
// Le regole (chi invita, email uguale e confermata, scadenza) sono tutte nel database.

/** Giorni di validità di un invito: come `interval '14 days'` in `crea_invito_cliente`. */
export const GIORNI_VALIDITA = 14;

// Errori attesi delle funzioni SQL (messaggio = chiave) → testo per l'utente
const MESSAGGI: Record<string, string> = {
  CLIENTE_GIA_COLLEGATO: "Questo cliente ha già collegato il suo account all'officina.",
  EMAIL_NON_VALIDA: "Controlla l'email: sembra incompleta (es. nome@esempio.it)",
  INVITO_NON_VALIDO: 'Questo invito non esiste. Controlla di aver aperto il link completo.',
  INVITO_GIA_USATO: 'Questo invito è già stato usato da un altro account.',
  INVITO_ANNULLATO: "Questo invito è stato annullato dall'officina. Chiedine uno nuovo.",
  INVITO_SCADUTO: "Questo invito è scaduto. Chiedi all'officina di mandartene uno nuovo.",
  EMAIL_DIVERSA:
    "L'invito è per un'altra email. Accedi con l'email a cui è arrivato l'invito, oppure chiedi " +
    "all'officina di mandarlo all'email del tuo account.",
};

/** Un errore atteso diventa un `ErroreModulo` con il suo messaggio; gli altri restano come sono. */
function traduci(errore: { message?: string } | null, campo?: string): unknown {
  const messaggio = errore?.message ? MESSAGGI[errore.message] : undefined;
  return messaggio ? new ErroreModulo(messaggio, campo) : errore;
}

// ---------------------------------------------------------------------------------------------------
// Lato officina
// ---------------------------------------------------------------------------------------------------

export interface InvitoInCorso {
  email: string;
  created_at: string;
  scade_il: string;
}

/** L'invito ancora valido di un cliente (non usato, non annullato, non scaduto), se c'è. */
export async function caricaInvitoInCorso(clienteId: string): Promise<InvitoInCorso | null> {
  const { data, error } = await getSupabase()
    .from('inviti_cliente')
    .select('email, created_at, scade_il')
    .eq('cliente_officina_id', clienteId)
    .is('usato_il', null)
    .is('annullato_il', null)
    .gt('scade_il', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface InvitoCreato {
  codice: string;
  scade_il: string;
}

/**
 * Crea un invito e restituisce il codice per il link: il database non lo conserva, quindi si vede
 * solo adesso. Ripeterlo dopo un errore di rete crea un altro invito che annulla il primo: va bene,
 * il primo codice non è mai arrivato.
 */
export async function creaInvito(clienteId: string, email: string): Promise<InvitoCreato> {
  const { data, error } = await conRiprova(() =>
    getSupabase().rpc('crea_invito_cliente', { p_cliente_id: clienteId, p_email: email }),
  );
  if (error) throw traduci(error, error.message === 'EMAIL_NON_VALIDA' ? 'email' : undefined);
  const invito = data[0];
  if (!invito) throw new Error('Invito non creato');
  return invito;
}

/** Annulla l'invito in corso di un cliente (es. email sbagliata). */
export async function annullaInvito(clienteId: string): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().rpc('annulla_invito_cliente', { p_cliente_id: clienteId }),
  );
  if (error) throw error;
}

/** Link che il cliente apre dall'email. */
export const linkInvito = (codice: string, origine = location.origin): string =>
  `${origine}/invito?codice=${encodeURIComponent(codice)}`;

interface TestoInvito {
  officina: string;
  /** Nome del cliente per il saluto (può essere vuoto). */
  nome: string;
  email: string;
  link: string;
  /** Data di scadenza già scritta per esteso (es. "24 ottobre 2026"). */
  scadenza: string;
}

/** Oggetto e testo dell'email d'invito, scritti come li manderebbe l'officina. */
export function testoInvito({ officina, nome, email, link, scadenza }: TestoInvito) {
  const oggetto = `${officina} ti invita su TyreCare`;
  const corpo = [
    `${nome ? `Ciao ${nome}` : 'Buongiorno'},`,
    '',
    `con TyreCare puoi vedere dal telefono lo stato dei tuoi pneumatici e i controlli che facciamo ` +
      `sui tuoi veicoli.`,
    '',
    'Per collegare i tuoi veicoli apri questo link:',
    link,
    '',
    `Accedi o crea il tuo account con questa email (${email}). Il link vale fino al ${scadenza}.`,
    '',
    'A presto,',
    officina,
  ].join('\n');
  return { oggetto, corpo };
}

/** Link `mailto:` che apre il programma di posta con destinatario, oggetto e testo già scritti. */
export function mailtoInvito(dati: TestoInvito): string {
  const { oggetto, corpo } = testoInvito(dati);
  // encodeURIComponent e non URLSearchParams: i client di posta non leggono "+" come spazio.
  // La "@" dell'indirizzo resta scritta così: qualche programma di posta non riconosce "%40"
  const destinatario = encodeURIComponent(dati.email).replace('%40', '@');
  return `mailto:${destinatario}?subject=${encodeURIComponent(
    oggetto,
  )}&body=${encodeURIComponent(corpo)}`;
}

// ---------------------------------------------------------------------------------------------------
// Lato cliente
// ---------------------------------------------------------------------------------------------------

export type StatoInvito = 'VALIDO' | 'USATO' | 'ANNULLATO' | 'SCADUTO';

export interface InfoInvito {
  officina: string;
  email: string;
  stato: StatoInvito;
  scade_il: string;
  usato_da_te: boolean;
}

/** Cosa dice un invito (anche senza accesso); `null` se il codice non esiste. */
export async function leggiInvito(codice: string): Promise<InfoInvito | null> {
  const { data, error } = await getSupabase().rpc('info_invito', { p_codice: codice });
  if (error) throw error;
  const info = data[0];
  return info ? { ...info, stato: info.stato as StatoInvito } : null;
}

/** Accetta l'invito: restituisce il nome dell'officina. Ripetibile (lo stesso account non sbaglia). */
export async function accettaInvito(codice: string): Promise<string> {
  const { data, error } = await conRiprova(() =>
    getSupabase().rpc('accetta_invito', { p_codice: codice }),
  );
  if (error) throw traduci(error);
  return data;
}
