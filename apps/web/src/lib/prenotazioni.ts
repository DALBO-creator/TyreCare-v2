import {
  dividiVeicolo,
  normalizzaTarga,
  oggiInItalia,
  type Chiusura,
  type FasciaPiena,
  type RichiestaPrenotazione,
  type Servizio,
  type Tables,
} from '@tyrecare/shared';
import { sessioneCorrente } from './auth';
import { ErroreModulo } from './errori';
import { elimina, giaSalvato } from './officina';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

// Prenotazioni (Fase 4). Il catalogo dei servizi lo scrive il TITOLARE direttamente (RLS); le
// prenotazioni passano tutte dalle funzioni SQL, che controllano stati, orari e permessi:
// `richiedi_prenotazione` (cliente), `rispondi_prenotazione` (officina), `rispondi_proposta` e
// `annulla_prenotazione` (cliente).

// ---------------------------------------------------------------------------------------------------
// Catalogo dei servizi (officina)
// ---------------------------------------------------------------------------------------------------

export type ServizioOfficina = Tables<'servizi_officina'>;

/** Servizi di un'officina: per i membri anche quelli non prenotabili (lo decide la RLS). */
export async function caricaServizi(officinaId: string): Promise<ServizioOfficina[]> {
  const { data, error } = await getSupabase()
    .from('servizi_officina')
    .select('*')
    .eq('officina_id', officinaId);
  if (error) throw error;
  return data.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

export async function caricaServizio(id: string): Promise<ServizioOfficina | null> {
  const { data, error } = await getSupabase()
    .from('servizi_officina')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function creaServizio(officinaId: string, servizio: Servizio): Promise<void> {
  const id = crypto.randomUUID();
  const { error } = await conRiprova(() =>
    getSupabase()
      .from('servizi_officina')
      .insert({ ...servizio, id, officina_id: officinaId }),
  );
  if (error && !giaSalvato(error, 'servizi_officina')) throw error;
}

export async function modificaServizio(id: string, servizio: Servizio): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().from('servizi_officina').update(servizio).eq('id', id).select('id').single(),
  );
  if (error) throw error;
}

/** Le prenotazioni già fatte restano: conservano il nome del servizio. */
export const eliminaServizio = (id: string) =>
  elimina('servizi_officina', id, "Solo il titolare dell'officina può modificare il catalogo.");

// ---------------------------------------------------------------------------------------------------
// Officine per il cliente
// ---------------------------------------------------------------------------------------------------

export type OfficinaPubblica = Pick<
  Tables<'officine'>,
  | 'id'
  | 'ragione_sociale'
  | 'indirizzo'
  | 'cap'
  | 'citta'
  | 'provincia'
  | 'latitudine'
  | 'longitudine'
  | 'telefono'
  | 'orari'
>;

const COLONNE_OFFICINA =
  'id, ragione_sociale, indirizzo, cap, citta, provincia, latitudine, longitudine, telefono, orari';

/** Officine affiliate (ATTIVE), in ordine di città e nome. */
export async function caricaOfficineAttive(): Promise<OfficinaPubblica[]> {
  const { data, error } = await getSupabase()
    .from('officine')
    .select(COLONNE_OFFICINA)
    .eq('stato_affiliazione', 'ATTIVA');
  if (error) throw error;
  return data.sort(
    (a, b) =>
      a.citta.localeCompare(b.citta, 'it') || a.ragione_sociale.localeCompare(b.ragione_sociale),
  );
}

export type OfficinaConServizi = OfficinaPubblica & {
  servizi: ServizioOfficina[];
  /** Chiusure straordinarie da oggi in poi. */
  chiusure: Chiusura[];
};

/**
 * Officina attiva con i servizi prenotabili e le chiusure in programma; `null` se non esiste o non è
 * attiva.
 */
export async function caricaOfficinaPubblica(id: string): Promise<OfficinaConServizi | null> {
  const { data, error } = await getSupabase()
    .from('officine')
    .select(
      `${COLONNE_OFFICINA}, servizi:servizi_officina (*), chiusure:chiusure_officina (dal, al, motivo)`,
    )
    .eq('id', id)
    .eq('stato_affiliazione', 'ATTIVA')
    // Un membro dell'officina vedrebbe anche i servizi non prenotabili
    .eq('servizi_officina.prenotabile', true)
    .gte('chiusure_officina.al', oggiInItalia())
    .order('dal', { referencedTable: 'chiusure_officina' })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.servizi.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  return data;
}

/**
 * Le fasce piene dell'officina (da domani ai prossimi 60 giorni). Serve solo a spegnerle nel modulo:
 * se non si leggono, pazienza, il controllo vero lo fa il database.
 */
export async function caricaFascePiene(officinaId: string): Promise<FasciaPiena[]> {
  const { data, error } = await getSupabase().rpc('fasce_piene', { p_officina_id: officinaId });
  return error ? [] : data;
}

/**
 * Tra le officine indicate (es. quelle di un veicolo del garage), le attive con orari e servizi
 * prenotabili: a quelle si può chiedere un appuntamento. Una query sola per tutte.
 */
export async function caricaOfficinePrenotabili(
  ids: string[],
): Promise<(Pick<Tables<'officine'>, 'id' | 'orari'> & { servizi: { id: string }[] })[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabase()
    .from('officine')
    .select('id, orari, servizi:servizi_officina!inner (id)')
    .in('id', ids)
    .eq('stato_affiliazione', 'ATTIVA')
    .eq('servizi_officina.prenotabile', true);
  if (error) throw error;
  return data;
}

export interface VeicoloMio {
  targa: string;
  descrizione: string;
}

/**
 * Veicoli collegati all'account (dalle officine che li hanno registrati), uniti per targa: servono
 * per compilare la richiesta con un tocco. Chi lavora in un'officina non vede quelli dell'officina.
 */
export async function caricaMieiVeicoli(): Promise<VeicoloMio[]> {
  const uid = sessioneCorrente()?.user.id;
  if (!uid) return [];
  const { data, error } = await getSupabase()
    .from('veicoli')
    .select('targa, marca, modello, cliente:clienti_officina!inner (profile_id)')
    .eq('cliente.profile_id', uid);
  if (error) throw error;
  const perTarga = new Map<string, VeicoloMio>();
  for (const v of data) {
    const descrizione = `${v.marca} ${v.modello}`.trim();
    const gia = perTarga.get(v.targa);
    if (!gia || (!gia.descrizione && descrizione))
      perTarga.set(v.targa, { targa: v.targa, descrizione });
  }
  return [...perTarga.values()].sort((a, b) => a.targa.localeCompare(b.targa));
}

// ---------------------------------------------------------------------------------------------------
// Prenotazioni
// ---------------------------------------------------------------------------------------------------

export type Prenotazione = Tables<'prenotazioni'> & {
  officina: Pick<Tables<'officine'>, 'ragione_sociale' | 'indirizzo' | 'citta' | 'telefono'>;
};

const COLONNE_PRENOTAZIONE = '*, officina:officine (ragione_sociale, indirizzo, citta, telefono)';

// Errori attesi delle funzioni SQL (messaggio = chiave) → testo e campo del modulo
const ERRORI: Record<string, [string, string?]> = {
  OFFICINA_NON_DISPONIBILE: ["Questa officina al momento non accetta prenotazioni dall'app."],
  SERVIZIO_NON_DISPONIBILE: [
    'Questo servizio non è più prenotabile: scegline un altro.',
    'servizio_id',
  ],
  GIORNO_NON_VALIDO: ['Scegli un giorno tra domani e i prossimi 60 giorni.', 'giorno'],
  OFFICINA_CHIUSA: [
    "L'officina è chiusa in quel momento: scegli un altro giorno o fascia.",
    'fascia',
  ],
  FASCIA_PIENA: ['Questa fascia si è appena riempita: scegli un altro giorno o fascia.', 'fascia'],
  TARGA_NON_VALIDA: ['La targa ha da 2 a 10 lettere e cifre', 'targa'],
  TELEFONO_NON_VALIDO: ['Controlla il numero di telefono', 'telefono'],
  TROPPE_RICHIESTE: [
    'Hai già 3 richieste in attesa con questa officina: aspetta la risposta o annullane una.',
  ],
  STATO_NON_VALIDO: [
    "Questa prenotazione è cambiata nel frattempo: ricarica la pagina per vedere com'è ora.",
  ],
  ORARIO_NON_VALIDO: ['Controlla giorno e ora: devono essere futuri, entro 60 giorni.', 'ora'],
  VEICOLO_GIA_REGISTRATO: [
    'Questa targa è già registrata nella tua officina: ricarica la pagina per aprire la sua scheda.',
  ],
  PRENOTAZIONE_CHIUSA: ['La richiesta è stata rifiutata o annullata: niente da registrare.'],
};

function traduci(errore: { message?: string } | null): unknown {
  const voce = errore?.message ? ERRORI[errore.message] : undefined;
  return voce ? new ErroreModulo(voce[0], voce[1]) : errore;
}

/** Il cliente chiede un appuntamento; restituisce l'id della prenotazione. */
export async function richiediPrenotazione(
  officinaId: string,
  r: RichiestaPrenotazione,
): Promise<string> {
  const id = crypto.randomUUID();
  const { data, error } = await conRiprova(() =>
    getSupabase().rpc('richiedi_prenotazione', {
      p_officina_id: officinaId,
      p_servizio_id: r.servizio_id,
      p_giorno: r.giorno,
      p_fascia: r.fascia,
      p_targa: normalizzaTarga(r.targa),
      p_veicolo: r.veicolo,
      p_telefono: r.telefono,
      p_note: r.note,
      p_id: id,
    }),
  );
  if (error) throw traduci(error);
  return data;
}

/** Prenotazioni chieste dall'utente, dalla più recente. */
export async function caricaMiePrenotazioni(): Promise<Prenotazione[]> {
  const uid = sessioneCorrente()?.user.id;
  if (!uid) return [];
  const { data, error } = await getSupabase()
    .from('prenotazioni')
    .select(COLONNE_PRENOTAZIONE)
    .eq('cliente_id', uid)
    .order('giorno', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Prenotazioni di un'officina dal giorno indicato in poi, in ordine di giorno. */
export async function caricaPrenotazioniOfficina(
  officinaId: string,
  dal: string,
): Promise<Prenotazione[]> {
  const { data, error } = await getSupabase()
    .from('prenotazioni')
    .select(COLONNE_PRENOTAZIONE)
    .eq('officina_id', officinaId)
    .gte('giorno', dal)
    .order('giorno')
    .order('fascia')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function caricaPrenotazione(id: string): Promise<Prenotazione | null> {
  const { data, error } = await getSupabase()
    .from('prenotazioni')
    .select(COLONNE_PRENOTAZIONE)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type AzioneOfficina = 'CONFERMA' | 'PROPONI' | 'RIFIUTA' | 'COMPLETATA' | 'NON_PRESENTATO';

/** Risposta dell'officina. Ripetibile: la stessa risposta due volte non è un errore. */
export async function rispondiPrenotazione(
  id: string,
  azione: AzioneOfficina,
  { appuntamento, messaggio = '' }: { appuntamento?: string; messaggio?: string } = {},
): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().rpc('rispondi_prenotazione', {
      p_id: id,
      p_azione: azione,
      ...(appuntamento ? { p_appuntamento: appuntamento } : {}),
      p_messaggio: messaggio,
    }),
  );
  if (error) throw traduci(error);
}

/** Il cliente accetta o rifiuta l'orario proposto dall'officina. */
export async function rispondiProposta(id: string, accetta: boolean): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().rpc('rispondi_proposta', { p_id: id, p_accetta: accetta }),
  );
  if (error) throw traduci(error);
}

export async function annullaPrenotazione(id: string): Promise<void> {
  const { error } = await conRiprova(() => getSupabase().rpc('annulla_prenotazione', { p_id: id }));
  if (error) throw traduci(error);
}

/** Numero di richieste ancora da confermare (da oggi in poi), per l'avviso nella home dell'officina. */
/**
 * Registra in officina il veicolo della richiesta, sulla scheda del cliente già collegato all'account
 * di chi ha prenotato oppure su un cliente nuovo, collegato (funzione SQL). Restituisce l'id del veicolo.
 */
export async function registraClienteDaPrenotazione(p: Prenotazione): Promise<string> {
  const { marca, modello } = dividiVeicolo(p.veicolo);
  const ids = { p_cliente_id: crypto.randomUUID(), p_veicolo_id: crypto.randomUUID() };
  const { data, error } = await conRiprova(() =>
    getSupabase().rpc('registra_cliente_da_prenotazione', {
      p_prenotazione: p.id,
      ...ids,
      p_marca: marca,
      p_modello: modello,
    }),
  );
  if (error) throw traduci(error);
  return data;
}

/** Scheda del cliente dell'officina collegata all'account di chi ha prenotato, se c'è. */
export async function caricaClienteDellaPrenotazione(
  p: Prenotazione,
): Promise<{ id: string; nome: string; cognome: string } | null> {
  const { data, error } = await getSupabase()
    .from('clienti_officina')
    .select('id, nome, cognome')
    .eq('officina_id', p.officina_id)
    .eq('profile_id', p.cliente_id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function contaRichiesteDaConfermare(officinaId: string, dal: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('prenotazioni')
    .select('id', { count: 'exact', head: true })
    .eq('officina_id', officinaId)
    .eq('stato', 'RICHIESTA')
    .gte('giorno', dal);
  if (error) throw error;
  return count ?? 0;
}
