import {
  PianoSchema,
  StatoAbbonamentoSchema,
  type Enums,
  type Piano,
  type StatoAbbonamento,
} from '@tyrecare/shared';
import { leggiTutte } from './a-pagine';
import { ErroreModulo, codiceErrore } from './errori';
import { getSupabase } from './supabase';

// Pagina dell'amministratore (T061): elenco delle officine con il loro titolare, attivazione e
// sospensione. L'admin legge tutto per RLS; i cambi di stato passano solo dalle due funzioni SQL
// `attiva_officina` e `sospendi_officina` (T100), che controllano anche il ruolo nel database.

type Stato = Enums<'stato_affiliazione'>;

export interface OfficinaAdmin {
  id: string;
  ragione_sociale: string;
  partita_iva: string;
  citta: string;
  email: string | null;
  created_at: string;
  stato_affiliazione: Stato;
  /** Nome e cognome del titolare ('' se non c'è o non è leggibile). */
  titolare: string;
  /** Piano e stato dell'abbonamento (null se la riga non c'è o non è leggibile). */
  piano: Piano | null;
  statoAbbonamento: StatoAbbonamento | null;
}

/** Le colonne sono `text` con check: i valori si validano con gli schemi di `@tyrecare/shared`. */
interface EmbedAbbonamento {
  piano: string;
  stato: string;
}

/** L'embed `abbonamenti` torna un oggetto (relazione 1-a-1) o un array: li gestisco entrambi. */
export function leggiAbbonamentoEmbed(
  embed: EmbedAbbonamento | EmbedAbbonamento[] | null | undefined,
): Pick<OfficinaAdmin, 'piano' | 'statoAbbonamento'> {
  const a = Array.isArray(embed) ? embed[0] : embed;
  const piano = PianoSchema.safeParse(a?.piano);
  const stato = StatoAbbonamentoSchema.safeParse(a?.stato);
  return {
    piano: piano.success ? piano.data : null,
    statoAbbonamento: stato.success ? stato.data : null,
  };
}

/** Etichetta italiana dello stato dell'abbonamento. */
export const ETICHETTE_STATO_ABBONAMENTO: Record<StatoAbbonamento, string> = {
  PROVA: 'In prova',
  ATTIVO: 'Abbonamento attivo',
  SCADUTO: 'Scaduto',
  ANNULLATO: 'Annullato',
};

/** Prima le officine in attesa, poi per data di creazione dalla più recente. Non modifica l'elenco. */
export function ordinaOfficineAdmin<
  T extends Pick<OfficinaAdmin, 'stato_affiliazione' | 'created_at'>,
>(officine: readonly T[]): T[] {
  const peso = (o: T) => (o.stato_affiliazione === 'IN_ATTESA' ? 0 : 1);
  return [...officine].sort(
    (a, b) =>
      peso(a) - peso(b) || (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0),
  );
}

/** Quante officine aspettano di essere attivate. */
export function contaInAttesa(officine: readonly Pick<OfficinaAdmin, 'stato_affiliazione'>[]) {
  return officine.filter((o) => o.stato_affiliazione === 'IN_ATTESA').length;
}

interface RigaOfficina extends Omit<OfficinaAdmin, 'titolare' | 'piano' | 'statoAbbonamento'> {
  abbonamenti: EmbedAbbonamento | EmbedAbbonamento[] | null;
  officina_utenti: {
    ruolo: string;
    profiles: { nome: string; cognome: string } | null;
  }[];
}

/** Tutte le officine, già ordinate, con il nome del titolare. */
export async function caricaOfficineAdmin(): Promise<OfficinaAdmin[]> {
  const righe = await leggiTutte<RigaOfficina>((da, a) =>
    getSupabase()
      .from('officine')
      .select(
        'id, ragione_sociale, partita_iva, citta, email, created_at, stato_affiliazione, officina_utenti(ruolo, profiles(nome, cognome)), abbonamenti(piano, stato)',
      )
      .order('created_at', { ascending: false })
      .order('id')
      .range(da, a),
  );
  return ordinaOfficineAdmin(
    righe.map(({ officina_utenti, abbonamenti, ...officina }) => {
      const p = officina_utenti.find((u) => u.ruolo === 'TITOLARE')?.profiles;
      return {
        ...officina,
        titolare: p ? `${p.nome} ${p.cognome}`.trim() : '',
        ...leggiAbbonamentoEmbed(abbonamenti),
      };
    }),
  );
}

/** Numero delle officine in attesa (query leggera, solo il conteggio). */
export async function contaOfficineInAttesa(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('officine')
    .select('id', { count: 'exact', head: true })
    .eq('stato_affiliazione', 'IN_ATTESA');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Cambia il piano dell'abbonamento (solo l'admin, per RLS). Un update di 0 righe (riga assente o permesso
 * negato dalla RLS) è un errore: `.single()` lo segnala con PGRST116. Lo stato di pagamento non si tocca.
 */
export async function cambiaPianoOfficina(officinaId: string, piano: Piano): Promise<void> {
  const { error } = await getSupabase()
    .from('abbonamenti')
    .update({ piano })
    .eq('officina_id', officinaId)
    .select()
    .single();
  if (!error) return;
  if (codiceErrore(error) === 'PGRST116') {
    throw new ErroreModulo(
      'Abbonamento non trovato: ricarica la pagina e riprova.',
      undefined,
      'PGRST116',
    );
  }
  traduciErrore(error);
}

function traduciErrore(errore: { message?: string }): never {
  if (codiceErrore(errore) === '42501') {
    throw new ErroreModulo("Solo l'amministratore può farlo.", undefined, '42501');
  }
  if (errore.message === 'OFFICINA_NON_TROVATA') {
    throw new ErroreModulo(
      'Officina non trovata: ricarica la pagina e riprova.',
      undefined,
      'OFFICINA_NON_TROVATA',
    );
  }
  throw errore;
}

/** Attiva l'officina (e promuove i titolari ancora clienti). Solo la funzione SQL, nessun update. */
export async function attivaOfficina(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('attiva_officina', { p_officina_id: id });
  if (error) traduciErrore(error);
}

/** Sospende l'officina: sparisce ai clienti. */
export async function sospendiOfficina(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('sospendi_officina', { p_officina_id: id });
  if (error) traduciErrore(error);
}

// ---------------------------------------------------------------------------------------------------
// Commenti degli utenti (T103)
// ---------------------------------------------------------------------------------------------------
// Sola lettura. La RLS di `commenti` ("lettura propria o admin") fa vedere tutto solo all'admin.

export interface CommentoAdmin {
  id: string;
  testo: string;
  /** Pagina da cui è stato mandato ('' se non indicata). */
  percorso: string;
  created_at: string;
  /** "Nome Cognome" ('' se il profilo non è leggibile). */
  autore: string;
}

const FORMATO_DATA_ORA = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
});

/** `2026-10-31T09:05:00Z` → "31 ottobre 2026, 10:05" (ora italiana). */
export const formattaDataOra = (iso: string): string => FORMATO_DATA_ORA.format(new Date(iso));

/** Nome e cognome dal profilo; '' se il profilo manca o è vuoto. */
export function nomeAutore(p: { nome: string; cognome: string } | null | undefined): string {
  return p ? `${p.nome ?? ''} ${p.cognome ?? ''}`.trim() : '';
}

/** Tutti i commenti, dal più recente. */
export async function caricaCommentiAdmin(): Promise<CommentoAdmin[]> {
  const righe = await leggiTutte((da, a) =>
    getSupabase()
      .from('commenti')
      .select('id, testo, percorso, created_at, autore_id, profiles(nome, cognome)')
      .order('created_at', { ascending: false })
      .order('id')
      .range(da, a),
  );
  return righe.map((r) => ({
    id: r.id,
    testo: r.testo,
    percorso: r.percorso ?? '',
    created_at: r.created_at,
    autore: nomeAutore(r.profiles),
  }));
}
