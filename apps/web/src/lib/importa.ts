import {
  csvClientiVeicoli,
  csvControlli,
  modelloCsv,
  oggiInItalia,
  type ClienteDaEsportare,
  type MisuraDaEsportare,
  type VeicoloDaEsportare,
  type Mappatura,
  tabellaDaCsv,
  type RigaImport,
  type Tabella,
  type Tables,
} from '@tyrecare/shared';
import { leggiTutte } from './a-pagine';
import { leggiExcel } from './excel';
import { conRiprova } from './rete';
import { scaricaCsv } from './scarica';
import { getSupabase } from './supabase';

// Import di clienti e veicoli dal CSV standard (PLAN P8). Il file lo controlla `controllaImport` di
// `@tyrecare/shared`; qui lo si legge dal disco e si chiama la funzione SQL `importa_clienti_veicoli`
// (prima in simulazione per l'anteprima, poi per davvero).

/**
 * Testo del file. I CSV salvati da Excel in italiano spesso non sono in UTF-8 ma in Windows-1252
 * (le lettere accentate diventerebbero "�"): se il file non è UTF-8 valido lo si rilegge così.
 */
export async function leggiFile(file: File): Promise<string> {
  const byte = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(byte);
  } catch {
    return new TextDecoder('windows-1252').decode(byte);
  }
}

/** File più grandi di così non si leggono (un export di migliaia di righe pesa molto meno). */
export const MAX_BYTE_FILE = 10 * 1024 * 1024;

const ESTENSIONI_EXCEL = /\.(xls|xlsx|ods)$/i;

/**
 * Legge un file del gestionale come tabella: Excel (.xls, .xlsx, .ods, in base all'estensione) o CSV.
 * `null` se il file è vuoto; lancia un errore con messaggio leggibile se è troppo grande o illeggibile.
 */
export async function leggiTabella(file: File): Promise<Tabella | null> {
  if (file.size > MAX_BYTE_FILE) {
    throw new Error(
      'Il file è troppo grande (al massimo 10 MB): controlla di aver scelto quello giusto.',
    );
  }
  if (!ESTENSIONI_EXCEL.test(file.name)) return tabellaDaCsv(await leggiFile(file));
  try {
    return await leggiExcel(file);
  } catch {
    throw new Error('Non riusciamo a leggere il file Excel: controlla che non sia danneggiato.');
  }
}

export interface ConteggiImport {
  clienti_nuovi: number;
  clienti_aggiornati: number;
  veicoli_nuovi: number;
  veicoli_aggiornati: number;
}

interface ImportClientiVeicoli {
  officinaId: string;
  righe: RigaImport[];
  nomeFile: string;
  /** Righe con errori, saltate: finiscono nel registro. */
  scartate: number;
  /** Vero per l'anteprima: la funzione conta ma non scrive. */
  simula: boolean;
}

/**
 * Importa (o simula) le righe valide. L'import è ripetibile: se la prima chiamata è arrivata al
 * database, la seconda ritrova clienti e veicoli e non crea doppioni.
 */
export async function importaClientiVeicoli({
  officinaId,
  righe,
  nomeFile,
  scartate,
  simula,
}: ImportClientiVeicoli): Promise<ConteggiImport> {
  const argomenti = {
    p_officina_id: officinaId,
    // Il numero di riga serve solo ai messaggi del browser
    p_righe: righe.map(({ cliente, veicolo }) => ({
      cliente: cliente && { ...cliente },
      veicolo: veicolo && { ...veicolo },
    })),
    p_nome_file: nomeFile,
    p_righe_scartate: scartate,
    p_simula: simula,
  };
  const { data, error } = await conRiprova(() =>
    getSupabase().rpc('importa_clienti_veicoli', argomenti),
  );
  if (error) throw error;
  return data as unknown as ConteggiImport;
}

export type ImportPassato = Tables<'import_log'>;

/** Ultimi import dell'officina, dal più recente. */
export async function caricaImportPassati(officinaId: string): Promise<ImportPassato[]> {
  const { data, error } = await getSupabase()
    .from('import_log')
    .select('*')
    .eq('officina_id', officinaId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

/** Associazione di colonne salvata dal titolare (tabella `import_mappature`). */
export interface MappaturaSalvata {
  id: string;
  nome: string;
  colonne: Mappatura;
  updated_at: string;
}

/** Associazioni salvate dell'officina, dalla più recente (per ultima modifica). */
export async function caricaMappature(officinaId: string): Promise<MappaturaSalvata[]> {
  const { data, error } = await getSupabase()
    .from('import_mappature')
    .select('id, nome, colonne, updated_at')
    .eq('officina_id', officinaId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ ...r, colonne: r.colonne as Mappatura }));
}

/** Salva l'associazione con un nome; se il nome esiste già nell'officina la sostituisce. */
export async function salvaMappatura(
  officinaId: string,
  nome: string,
  colonne: Mappatura,
): Promise<void> {
  const { error } = await getSupabase()
    .from('import_mappature')
    .upsert(
      { officina_id: officinaId, nome: nome.trim(), colonne },
      { onConflict: 'officina_id,nome' },
    );
  if (error) throw error;
}

export async function eliminaMappatura(id: string): Promise<void> {
  const { error } = await getSupabase().from('import_mappature').delete().eq('id', id);
  if (error) throw error;
}

/** Scarica il modello CSV. */
export function scaricaModello(): void {
  scaricaCsv('tyrecare-clienti-veicoli.csv', `${modelloCsv()}\r\n`);
}

/** Tutti i clienti e i veicoli dell'officina, letti a pagine di 1000 (limite di PostgREST). */
export async function caricaPerEsportazione(
  officinaId: string,
): Promise<{ clienti: ClienteDaEsportare[]; veicoli: VeicoloDaEsportare[] }> {
  const [clienti, veicoli] = await Promise.all([
    leggiTutte<ClienteDaEsportare>((da, a) =>
      getSupabase()
        .from('clienti_officina')
        .select('id, codice_gestionale, nome, cognome, ragione_sociale, telefono, email')
        .eq('officina_id', officinaId)
        .order('id')
        .range(da, a),
    ),
    leggiTutte<VeicoloDaEsportare & { id: string }>((da, a) =>
      getSupabase()
        .from('veicoli')
        .select('id, cliente_officina_id, targa, marca, modello, anno, telaio')
        .eq('officina_id', officinaId)
        .order('id')
        .range(da, a),
    ),
  ]);
  return { clienti, veicoli };
}

/** Scarica tutti i clienti e i veicoli nel formato del modello (`tyrecare-clienti-veicoli-AAAA-MM-GG.csv`). */
export async function scaricaClientiVeicoli(officinaId: string): Promise<void> {
  const { clienti, veicoli } = await caricaPerEsportazione(officinaId);
  scaricaCsv(
    `tyrecare-clienti-veicoli-${oggiInItalia()}.csv`,
    `${csvClientiVeicoli(clienti, veicoli)}\r\n`,
  );
}

/** Tutte le misure dei controlli dell'officina, lette a pagine di 1000 (chiave primaria: controllo + pneumatico). */
export async function caricaControlliPerEsportazione(
  officinaId: string,
): Promise<MisuraDaEsportare[]> {
  const righe = await leggiTutte((da, a) =>
    getSupabase()
      .from('misure_pneumatico')
      .select(
        `battistrada_mm, pressione_bar, usura, danni,
        controlli!misure_pneumatico_controllo_id_veicolo_id_fkey(codice_documento, eseguito_il, km, note),
        pneumatici!misure_pneumatico_pneumatico_id_veicolo_id_fkey(posizione, stagione, misura, marca, modello, dot),
        veicoli!misure_pneumatico_veicolo_id_officina_id_fkey(targa)`,
      )
      .eq('officina_id', officinaId)
      .order('controllo_id')
      .order('pneumatico_id')
      .range(da, a),
  );
  return righe.map((r) => ({
    codice_documento: r.controlli.codice_documento,
    targa: r.veicoli.targa,
    eseguito_il: r.controlli.eseguito_il,
    km: r.controlli.km,
    posizione: r.pneumatici.posizione,
    battistrada_mm: r.battistrada_mm,
    pressione_bar: r.pressione_bar,
    usura: r.usura,
    danni: r.danni,
    stagione: r.pneumatici.stagione,
    misura: r.pneumatici.misura,
    marca: r.pneumatici.marca,
    modello: r.pneumatici.modello,
    dot: r.pneumatici.dot,
    note: r.controlli.note,
  }));
}

/** Scarica tutte le misure dei controlli nel formato dell'import (`tyrecare-controlli-AAAA-MM-GG.csv`). */
export async function scaricaControlli(officinaId: string): Promise<void> {
  const misure = await caricaControlliPerEsportazione(officinaId);
  scaricaCsv(`tyrecare-controlli-${oggiInItalia()}.csv`, `${csvControlli(misure)}\r\n`);
}
