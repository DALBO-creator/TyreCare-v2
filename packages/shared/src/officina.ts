import { z } from 'zod';
import { TelefonoSchema } from './auth';
import { PosizioneSchema, StagioneSchema, UsuraSchema, type Posizione } from './pneumatici';

// Schemi dei moduli lato officina (Fase 2). Ricevono i valori dei campi come stringhe (FormData) e
// restituiscono dati già puliti, pronti per il database: stessi vincoli `check` delle tabelle, così
// l'errore compare sotto il campo invece di arrivare dal database.

/** Testo facoltativo con lunghezza massima (spazi iniziali e finali tolti). */
const testo = (max: number, etichetta: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${etichetta} può avere al massimo ${max} caratteri` });

/** Come `testo`, ma vuoto → `null`. */
const testoONull = (max: number, etichetta: string) =>
  testo(max, etichetta).transform((s) => s || null);

/** Data di oggi in formato `AAAA-MM-GG`, nel fuso orario del dispositivo. */
export function oggiISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const gg = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}

/** Data di un campo `<input type="date">`, non nel futuro. Le date ISO si confrontano come testo. */
const dataPassata = (etichetta: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: `Inserisci ${etichetta}` })
    .refine((s) => s <= oggiISO(), { error: 'La data non può essere nel futuro' });

/**
 * Numero con al più un decimale scritto all'italiana ("3,4") o all'inglese ("3.4"); vuoto → `null`.
 * Arrotondato a un decimale come le colonne `numeric(3, 1)`.
 */
const decimale = (min: number, max: number, messaggio: string) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(',', '.'))
    .refine((s) => s === '' || /^\d+(\.\d+)?$/.test(s), { error: messaggio })
    // `Number('1.45e1')` è esattamente 14.5, mentre `1.45 * 10` in virgola mobile è 14.4999…
    .transform((s) => (s === '' ? null : Math.round(Number(`${s}e1`)) / 10))
    .refine((n) => n === null || (n >= min && n <= max), { error: messaggio });

// ---------------------------------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------------------------------

// Stesso controllo del vincolo `check` su `clienti_officina.email`
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const ClienteSchema = z
  .object({
    nome: testo(100, 'Il nome'),
    cognome: testo(100, 'Il cognome'),
    ragione_sociale: testoONull(200, 'La ragione sociale'),
    telefono: TelefonoSchema,
    email: z
      .string()
      .trim()
      .refine((s) => s === '' || EMAIL.test(s), {
        error: "Controlla l'email: sembra incompleta (es. nome@esempio.it)",
      })
      .transform((s) => s || null),
    note: testo(2000, 'Le note'),
  })
  // Come il vincolo `clienti_officina_nominativo`: una persona o un'azienda
  .refine((c) => c.nome || c.cognome || c.ragione_sociale, {
    error: 'Inserisci nome e cognome, oppure la ragione sociale',
    path: ['nome'],
  });
export type Cliente = z.infer<typeof ClienteSchema>;

// ---------------------------------------------------------------------------------------------------
// Veicolo
// ---------------------------------------------------------------------------------------------------

/** Targa in forma canonica, come il trigger `normalizza_veicolo`: "ab 123-cd" → "AB123CD". */
export function normalizzaTarga(targa: string): string {
  return targa.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Targa italiana leggibile: "AB123CD" → "AB 123 CD"; le altre restano come sono. */
export function formattaTarga(targa: string): string {
  return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(targa)
    ? `${targa.slice(0, 2)} ${targa.slice(2, 5)} ${targa.slice(5)}`
    : targa;
}

export const VeicoloSchema = z.object({
  targa: z
    .string()
    .transform(normalizzaTarga)
    .pipe(
      z
        .string()
        .min(1, { error: 'Inserisci la targa', abort: true })
        .regex(/^[A-Z0-9]{2,10}$/, { error: 'La targa ha da 2 a 10 lettere e cifre' }),
    ),
  marca: testo(50, 'La marca'),
  modello: testo(100, 'Il modello'),
  anno: z
    .string()
    .trim()
    .refine(
      (s) => s === '' || (/^\d{4}$/.test(s) && +s >= 1900 && +s <= new Date().getFullYear() + 1),
      { error: "Controlla l'anno (es. 2019)" },
    )
    .transform((s) => (s === '' ? null : Number(s))),
  telaio: z
    .string()
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine((s) => s === '' || /^[A-HJ-NPR-Z0-9]{17}$/.test(s), {
      error: 'Il telaio (VIN) ha 17 caratteri, senza le lettere I, O e Q',
    })
    .transform((s) => s || null),
  // Select "Cliente": vuoto = nessun cliente
  cliente_officina_id: z
    .string()
    .refine((s) => s === '' || z.uuid().safeParse(s).success, { error: 'Cliente non valido' })
    .transform((s) => s || null),
});
export type Veicolo = z.infer<typeof VeicoloSchema>;

// ---------------------------------------------------------------------------------------------------
// Montaggio pneumatici
// ---------------------------------------------------------------------------------------------------

// Stesso controllo del vincolo `check` su `pneumatici.dot`: settimana 01–53 + anno a due cifre
const DOT = /^(0[1-9]|[1-4][0-9]|5[0-3])[0-9]{2}$/;

export const MontaPneumaticiSchema = z.object({
  // Caselle di scelta: arrivano come elenco (vuoto se non ne è spuntata nessuna)
  posizioni: z
    .array(PosizioneSchema)
    .min(1, { error: 'Scegli almeno una posizione' })
    .refine((p) => new Set(p).size === p.length, { error: 'Posizioni ripetute' }),
  stagione: z.enum(StagioneSchema.options, { error: 'Scegli la stagione' }),
  misura: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, { error: 'Inserisci la misura (es. 205/55 R16 91V)', abort: true })
        .max(40, { error: 'La misura può avere al massimo 40 caratteri' }),
    ),
  marca: testo(50, 'La marca'),
  modello: testo(100, 'Il modello'),
  dot: z
    .string()
    .trim()
    .refine((s) => s === '' || DOT.test(s), {
      error: 'Il DOT sono le ultime 4 cifre: settimana e anno (es. 3823)',
    })
    .transform((s) => s || null),
  montato_il: dataPassata('la data di montaggio'),
});
export type MontaPneumatici = z.infer<typeof MontaPneumaticiSchema>;

// ---------------------------------------------------------------------------------------------------
// Nuovo controllo
// ---------------------------------------------------------------------------------------------------

/** Nomi dei campi di una posizione nel modulo del controllo (es. `mm_ANT_SX`). */
export const campiMisura = (p: Posizione) =>
  ({ mm: `mm_${p}`, bar: `bar_${p}`, usura: `usura_${p}`, danni: `danni_${p}` }) as const;

export interface MisuraControllo {
  posizione: Posizione;
  battistrada_mm: number;
  pressione_bar: number | null;
  usura: z.infer<typeof UsuraSchema> | null;
  danni: string;
}

export interface NuovoControllo {
  eseguito_il: string;
  km: number | null;
  note: string;
  misure: MisuraControllo[];
}

/**
 * Schema del modulo "Nuovo controllo" per le posizioni montate sul veicolo. I campi di ogni posizione
 * hanno nomi piatti (`mm_ANT_SX`, `bar_ANT_SX`…) perché il modulo segnala l'errore sotto il campo
 * con quel nome. Il battistrada è obbligatorio, tranne per la ruota di scorta.
 */
export function creaControlloSchema(posizioni: readonly Posizione[]) {
  const forma: Record<string, z.ZodType> = {
    eseguito_il: dataPassata('la data del controllo'),
    km: z
      .string()
      // "41.250" o "41 250" → 41250
      .transform((s) => s.replace(/[.\s]/g, ''))
      .refine((s) => s === '' || (/^\d+$/.test(s) && +s <= 2_000_000), {
        error: 'Controlla i km: solo cifre (es. 41250)',
      })
      .transform((s) => (s === '' ? null : Number(s))),
    note: testo(2000, 'Le note'),
  };
  for (const p of posizioni) {
    const c = campiMisura(p);
    const mm = decimale(0, 20, 'Da 0 a 20 mm (es. 4,5)');
    forma[c.mm] =
      p === 'SCORTA' ? mm : mm.refine((n) => n !== null, { error: 'Inserisci il battistrada' });
    forma[c.bar] = decimale(0, 9.9, 'Da 0 a 9,9 bar (es. 2,3)');
    forma[c.usura] = UsuraSchema.or(z.literal('')).transform((s) => s || null);
    forma[c.danni] = testo(500, 'La descrizione dei danni');
  }

  return z.object(forma).transform((v): NuovoControllo => {
    const misure: MisuraControllo[] = [];
    for (const p of posizioni) {
      const c = campiMisura(p);
      const mm = v[c.mm] as number | null;
      // Ruota di scorta non misurata: nessuna riga
      if (mm === null) continue;
      misure.push({
        posizione: p,
        battistrada_mm: mm,
        pressione_bar: v[c.bar] as number | null,
        usura: v[c.usura] as MisuraControllo['usura'],
        danni: v[c.danni] as string,
      });
    }
    return {
      eseguito_il: v.eseguito_il as string,
      km: v.km as number | null,
      note: v.note as string,
      misure,
    };
  });
}
