import {
  PianoSchema,
  StatoAbbonamentoSchema,
  type Enums,
  type Piano,
  type StatoAbbonamento,
} from '@tyrecare/shared';
import { z } from 'zod';
import { ErroreModulo, codiceErrore } from './errori';
import { getSupabase } from './supabase';

// Abbonamento di un'officina visto dall'amministratore (`/admin/abbonamento?id=…`). Nell'app non si paga:
// quando arriva il bonifico l'admin rinnova o imposta l'abbonamento. Le regole stanno nelle funzioni SQL
// `admin_*` (migrazioni 20261114100000 e 20261116000100); qui solo lettura, modulo ed errori in italiano.

export interface AbbonamentoAdmin {
  officina_id: string;
  ragione_sociale: string;
  stato_affiliazione: Enums<'stato_affiliazione'>;
  piano: Piano;
  stato: StatoAbbonamento;
  prova_fino_al: string;
  iniziato_il: string | null;
  scade_il: string | null;
  installazione_pagata: boolean;
  installazione_pagata_il: string | null;
  importo_concordato: number | null;
  note_admin: string;
}

const MESSAGGI: Record<string, [string, string?]> = {
  OFFICINA_NON_TROVATA: ['Officina non trovata: torna all’elenco e riprova.'],
  PIANO_NON_VALIDO: ['Scegli il piano.', 'piano'],
  STATO_NON_VALIDO: ['Scegli lo stato.', 'stato'],
  SCADENZA_MANCANTE: ['Un abbonamento attivo ha bisogno della data di scadenza.', 'scade_il'],
  DATE_NON_VALIDE: ['L’inizio deve venire prima della scadenza.', 'iniziato_il'],
  IMPORTO_NON_VALIDO: ['Importo non valido.', 'importo'],
  NOTE_TROPPO_LUNGHE: ['Le note possono avere al massimo 2000 caratteri.', 'note'],
  PERIODO_NON_VALIDO: ['Periodo non valido.'],
};

/** Errore delle funzioni `admin_*` dell'abbonamento → messaggio del modulo. Altri errori: invariati. */
export function traduciErroreAbbonamento(errore: { message?: string } | unknown): unknown {
  if (codiceErrore(errore) === '42501') {
    return new ErroreModulo(
      'Solo l’amministratore, dopo la verifica in due passaggi, può farlo.',
      undefined,
      '42501',
    );
  }
  const chiave = (errore as { message?: string } | null)?.message ?? '';
  const voce = MESSAGGI[chiave];
  return voce ? new ErroreModulo(voce[0], voce[1], chiave) : errore;
}

export async function caricaAbbonamentoAdmin(officinaId: string): Promise<AbbonamentoAdmin | null> {
  const { data, error } = await getSupabase()
    .rpc('admin_leggi_abbonamento', { p_officina_id: officinaId })
    .maybeSingle();
  if (error) {
    if (error.message === 'OFFICINA_NON_TROVATA') return null;
    throw traduciErroreAbbonamento(error);
  }
  if (!data) return null;
  const piano = PianoSchema.safeParse(data.piano);
  const stato = StatoAbbonamentoSchema.safeParse(data.stato);
  return {
    ...data,
    piano: piano.success ? piano.data : 'MENSILE',
    stato: stato.success ? stato.data : 'SCADUTO',
    importo_concordato: data.importo_concordato === null ? null : Number(data.importo_concordato),
  };
}

/** Rinnova di un mese o di un anno dalla scadenza (o da oggi, se è passata). Restituisce la scadenza. */
export async function rinnovaAbbonamento(officinaId: string, periodo: 'MESE' | 'ANNO') {
  const { data, error } = await getSupabase().rpc('admin_rinnova_abbonamento', {
    p_officina_id: officinaId,
    p_periodo: periodo,
  });
  if (error) throw traduciErroreAbbonamento(error);
  return data;
}

export async function registraInstallazione(officinaId: string, pagata: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('admin_registra_installazione', {
    p_officina_id: officinaId,
    p_pagata: pagata,
  });
  if (error) throw traduciErroreAbbonamento(error);
}

const data = z.union([
  z.literal('').transform(() => null),
  z.iso.date({ error: 'Data non valida' }),
]);

/** Modulo «Modifica l'abbonamento»: i campi arrivano come testo dal form. */
export const ModuloAbbonamentoSchema = z
  .object({
    piano: PianoSchema,
    // SOSPESO non si sceglie: dipende dall'officina (Sospendi / Attiva nell'elenco delle officine)
    stato: z.enum(['PROVA', 'ATTIVO', 'SCADUTO'], { error: 'Scegli lo stato' }),
    prova_fino_al: data,
    iniziato_il: data,
    scade_il: data,
    importo: z
      .string()
      .trim()
      .transform((s) => s.replace(',', '.'))
      .refine((s) => s === '' || /^\d{1,5}(\.\d{1,2})?$/.test(s), {
        error: 'Scrivi un importo in euro, es. 90 o 900,00',
      })
      .transform((s) => (s === '' ? null : Number(s))),
    note: z.string().trim().max(2000, { error: 'Al massimo 2000 caratteri' }),
  })
  .refine((d) => d.stato !== 'ATTIVO' || d.scade_il !== null, {
    error: 'Un abbonamento attivo ha bisogno della data di scadenza',
    path: ['scade_il'],
  })
  .refine((d) => !d.iniziato_il || !d.scade_il || d.iniziato_il <= d.scade_il, {
    error: 'L’inizio deve venire prima della scadenza',
    path: ['iniziato_il'],
  });
export type ModuloAbbonamento = z.output<typeof ModuloAbbonamentoSchema>;

export async function impostaAbbonamento(officinaId: string, m: ModuloAbbonamento): Promise<void> {
  const { error } = await getSupabase().rpc('admin_imposta_abbonamento', {
    p_officina_id: officinaId,
    p_piano: m.piano,
    p_stato: m.stato,
    // null lascia la fine della prova com'è (vedi la funzione SQL)
    ...(m.prova_fino_al ? { p_prova_fino_al: m.prova_fino_al } : {}),
    ...(m.iniziato_il ? { p_iniziato_il: m.iniziato_il } : {}),
    ...(m.scade_il ? { p_scade_il: m.scade_il } : {}),
    ...(m.importo !== null ? { p_importo: m.importo } : {}),
    p_note: m.note,
  });
  if (error) throw traduciErroreAbbonamento(error);
}
