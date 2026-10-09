import {
  statoBattistrada,
  statoPeggiore,
  type Cliente,
  type MontaPneumatici,
  type NuovoControllo,
  type StatoSalute,
  type Tables,
  type Veicolo,
} from '@tyrecare/shared';
import { codiceErrore, ErroreModulo } from './errori';
import { caricaDatiUtente, type DatiUtente, type OfficinaUtente } from './profilo';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

// Dati lato officina (Fase 2). Le letture passano direttamente da Supabase: la RLS mostra solo i dati
// delle officine di cui l'utente è membro. Le scritture su più tabelle passano dalle funzioni SQL
// `monta_pneumatici` e `registra_controllo` (una chiamata = una transazione).

// ---------------------------------------------------------------------------------------------------
// Officina attiva
// ---------------------------------------------------------------------------------------------------

const CHIAVE_OFFICINA = 'tc-officina';

/**
 * Officina su cui si lavora: quella scelta l'ultima volta su questo dispositivo, altrimenti la prima.
 * Il salvataggio nel browser può non essere disponibile (navigazione privata): si ricade sulla prima.
 */
export function officinaAttiva(officine: OfficinaUtente[]): OfficinaUtente | undefined {
  let scelta: string | null = null;
  try {
    scelta = localStorage.getItem(CHIAVE_OFFICINA);
  } catch {
    // nessuna preferenza salvata
  }
  return officine.find((o) => o.officina.id === scelta) ?? officine[0];
}

export function scegliOfficina(id: string): void {
  try {
    localStorage.setItem(CHIAVE_OFFICINA, id);
  } catch {
    // la scelta vale solo fino al prossimo caricamento
  }
}

/** Vero se l'utente è TITOLARE dell'officina indicata (può eliminare clienti e veicoli). */
export const eTitolare = (officine: OfficinaUtente[], officinaId: string): boolean =>
  officine.some((o) => o.officina.id === officinaId && o.ruolo === 'TITOLARE');

/** Dati dell'utente e officina attiva; errore se l'utente non lavora in nessuna officina. */
export async function caricaContestoOfficina(): Promise<DatiUtente & { attiva: OfficinaUtente }> {
  const dati = await caricaDatiUtente();
  const attiva = officinaAttiva(dati.officine);
  if (!attiva) throw new ErroreModulo('Questa pagina è riservata alle officine.');
  return { ...dati, attiva };
}

// ---------------------------------------------------------------------------------------------------
// Elenco dei veicoli
// ---------------------------------------------------------------------------------------------------

type ClienteBreve = Pick<Tables<'clienti_officina'>, 'nome' | 'cognome' | 'ragione_sociale'>;

/** "Verdi Giulia", oppure la ragione sociale. */
export function nominativo(c: ClienteBreve | null): string {
  if (!c) return '';
  return c.ragione_sociale ?? `${c.cognome} ${c.nome}`.trim();
}

export interface VeicoloInElenco {
  id: string;
  targa: string;
  marca: string;
  modello: string;
  cliente: string;
  /** Data dell'ultimo controllo (`AAAA-MM-GG`), `null` se non ce ne sono. */
  ultimoControllo: string | null;
  /** Stato peggiore tra le misure dell'ultimo controllo. */
  stato: StatoSalute | null;
}

/**
 * Veicoli dell'officina (o di un suo cliente) con il cliente e l'ultimo controllo. Si caricano tutti
 * e si filtrano nel browser: per un'officina sono qualche centinaio, e la ricerca risponde a ogni
 * tasto anche offline.
 */
export async function caricaVeicoli(
  filtro: { officinaId: string } | { clienteId: string },
): Promise<VeicoloInElenco[]> {
  const [colonna, valore] =
    'officinaId' in filtro
      ? (['officina_id', filtro.officinaId] as const)
      : (['cliente_officina_id', filtro.clienteId] as const);
  const { data, error } = await getSupabase()
    .from('veicoli')
    .select(
      `id, targa, marca, modello,
       cliente:clienti_officina (nome, cognome, ragione_sociale),
       controlli (eseguito_il, misure_pneumatico (battistrada_mm, pneumatico:pneumatici (stagione)))`,
    )
    .eq(colonna, valore)
    // Solo l'ultimo controllo di ogni veicolo
    .order('eseguito_il', { referencedTable: 'controlli', ascending: false })
    .order('created_at', { referencedTable: 'controlli', ascending: false })
    .limit(1, { referencedTable: 'controlli' })
    .order('targa');
  if (error) throw error;

  return data.map((v) => {
    const ultimo = v.controlli[0];
    return {
      id: v.id,
      targa: v.targa,
      marca: v.marca,
      modello: v.modello,
      cliente: nominativo(v.cliente),
      ultimoControllo: ultimo?.eseguito_il ?? null,
      stato: ultimo
        ? statoPeggiore(
            ultimo.misure_pneumatico.map((m) =>
              statoBattistrada(m.battistrada_mm, m.pneumatico.stagione),
            ),
          )
        : null,
    };
  });
}

// ---------------------------------------------------------------------------------------------------
// Clienti e veicoli
// ---------------------------------------------------------------------------------------------------

export type ClienteInElenco = Pick<
  Tables<'clienti_officina'>,
  'id' | 'nome' | 'cognome' | 'ragione_sociale'
>;

export async function caricaClienti(officinaId: string): Promise<ClienteInElenco[]> {
  const { data, error } = await getSupabase()
    .from('clienti_officina')
    .select('id, nome, cognome, ragione_sociale')
    .eq('officina_id', officinaId);
  if (error) throw error;
  return data.sort((a, b) => nominativo(a).localeCompare(nominativo(b), 'it'));
}

export type ClienteConVeicoli = Pick<
  Tables<'clienti_officina'>,
  'id' | 'nome' | 'cognome' | 'ragione_sociale' | 'telefono' | 'email'
> & { veicoli: Pick<Tables<'veicoli'>, 'targa'>[] };

/** Clienti dell'officina con contatti e targhe, per l'elenco dei clienti (ordinati per nome). */
export async function caricaElencoClienti(officinaId: string): Promise<ClienteConVeicoli[]> {
  const { data, error } = await getSupabase()
    .from('clienti_officina')
    .select('id, nome, cognome, ragione_sociale, telefono, email, veicoli (targa)')
    .eq('officina_id', officinaId)
    .order('targa', { referencedTable: 'veicoli' });
  if (error) throw error;
  return data.sort((a, b) => nominativo(a).localeCompare(nominativo(b), 'it'));
}

/**
 * Vero se l'errore è la chiave primaria duplicata: dopo una ripetizione per errore di rete significa
 * che il primo tentativo era arrivato e il record c'è già (l'id l'abbiamo scelto noi).
 */
const giaSalvato = (error: unknown, tabella: string) =>
  codiceErrore(error) === '23505' && String((error as Error).message).includes(`${tabella}_pkey`);

/** Crea un cliente e ne restituisce l'id. */
export async function creaCliente(officinaId: string, cliente: Cliente): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await conRiprova(() =>
    getSupabase()
      .from('clienti_officina')
      .insert({ ...cliente, id, officina_id: officinaId }),
  );
  if (error && !giaSalvato(error, 'clienti_officina')) throw error;
  return id;
}

/** Crea un veicolo e ne restituisce l'id. Una targa già presente diventa un errore sul campo. */
export async function creaVeicolo(officinaId: string, veicolo: Veicolo): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await conRiprova(() =>
    getSupabase()
      .from('veicoli')
      .insert({ ...veicolo, id, officina_id: officinaId }),
  );
  if (!error || giaSalvato(error, 'veicoli')) return id;
  if (codiceErrore(error) === '23505') {
    throw new ErroreModulo('Questa targa è già registrata nella tua officina', 'targa');
  }
  throw error;
}

export type SchedaCliente = Tables<'clienti_officina'> & { veicoli: { count: number }[] };

/** Cliente con il numero dei suoi veicoli; `null` se non esiste o non è visibile all'utente. */
export async function caricaCliente(id: string): Promise<SchedaCliente | null> {
  const { data, error } = await getSupabase()
    .from('clienti_officina')
    .select('*, veicoli (count)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Le correzioni sono `update` con valori fissi: ripeterle dopo un errore di rete non cambia nulla.
 * Con `.single()` un aggiornamento bloccato dalla RLS (0 righe) diventa un errore invece di passare
 * in silenzio.
 */
export async function modificaCliente(id: string, cliente: Cliente): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().from('clienti_officina').update(cliente).eq('id', id).select('id').single(),
  );
  if (error) throw error;
}

export async function modificaVeicolo(id: string, veicolo: Veicolo): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().from('veicoli').update(veicolo).eq('id', id).select('id').single(),
  );
  if (codiceErrore(error) === '23505') {
    throw new ErroreModulo('Questa targa è già registrata nella tua officina', 'targa');
  }
  if (error) throw error;
}

/**
 * Elimina un record. La RLS non dà errore se l'utente non può eliminare: semplicemente non elimina
 * nulla. In quel caso si controlla se il record c'è ancora: se non c'è, era già stato eliminato (es.
 * dal primo tentativo, prima di un errore di rete) ed è un successo; se c'è, mancano i permessi.
 */
async function elimina(
  tabella: 'clienti_officina' | 'veicoli' | 'controlli',
  id: string,
  vietato: string,
): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await conRiprova(() =>
    supabase.from(tabella).delete().eq('id', id).select('id'),
  );
  if (error) throw error;
  if (data.length > 0) return;
  const ancora = await supabase.from(tabella).select('id').eq('id', id).maybeSingle();
  if (ancora.error) throw ancora.error;
  if (ancora.data) throw new ErroreModulo(vietato);
}

/** Elimina un cliente (solo il TITOLARE): i suoi veicoli restano, senza cliente. */
export const eliminaCliente = (id: string) =>
  elimina('clienti_officina', id, "Solo il titolare dell'officina può eliminare un cliente.");

/** Elimina un veicolo (solo il TITOLARE) con pneumatici, controlli e misure. */
export const eliminaVeicolo = (id: string) =>
  elimina('veicoli', id, "Solo il titolare dell'officina può eliminare un veicolo.");

// ---------------------------------------------------------------------------------------------------
// Scheda del veicolo
// ---------------------------------------------------------------------------------------------------

export type Pneumatico = Tables<'pneumatici'>;
export type Misura = Pick<
  Tables<'misure_pneumatico'>,
  'battistrada_mm' | 'pressione_bar' | 'usura' | 'danni'
> & { pneumatico: Pick<Pneumatico, 'posizione' | 'stagione'> };
export type Controllo = Pick<Tables<'controlli'>, 'id' | 'eseguito_il' | 'km' | 'note'> & {
  misure: Misura[];
};

export interface SchedaVeicolo {
  veicolo: Tables<'veicoli'>;
  cliente: Pick<
    Tables<'clienti_officina'>,
    'nome' | 'cognome' | 'ragione_sociale' | 'telefono' | 'email'
  > | null;
  /** Pneumatici montati ora. */
  pneumatici: Pneumatico[];
  /** Controlli dal più recente. */
  controlli: Controllo[];
}

/** Scheda completa di un veicolo; `null` se non esiste o non è visibile all'utente. */
export async function caricaSchedaVeicolo(id: string): Promise<SchedaVeicolo | null> {
  const { data, error } = await getSupabase()
    .from('veicoli')
    .select(
      `*,
       cliente:clienti_officina (nome, cognome, ragione_sociale, telefono, email),
       pneumatici (*),
       controlli (id, eseguito_il, km, note, created_at,
         misure:misure_pneumatico (battistrada_mm, pressione_bar, usura, danni,
           pneumatico:pneumatici (posizione, stagione)))`,
    )
    .eq('id', id)
    .is('pneumatici.smontato_il', null)
    .order('eseguito_il', { referencedTable: 'controlli', ascending: false })
    .order('created_at', { referencedTable: 'controlli', ascending: false })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { cliente, pneumatici, controlli, ...veicolo } = data;
  return { veicolo, cliente, pneumatici, controlli };
}

// ---------------------------------------------------------------------------------------------------
// Operazioni (funzioni SQL)
// ---------------------------------------------------------------------------------------------------

export async function montaPneumatici(veicoloId: string, dati: MontaPneumatici): Promise<void> {
  const { posizioni, montato_il, ...pneumatico } = dati;
  // Id scelti qui: se la chiamata viene ripetuta, la funzione riconosce gli pneumatici già montati
  const pneumatici = posizioni.map((posizione) => ({
    ...pneumatico,
    posizione,
    id: crypto.randomUUID(),
  }));
  const { error } = await conRiprova(() =>
    getSupabase().rpc('monta_pneumatici', {
      p_veicolo_id: veicoloId,
      p_montato_il: montato_il,
      p_pneumatici: pneumatici,
    }),
  );
  // Vincolo smontato_il >= montato_il: la data è precedente al montaggio degli pneumatici attuali
  if (codiceErrore(error) === '23514') {
    throw new ErroreModulo(
      'La data è precedente al montaggio degli pneumatici attuali: controllala',
      'montato_il',
    );
  }
  if (error) throw error;
}

export async function registraControllo(veicoloId: string, dati: NuovoControllo): Promise<void> {
  const argomenti = {
    // Id scelto qui: se la chiamata viene ripetuta, la funzione trova il controllo e non lo duplica
    p_id: crypto.randomUUID(),
    p_veicolo_id: veicoloId,
    p_eseguito_il: dati.eseguito_il,
    // Senza km il parametro si omette: la funzione SQL ha `null` come valore predefinito
    ...(dati.km !== null && { p_km: dati.km }),
    p_note: dati.note,
    // Le misure sono un JSON: l'interfaccia di TypeScript va convertita in un oggetto semplice
    p_misure: dati.misure.map((m) => ({ ...m })),
  };
  const { error } = await conRiprova(() => getSupabase().rpc('registra_controllo', argomenti));
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------------
// Correzioni di pneumatici e controlli
// ---------------------------------------------------------------------------------------------------

/**
 * Corregge i dati di pneumatici montati (es. DOT o marca sbagliati), uguali per tutte le posizioni
 * scelte. Una sola istruzione: o cambiano tutti o nessuno.
 */
export async function modificaPneumatici(
  ids: string[],
  dati: Omit<MontaPneumatici, 'posizioni'>,
): Promise<void> {
  const { data, error } = await conRiprova(() =>
    getSupabase().from('pneumatici').update(dati).in('id', ids).select('id'),
  );
  // Vincolo smontato_il >= montato_il: succede solo con pneumatici già smontati
  if (codiceErrore(error) === '23514') {
    throw new ErroreModulo('La data di montaggio è successiva allo smontaggio', 'montato_il');
  }
  if (error) throw error;
  if (data.length !== ids.length) {
    throw new ErroreModulo('Non è stato possibile salvare: ricarica la pagina e riprova.');
  }
}

/**
 * Smonta pneumatici senza montarne altri (es. ruota di scorta tolta). Un `update` con valori fissi:
 * si può ripetere dopo un errore di rete. Gli pneumatici restano nello storico con i loro controlli.
 */
export async function smontaPneumatici(ids: string[], smontato_il: string): Promise<void> {
  const { data, error } = await conRiprova(() =>
    getSupabase().from('pneumatici').update({ smontato_il }).in('id', ids).select('id'),
  );
  // Vincolo smontato_il >= montato_il
  if (codiceErrore(error) === '23514') {
    throw new ErroreModulo(
      'La data è precedente al montaggio di questi pneumatici: controllala',
      'smontato_il',
    );
  }
  if (error) throw error;
  if (data.length !== ids.length) {
    throw new ErroreModulo('Non è stato possibile salvare: ricarica la pagina e riprova.');
  }
}

export type MisuraDaCorreggere = Pick<
  Tables<'misure_pneumatico'>,
  'battistrada_mm' | 'pressione_bar' | 'usura' | 'danni'
> & { pneumatico: Pneumatico };

export type ControlloDaCorreggere = Pick<
  Tables<'controlli'>,
  'id' | 'veicolo_id' | 'officina_id' | 'eseguito_il' | 'km' | 'note'
> & { veicolo: Pick<Tables<'veicoli'>, 'targa'>; misure: MisuraDaCorreggere[] };

/** Un controllo con le misure e gli pneumatici misurati quel giorno (anche se ora smontati). */
export async function caricaControllo(id: string): Promise<ControlloDaCorreggere | null> {
  const { data, error } = await getSupabase()
    .from('controlli')
    .select(
      `id, veicolo_id, officina_id, eseguito_il, km, note, veicolo:veicoli (targa),
       misure:misure_pneumatico (battistrada_mm, pressione_bar, usura, danni, pneumatico:pneumatici (*))`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function modificaControllo(id: string, dati: NuovoControllo): Promise<void> {
  const { error } = await conRiprova(() =>
    getSupabase().rpc('modifica_controllo', {
      p_id: id,
      p_eseguito_il: dati.eseguito_il,
      ...(dati.km !== null && { p_km: dati.km }),
      p_note: dati.note,
      p_misure: dati.misure.map((m) => ({ ...m })),
    }),
  );
  if (error) throw error;
}

/** Elimina un controllo con le sue misure (TITOLARE e OPERATORE). */
export const eliminaControllo = (id: string) =>
  elimina('controlli', id, 'Non hai i permessi per eliminare questo controllo.');
