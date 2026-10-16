import { modelloCsv, type RigaImport, type Tables } from '@tyrecare/shared';
import { conRiprova } from './rete';
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

/** Scarica il modello CSV. Il BOM iniziale fa aprire a Excel il file in UTF-8 (accenti corretti). */
export function scaricaModello(): void {
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${modelloCsv()}\r\n`], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tyrecare-clienti-veicoli.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
